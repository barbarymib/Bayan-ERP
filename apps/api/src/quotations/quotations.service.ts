import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { calcStatementTotals, roundQty, type Discount } from '@bayan/shared';
import type { AuthUser } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { NumberingService } from '../numbering.service.js';
import { PeriodsService } from '../common/periods.service.js';
import { PriceResolverService } from '../common/price-resolver.service.js';
import { PriceStatementsService } from '../price-statements/price-statements.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { tenantWhere } from '../common/tenant.js';
import type { CreateStatementDto } from '../price-statements/price-statements.dto.js';
import type {
  CreateQuotationDto,
  QueryQuotationsDto,
  QuotationActionDto,
} from './quotations.dto.js';

type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CONVERTED' | 'EXPIRED';

const toDbDiscountType = (t?: 'percent' | 'amount'): 'PERCENT' | 'AMOUNT' | null =>
  t === 'percent' ? 'PERCENT' : t === 'amount' ? 'AMOUNT' : null;

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly periods: PeriodsService,
    private readonly resolver: PriceResolverService,
    private readonly priceStatements: PriceStatementsService,
    private readonly audits: AuditLogsService,
  ) {}

  async create(dto: CreateQuotationDto, user: AuthUser) {
    const tenant = user.companyId ?? null;
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer || (customer.companyId != null && customer.companyId !== tenant)) {
      throw new NotFoundException(`Customer ${dto.customerId} not found`);
    }

    const warehouse =
      dto.warehouseId != null
        ? await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } })
        : await this.prisma.warehouse.findFirst({ where: { code: 'MAIN', ...tenantWhere(tenant) } });
    if (!warehouse || (warehouse.companyId != null && warehouse.companyId !== tenant)) {
      throw new NotFoundException('Warehouse not found');
    }

    const number = dto.number ?? (await this.numbering.issue('QT', user.repCode ?? '', tenant));

    const resolved: {
      itemId: number;
      itemCode: string;
      unitId: number;
      factor: number;
      qty: number;
      unitPrice: number;
      discount?: Discount;
      cost: number | null;
    }[] = [];

    for (const line of dto.lines) {
      const item = await this.prisma.item.findFirst({ where: { code: line.itemCode, ...tenantWhere(tenant) } });
      if (!item) throw new NotFoundException(`Item ${line.itemCode} not found`);
      if (!item.active) throw new BadRequestException(`Item ${line.itemCode} is inactive`);

      let unitId = item.baseUnitId;
      let factor = 1;
      if (line.unitCode) {
        const unit = await this.prisma.unit.findUnique({ where: { code: line.unitCode } });
        if (!unit) throw new NotFoundException(`Unit ${line.unitCode} not found`);
        if (unit.id !== item.baseUnitId) {
          const iu = await this.prisma.itemUnit.findUnique({
            where: { itemId_unitId: { itemId: item.id, unitId: unit.id } },
          });
          if (!iu) throw new BadRequestException(`Unit ${line.unitCode} is not linked to item ${item.code}`);
          if (!iu.isSale) throw new BadRequestException(`Unit ${line.unitCode} is not a sale unit`);
          unitId = unit.id;
          factor = Number(iu.factorToBase);
        }
      }

      let unitPrice = line.unitPrice;
      if (unitPrice === undefined) {
        unitPrice = await this.resolver.resolve({
          itemId: item.id,
          unitId,
          customerId: customer.id,
          priceListId: customer.priceListId,
        });
      }
      if (unitPrice === undefined) {
        throw new BadRequestException(
          `No price for ${item.code} in the customer's price list — provide unitPrice`,
        );
      }

      const cost = item.lastPurchaseCost != null ? Number(item.lastPurchaseCost) * factor : null;

      resolved.push({
        itemId: item.id,
        itemCode: item.code,
        unitId,
        factor,
        qty: line.qty,
        unitPrice,
        discount: line.discount,
        cost,
      });
    }

    const totals = calcStatementTotals({
      lines: resolved.map((r) => ({ qty: r.qty, unitPrice: r.unitPrice, discount: r.discount })),
      headerDiscount: dto.discount,
      shipping: dto.shipping,
      taxPercent: dto.taxPercent,
    });

    const period = await this.periods.open(tenant);

    const quotation = await this.prisma.quotation.create({
      data: {
        number,
        customerId: customer.id,
        repId: user.repCode ? user.id : null,
        companyId: tenant,
        warehouseId: warehouse.id,
        date: new Date(),
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        status: 'DRAFT',
        subtotal: totals.subtotal,
        discountType: toDbDiscountType(dto.discount?.type),
        discountValue: dto.discount?.value ?? null,
        discountAmount: totals.headerDiscountAmount,
        shipping: totals.shipping,
        taxPercent: dto.taxPercent ?? 0,
        taxAmount: totals.tax,
        net: totals.net,
        notes: dto.notes,
        createdById: user.id,
        periodId: period?.id ?? null,
        lines: {
          create: resolved.map((r, i) => {
            const t = totals.lines[i]!;
            return {
              itemId: r.itemId,
              unitId: r.unitId,
              factor: r.factor,
              qty: r.qty,
              qtyBase: roundQty(r.qty * r.factor),
              unitPrice: r.unitPrice,
              lineDiscountType: toDbDiscountType(r.discount?.type),
              lineDiscountValue: r.discount?.value ?? null,
              lineDiscountAmount: t.lineDiscountAmount,
              allocatedHeaderDiscount: t.allocatedHeaderDiscount,
              netLine: t.netFinal,
              costSnapshot: r.cost,
              periodId: period?.id ?? null,
            };
          }),
        },
      },
      include: {
        lines: { include: { item: true, unit: true } },
        customer: true,
        warehouse: true,
      },
    });

    return this.stripCost(this.withEffectiveStatus(quotation), user);
  }

  async list(query: QueryQuotationsDto, companyId: number | null = null) {
    const limit = query.limit ?? 20;
    const where = {
      ...tenantWhere(companyId),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.repId ? { repId: query.repId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where,
        include: {
          customer: { select: { id: true, code: true, nameAr: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { date: 'desc' },
        take: limit,
      }),
      this.prisma.quotation.count({ where }),
    ]);
    return { total, items: rows.map((q) => this.withEffectiveStatus(q)) };
  }

  async get(id: number, user: AuthUser) {
    const companyId = user.companyId ?? null;
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        lines: { include: { item: true, unit: true } },
        customer: true,
        warehouse: true,
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });
    if (!quotation || (quotation.companyId != null && quotation.companyId !== companyId)) {
      throw new NotFoundException(`Quotation ${id} not found`);
    }
    return this.stripCost(this.withEffectiveStatus(quotation), user);
  }

  async send(id: number, user: AuthUser) {
    return this.transition(id, ['DRAFT'], 'SENT', {}, user, 'quotation.send');
  }

  async accept(id: number, dto: QuotationActionDto, user: AuthUser) {
    return this.transition(
      id,
      ['DRAFT', 'SENT'],
      'ACCEPTED',
      {
        approvedById: user.id,
        approvedAt: new Date(),
        notes: dto.note,
      },
      user,
      'quotation.accept',
    );
  }

  async reject(id: number, dto: QuotationActionDto, user: AuthUser) {
    return this.transition(id, ['DRAFT', 'SENT'], 'REJECTED', { notes: dto.note }, user, 'quotation.reject');
  }

  /** تحويل عرض السعر إلى بيان أسعار بضغطة واحدة (§5.16). */
  async convert(id: number, user: AuthUser) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: { lines: { include: { item: true, unit: true } } },
    });
    if (!quotation || (quotation.companyId != null && quotation.companyId !== (user.companyId ?? null))) {
      throw new NotFoundException(`Quotation ${id} not found`);
    }
    if (quotation.status === 'CONVERTED') {
      throw new BadRequestException('Quotation already converted');
    }
    if (quotation.status === 'REJECTED') {
      throw new BadRequestException('Rejected quotations cannot be converted');
    }

    const statementDto: CreateStatementDto = {
      customerId: quotation.customerId,
      warehouseId: quotation.warehouseId ?? undefined,
      paymentTerm: 'CREDIT',
      lines: quotation.lines.map((l) => ({
        itemCode: l.item.code,
        unitCode: l.unit.code,
        qty: Number(l.qty),
        unitPrice: Number(l.unitPrice),
        discount:
          l.lineDiscountType && l.lineDiscountValue != null
            ? {
                type: l.lineDiscountType === 'PERCENT' ? ('percent' as const) : ('amount' as const),
                value: Number(l.lineDiscountValue),
              }
            : undefined,
      })),
      discount:
        quotation.discountType && quotation.discountValue != null
          ? {
              type: quotation.discountType === 'PERCENT' ? ('percent' as const) : ('amount' as const),
              value: Number(quotation.discountValue),
            }
          : undefined,
      shipping: Number(quotation.shipping),
      taxPercent: Number(quotation.taxPercent),
      notes: quotation.notes ?? undefined,
    };

    const statement = await this.priceStatements.create(statementDto, user);
    if (!statement) throw new BadRequestException('Statement creation failed');
    const statementId = statement.id;

    await this.prisma.quotation.update({
      where: { id },
      data: { status: 'CONVERTED', convertedStatementId: statementId, convertedAt: new Date() },
    });

    await this.audits.write({
      userId: user.id,
      action: 'quotation.convert',
      entity: 'Quotation',
      entityId: id,
      beforeJson: { status: quotation.status },
      afterJson: { status: 'CONVERTED', statementId },
    });

    const fresh = await this.get(id, user);
    return { quotation: fresh, statement };
  }

  private async transition(
    id: number,
    allowed: QuotationStatus[],
    target: QuotationStatus,
    extra: Record<string, unknown> = {},
    user: AuthUser,
    action?: string,
  ) {
    const companyId = user.companyId ?? null;
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      select: { status: true, companyId: true },
    });
    if (!quotation || (quotation.companyId != null && quotation.companyId !== companyId)) {
      throw new NotFoundException(`Quotation ${id} not found`);
    }
    if (!allowed.includes(quotation.status)) {
      throw new BadRequestException(
        `Cannot move quotation from ${quotation.status} to ${target}`,
      );
    }
    await this.prisma.quotation.update({ where: { id }, data: { status: target, ...extra } });
    if (action) {
      await this.audits.write({
        userId: user.id,
        action,
        entity: 'Quotation',
        entityId: id,
        beforeJson: { status: quotation.status },
        afterJson: { status: target },
      });
    }
    return this.get(id, user);
  }

  /**
   * إخفاء سعر التكلفة (costSnapshot / lastPurchaseCost) عمن لا يملك cost.view (§4.2).
   */
  private stripCost<T>(detail: T, user: AuthUser): T {
    if (user.permissions?.includes('cost.view') || detail == null) return detail;
    const d = detail as { lines?: Array<Record<string, unknown>> };
    if (!Array.isArray(d.lines)) return detail;
    for (const line of d.lines) {
      line.costSnapshot = null;
      const item = line.item as Record<string, unknown> | undefined;
      if (item && 'lastPurchaseCost' in item) item.lastPurchaseCost = null;
    }
    return detail;
  }

  /** الحالة المعروضة: عرض منتهي الصلاحية يُعرض EXPIRED دون تغيير التخزين. */
  private withEffectiveStatus<T extends { status: QuotationStatus; validUntil?: Date | null }>(
    row: T,
  ): T & { effectiveStatus: QuotationStatus } {
    const expired =
      (row.status === 'DRAFT' || row.status === 'SENT') &&
      row.validUntil != null &&
      row.validUntil.getTime() < Date.now();
    return { ...row, effectiveStatus: expired ? 'EXPIRED' : row.status };
  }
}
