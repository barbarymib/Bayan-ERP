import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  calcReturnLineValue,
  calcReturnUnitNetPrice,
  roundMoney,
  roundQty,
  validateReturnQty,
} from '@bayan/shared';
import type { AuthUser } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { NumberingService } from '../numbering.service.js';
import { PeriodsService } from '../common/periods.service.js';
import { SalesOpsService } from '../common/sales-ops.service.js';
import { allowsDecimalByMeasurement, assertLineQtyAllowed } from '../common/units.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { tenantWhere } from '../common/tenant.js';
import { assertCustomerInScope, repCustomerFilter } from '../common/customer-scope.js';
import type { CreateReturnDto, QueryReturnsDto } from './returns.dto.js';

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly periods: PeriodsService,
    private readonly ops: SalesOpsService,
    private readonly notifications: NotificationsService,
    private readonly audits: AuditLogsService,
  ) {}

  async create(dto: CreateReturnDto, user: AuthUser) {
    const tenant = user.companyId ?? null;
    // idempotency
    if (dto.clientUuid) {
      const existing = await this.prisma.returnStatement.findFirst({ where: { clientUuid: dto.clientUuid, ...tenantWhere(tenant) } });
      if (existing) return this.get(existing.id, tenant);
    }
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer || (customer.companyId != null && customer.companyId !== tenant)) {
      throw new NotFoundException(`Customer ${dto.customerId} not found`);
    }
    // نطاق المندوب (§4.2 «عملاؤه»)
    await assertCustomerInScope(this.prisma, customer.id, user, tenant);
    if (dto.mode === 'BY_REP' && !user.repCode) {
      throw new BadRequestException('BY_REP mode requires a sales rep user');
    }

    const reason = await this.prisma.returnReason.findUnique({ where: { code: dto.reasonCode } });
    if (!reason) throw new BadRequestException(`Unknown return reason ${dto.reasonCode}`);

    const number = dto.number ?? (await this.numbering.issue('RT', user.repCode ?? '', tenant));
    const period = await this.periods.open(tenant);

    const withoutStatement = dto.withoutStatement === true;
    if (withoutStatement && !user.permissions.includes('return.without_statement')) {
      throw new ForbiddenException('Missing permission: return.without_statement');
    }
    if (!withoutStatement && dto.lines.some((l) => l.sourceLineId == null)) {
      throw new BadRequestException('sourceLineId مطلوب لكل بند (أو استخدم withoutStatement)');
    }

    // أثر المرتجع المالي (§5.9): BALANCE (خصم من الرصيد) / CREDIT (رصيد دائن) / CASH (رد نقدية).
    // القناة المباشرة تُتحقق في DTO، أما قناة المزامنة فتمرّ مباشرة — لذا نتحقق مرة أخرى هنا.
    const settlement = dto.settlement ?? 'BALANCE';
    if (!['BALANCE', 'CASH', 'CREDIT'].includes(settlement)) {
      throw new BadRequestException(`Unknown settlement ${String(dto.settlement)}`);
    }
    if (settlement === 'CASH' && !user.permissions.includes('return.cash_refund')) {
      throw new ForbiddenException('Missing permission: return.cash_refund');
    }

    const resolved: {
      sourceLineId: number | null;
      itemId: number;
      unitId: number;
      qty: number;
      qtyBase: number;
      unitNetPrice: number;
      lineTotal: number;
      condition: 'GOOD' | 'DAMAGED';
    }[] = [];
    let total = 0;

    for (const line of dto.lines) {
      if (withoutStatement) {
        if (line.itemId == null) throw new BadRequestException('itemId مطلوب في المرتجع بدون بيان');
        if (line.unitPrice == null) throw new BadRequestException('unitPrice مطلوب في المرتجع بدون بيان');
        const item = await this.prisma.item.findUnique({
          where: { id: line.itemId },
          include: { baseUnit: { select: { measurement: true, nameAr: true } } },
        });
        if (!item || (item.companyId != null && item.companyId !== tenant)) {
          throw new NotFoundException(`Item ${line.itemId} not found`);
        }
        let unitId = item.baseUnitId;
        let factor = 1;
        let allowDecimal = allowsDecimalByMeasurement(item.baseUnit.measurement);
        let unitName = item.baseUnit.nameAr;
        if (line.unitCode) {
          const unit = await this.prisma.unit.findUnique({ where: { code: line.unitCode } });
          if (!unit) throw new NotFoundException(`Unit ${line.unitCode} not found`);
          if (unit.id !== item.baseUnitId) {
            const iu = await this.prisma.itemUnit.findUnique({
              where: { itemId_unitId: { itemId: item.id, unitId: unit.id } },
            });
            if (!iu) throw new BadRequestException(`Unit ${line.unitCode} is not linked to item ${item.code}`);
            unitId = unit.id;
            factor = Number(iu.factorToBase);
            allowDecimal = iu.allowDecimal;
          }
          unitName = unit.nameAr;
        }
        assertLineQtyAllowed(line.qty, allowDecimal, unitName);
        const qtyBase = roundQty(line.qty * factor);
        const lineTotal = roundMoney(line.qty * line.unitPrice);
        total = roundMoney(total + lineTotal);
        resolved.push({
          sourceLineId: null,
          itemId: line.itemId,
          unitId,
          qty: line.qty,
          qtyBase,
          unitNetPrice: line.unitPrice,
          lineTotal,
          condition: line.condition,
        });
        continue;
      }

      const src = await this.prisma.priceStatementLine.findUnique({
        where: { id: line.sourceLineId! },
        include: {
          item: { include: { baseUnit: { select: { measurement: true, nameAr: true } } } },
          unit: true,
          statement: { select: { status: true, customerId: true, number: true } },
        },
      });
      if (!src) throw new NotFoundException(`Source line ${line.sourceLineId} not found`);
      if (src.statement.customerId !== customer.id) {
        throw new BadRequestException(`Source line ${line.sourceLineId} does not belong to this customer`);
      }
      if (src.statement.status !== 'APPROVED') {
        throw new BadRequestException(`Source statement ${src.statement.number} is not approved yet`);
      }

      let unitId = src.unitId;
      let factor = Number(src.factor);
      let allowDecimal: boolean;
      if (src.unitId === src.item.baseUnitId) {
        allowDecimal = allowsDecimalByMeasurement(src.item.baseUnit.measurement);
      } else {
        const siu = await this.prisma.itemUnit.findUnique({
          where: { itemId_unitId: { itemId: src.itemId, unitId: src.unitId } },
        });
        allowDecimal = siu?.allowDecimal ?? true;
      }
      let unitName = src.unit.nameAr;
      if (line.unitCode) {
        const unit = await this.prisma.unit.findUnique({ where: { code: line.unitCode } });
        if (!unit) throw new NotFoundException(`Unit ${line.unitCode} not found`);
        if (unit.id !== src.unitId) {
          const iu = await this.prisma.itemUnit.findUnique({
            where: { itemId_unitId: { itemId: src.itemId, unitId: unit.id } },
          });
          if (!iu) throw new BadRequestException(`Unit ${line.unitCode} is not linked to item ${src.item.code}`);
          unitId = unit.id;
          factor = Number(iu.factorToBase);
          allowDecimal = iu.allowDecimal;
        }
        unitName = unit.nameAr;
      }
      assertLineQtyAllowed(line.qty, allowDecimal, unitName);

      const qtyBase = roundQty(line.qty * factor);
      const done = await this.prisma.returnLine.aggregate({
        where: { sourceLineId: src.id, return: { status: 'APPROVED' } },
        _sum: { qtyBase: true },
      });
      try {
        validateReturnQty({
          originalQty: Number(src.qtyBase),
          alreadyReturnedQty: Number(done._sum.qtyBase ?? 0),
          requestedQty: qtyBase,
        });
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }

      const unitNetPrice = calcReturnUnitNetPrice(Number(src.netLine), Number(src.qtyBase));
      const lineTotal = calcReturnLineValue(Number(src.netLine), Number(src.qtyBase), qtyBase);
      total = roundMoney(total + lineTotal);

      resolved.push({
        sourceLineId: src.id,
        itemId: src.itemId,
        unitId,
        qty: line.qty,
        qtyBase,
        unitNetPrice,
        lineTotal,
        condition: line.condition,
      });
    }

    const selfApproved = user.permissions.includes('return.approve');
    const rtn = await this.prisma.returnStatement.create({
      data: {
        number,
        clientUuid: dto.clientUuid ?? randomUUID(),
        mode: dto.mode,
        companyId: tenant,
        customerId: customer.id,
        repId: user.repCode ? user.id : null,
        date: dto.date ? new Date(dto.date) : new Date(),
        status: 'DRAFT',
        total,
        withoutStatement,
        settlement,
        reasonId: reason.id,
        notes: dto.notes,
        periodId: period?.id ?? null,
        lines: {
          create: resolved.map((r) => ({
            sourceLineId: r.sourceLineId,
            itemId: r.itemId,
            unitId: r.unitId,
            qty: r.qty,
            qtyBase: r.qtyBase,
            unitNetPrice: r.unitNetPrice,
            lineTotal: r.lineTotal,
            condition: r.condition,
            periodId: period?.id ?? null,
          })),
        },
      },
      include: {
        lines: { include: { item: true, unit: true, sourceLine: { include: { statement: true } } } },
        customer: true,
        reason: true,
      },
    });

    if (!selfApproved) {
      await this.prisma.approval.create({
        data: {
          type: 'RETURN',
          refType: 'return_statement',
          refId: rtn.id,
          refJson: {
            amount: rtn.total,
            customer: customer.nameAr,
            reason: reason.nameAr,
          } as object,
          companyId: tenant,
          requestedById: user.id,
          status: 'PENDING',
        },
      });
      const targetIds = await this.notifications.userIdsWithPermission('return.approve');
      await this.notifications.notifyMany(targetIds, {
        type: 'return_approval',
        title: 'مرتجع بانتظار الاعتماد',
        body: `${rtn.number} — ${customer.nameAr} (${Number(rtn.total).toFixed(2)})`,
        refType: 'return_statement',
        refId: rtn.id,
      });
    } else {
      await this.ops.finalizeReturn(rtn.id, user);
    }

    return this.get(rtn.id, tenant);
  }

  async list(query: QueryReturnsDto, user: AuthUser) {
    const companyId = user.companyId ?? null;
    const limit = query.limit ?? 20;
    const customerFilter = await repCustomerFilter(this.prisma, user, companyId, query.customerId);
    const rows = await this.prisma.returnStatement.findMany({
      where: {
        ...tenantWhere(companyId),
        ...customerFilter,
        ...(query.repId ? { repId: query.repId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        customer: { select: { id: true, code: true, nameAr: true } },
        reason: true,
        rep: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });
    const total = await this.prisma.returnStatement.count({
      where: {
        ...tenantWhere(companyId),
        ...customerFilter,
        ...(query.repId ? { repId: query.repId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
    });
    return { total, items: rows };
  }

  async get(id: number, companyId: number | null = null, user?: AuthUser) {
    const rtn = await this.prisma.returnStatement.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            item: true,
            unit: true,
            sourceLine: { include: { statement: { select: { id: true, number: true, date: true } } } },
          },
        },
        customer: true,
        reason: true,
        rep: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });
    if (!rtn || (rtn.companyId != null && rtn.companyId !== companyId)) {
      throw new NotFoundException(`Return ${id} not found`);
    }
    if (user) await assertCustomerInScope(this.prisma, rtn.customerId, user, companyId, true);
    return rtn;
  }

  /** إلغاء مرتجع قبل الاعتماد فقط. */
  async cancel(id: number, user: AuthUser) {
    const rtn = await this.prisma.returnStatement.findUnique({ where: { id } });
    if (!rtn || (rtn.companyId != null && rtn.companyId !== (user.companyId ?? null))) {
      throw new NotFoundException(`Return ${id} not found`);
    }
    await assertCustomerInScope(this.prisma, rtn.customerId, user, user.companyId ?? null, true);
    if (rtn.status === 'CANCELLED') throw new BadRequestException('Return already cancelled');
    if (rtn.status === 'APPROVED') throw new BadRequestException('Approved returns cannot be cancelled here');
    await this.prisma.$transaction(async (tx) => {
      await tx.returnStatement.update({ where: { id }, data: { status: 'CANCELLED' } });
      await tx.approval.updateMany({
        where: {
          refType: 'return_statement',
          refId: id,
          status: 'PENDING',
          ...tenantWhere(user.companyId ?? null),
        },
        data: { status: 'REJECTED', decidedById: user.id, decidedAt: new Date(), note: 'أُغلق بسبب إلغاء المستند' },
      });
    });
    await this.audits.write({
      userId: user.id,
      action: 'return.cancel',
      entity: 'ReturnStatement',
      entityId: id,
      beforeJson: { status: rtn.status },
      afterJson: { status: 'CANCELLED' },
    });
    return { id, status: 'CANCELLED' as const };
  }
}