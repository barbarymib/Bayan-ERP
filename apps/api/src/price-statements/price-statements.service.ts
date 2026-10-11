import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  calcStatementTotals,
  roundMoney,
  roundQty,
  type Discount,
} from '@bayan/shared';
import type { AuthUser } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import { NumberingService } from '../numbering.service.js';
import { PeriodsService } from '../common/periods.service.js';
import { LedgerService } from '../common/ledger.service.js';
import { SalesOpsService } from '../common/sales-ops.service.js';
import { StockService } from '../common/stock.service.js';
import { PriceResolverService } from '../common/price-resolver.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { CancelStatementDto, CreateStatementDto, QueryStatementsDto } from './price-statements.dto.js';

const toDbDiscountType = (t?: 'percent' | 'amount'): 'PERCENT' | 'AMOUNT' | null =>
  t === 'percent' ? 'PERCENT' : t === 'amount' ? 'AMOUNT' : null;

@Injectable()
export class PriceStatementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly periods: PeriodsService,
    private readonly ledger: LedgerService,
    private readonly ops: SalesOpsService,
    private readonly stock: StockService,
    private readonly resolver: PriceResolverService,
    private readonly notifications: NotificationsService,
    private readonly audits: AuditLogsService,
  ) {}

  async create(dto: CreateStatementDto, user: AuthUser) {
    const tenant = user.companyId ?? null;
    // idempotency
    if (dto.clientUuid) {
      const existing = await this.prisma.priceStatement.findFirst({
        where: { clientUuid: dto.clientUuid, ...tenantWhere(tenant) },
      });
      if (existing) return this.findWithDetail(existing.id);
    }
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
    await this.stock.assertMovable(warehouse.id, tenant);

    const number = dto.number ?? (await this.numbering.issue('BP', user.repCode ?? '', tenant));
    const customerPriceListId = customer.priceListId;

    const resolved: {
      item: { id: number; code: string; baseUnitId: number; lastPurchaseCost: number | null };
      unitId: number;
      factor: number;
      qty: number;
      unitPrice: number;
      discount?: Discount;
      cost: number | null;
    }[] = [];
    const discountFlags: { itemCode: string; discount: Discount; limitPct: number }[] = [];
    let belowCost = false;

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
        // السعر الخاص (§5.16) أولاً ثم قائمة أسعار العميل
        unitPrice = await this.resolver.resolve({
          itemId: item.id,
          unitId,
          customerId: customer.id,
          priceListId: customerPriceListId,
          companyId: tenant,
        });
      }
      if (unitPrice === undefined) {
        throw new BadRequestException(`No price for ${item.code} in the customer's price list — provide unitPrice`);
      }

      const cost = item.lastPurchaseCost != null ? Number(item.lastPurchaseCost) * factor : null;
      if (cost !== null && unitPrice < cost) belowCost = true;

      if (line.discount?.type === 'percent' && line.discount.value > Number(user.maxItemDiscountPct)) {
        discountFlags.push({ itemCode: item.code, discount: line.discount, limitPct: Number(user.maxItemDiscountPct) });
      }

      resolved.push({
        item: { id: item.id, code: item.code, baseUnitId: item.baseUnitId, lastPurchaseCost: item.lastPurchaseCost != null ? Number(item.lastPurchaseCost) : null },
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

    if (dto.paid && dto.paid > totals.net) {
      throw new BadRequestException(`paid (${dto.paid}) cannot exceed net (${totals.net})`);
    }

    const headerExceeds =
      dto.discount?.type === 'percent' && dto.discount.value > Number(user.maxInvoiceDiscountPct);
    const requiresApproval = discountFlags.length > 0 || headerExceeds || belowCost;

    const period = await this.periods.open(tenant);
    const creditWarning = await this.checkCreditLimit(customer.id, totals.net, tenant);

    // منع تجاوز المتاح (مع احترام حجوزات المسودات) حسب الإعداد stock.sale.enforce = BLOCK
    await this.stock.assertSalePermitted(
      warehouse.id,
      resolved.map((r) => ({ itemId: r.item.id, qtyBase: roundQty(r.qty * r.factor) })),
      tenant,
    );

    const statement = await this.prisma.priceStatement.create({
      data: {
        number,
        clientUuid: dto.clientUuid ?? randomUUID(),
        customerId: customer.id,
        repId: user.repCode ? user.id : null,
        warehouseId: warehouse.id,
        companyId: tenant,
        date: dto.date ? new Date(dto.date) : new Date(),
        status: 'DRAFT',
        paymentTerm: dto.paymentTerm ?? 'CREDIT',
        subtotal: totals.subtotal,
        discountType: toDbDiscountType(dto.discount?.type),
        discountValue: dto.discount?.value ?? null,
        discountAmount: totals.headerDiscountAmount,
        shipping: totals.shipping,
        taxPercent: dto.taxPercent ?? 0,
        taxAmount: totals.tax,
        net: totals.net,
        paid: dto.paid ?? 0,
        lat: dto.lat,
        lng: dto.lng,
        notes: dto.notes,
        createdById: user.id,
        periodId: period?.id ?? null,
        lines: {
          create: resolved.map((r, i) => {
            const t = totals.lines[i]!;
            return {
              itemId: r.item.id,
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
      include: { lines: { include: { item: true, unit: true } }, customer: true, warehouse: true },
    });

    if (requiresApproval) {
      // حجز مؤقت للكميات أثناء انتظار الموافقة (اختياري §5.7)
      await this.prisma.$transaction(async (tx) => {
        await this.stock.reserve(
          tx,
          'price_statement',
          statement.id,
          warehouse.id,
          resolved.map((r) => ({ itemId: r.item.id, qtyBase: roundQty(r.qty * r.factor) })),
          tenant,
        );
      });
      const approvals: { type: 'ITEM_DISCOUNT' | 'HEADER_DISCOUNT' | 'BELOW_COST'; refJson: object }[] = discountFlags.map(
        (flag) => ({
          type: 'ITEM_DISCOUNT',
          refJson: { itemCode: flag.itemCode, discount: flag.discount, userLimitPct: flag.limitPct },
        }),
      );
      if (headerExceeds) {
        approvals.push({ type: 'HEADER_DISCOUNT', refJson: { discount: dto.discount, userLimitPct: Number(user.maxInvoiceDiscountPct) } });
      }
      if (belowCost) approvals.push({ type: 'BELOW_COST', refJson: { note: 'Selling below last purchase cost' } });

      await this.prisma.approval.createMany({
        data: approvals.map((a) => ({
          type: a.type,
          refType: 'price_statement',
          refId: statement.id,
          refJson: a.refJson as object,
          requestedById: user.id,
          status: 'PENDING',
          companyId: tenant,
        })),
      });
      // إشعار من يملك صلاحية الاعتماد (§5.15)
      const targetIds = await this.notifications.userIdsWithPermission('discount.approve');
      for (let i = 0; i < approvals.length; i++) {
        await this.notifications.notifyMany(targetIds, {
          type: 'discount_approval',
          title: 'طلب موافقة على خصم يتجاوز الحد',
          body: `${statement.number} — ${customer.nameAr}`,
          refType: 'price_statement',
          refId: statement.id,
        });
      }
    } else {
      await this.ops.finalizeStatement(statement.id, user);
    }

    const fresh = await this.findWithDetail(statement.id);
    return { ...this.stripCost(fresh, user), creditWarning };
  }

  async list(query: QueryStatementsDto, companyId: number | null = null) {
    const limit = query.limit ?? 20;
    const rows = await this.prisma.priceStatement.findMany({
      where: {
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
      },
      include: {
        customer: { select: { id: true, code: true, nameAr: true } },
        warehouse: { select: { id: true, code: true, nameAr: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });
    const total = await this.prisma.priceStatement.count({
      where: {
        ...tenantWhere(companyId),
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.repId ? { repId: query.repId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
    });
    return { total, items: rows };
  }

  async get(id: number, user: AuthUser) {
    const st = await this.findWithDetail(id);
    if (!st || (st.companyId != null && st.companyId !== (user.companyId ?? null))) {
      throw new NotFoundException(`Statement ${id} not found`);
    }
    const approvals = await this.prisma.approval.findMany({
      where: { refType: 'price_statement', refId: id, ...tenantWhere(user.companyId ?? null) },
      include: {
        requestedBy: { select: { id: true, name: true } },
        decidedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return { ...this.stripCost(st, user), approvals };
  }

  async cancel(id: number, dto: CancelStatementDto, user: AuthUser) {
    const st = await this.prisma.priceStatement.findUnique({ where: { id }, select: { status: true, companyId: true } });
    if (!st || (st.companyId != null && st.companyId !== (user.companyId ?? null))) {
      throw new NotFoundException(`Statement ${id} not found`);
    }
    if (!dto.reason.trim()) throw new BadRequestException('Cancellation reason is required');
    if (st.status === 'CANCELLED') throw new BadRequestException('Statement already cancelled');

    if (st.status === 'APPROVED') {
      await this.ops.cancelStatement(id, user);
    } else {
      // مسودة: تحرير الحجز + آجال أغلفق الموافقات المعلقة قبل الإلغاء
      await this.prisma.$transaction(async (tx) => {
        await this.stock.releaseReservations(tx, 'price_statement', id);
        await tx.priceStatement.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            notes: [null, dto.reason].filter(Boolean).join(' • ') || dto.reason,
            cancelReason: dto.reason,
            cancelledById: user.id,
            cancelledAt: new Date(),
          },
        });
        await tx.approval.updateMany({
          where: { refType: 'price_statement', refId: id, status: 'PENDING' },
          data: { status: 'REJECTED', decidedById: user.id, decidedAt: new Date(), note: 'أُغلق بسبب إلغاء المستند' },
        });
      });
    }
    await this.audits.write({
      userId: user.id,
      action: 'statement.cancel',
      entity: 'PriceStatement',
      entityId: id,
      beforeJson: { status: st.status },
      afterJson: { status: 'CANCELLED', reason: dto.reason },
    });
    return { id, status: 'CANCELLED' as const };
  }

  /** رصيد العميل الحالي مقابل حدّه الائتماني + تحذير عند الاقتراب من البيان الجديد. */
  private async checkCreditLimit(customerId: number, newNet: number, companyId: number | null = null) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || Number(customer.creditLimit) <= 0) return null;
    const { debit, credit } = await this.ledger.balanceOf('CUSTOMER', customerId, companyId);
    const outstanding = Number(customer.openingBalance) + debit - credit + newNet;
    return {
      creditLimit: Number(customer.creditLimit),
      projectedBalance: roundMoney(outstanding),
    };
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

  private async findWithDetail(id: number) {
    return this.prisma.priceStatement.findUnique({
      where: { id },
      include: {
        lines: { include: { item: true, unit: true } },
        customer: true,
        warehouse: true,
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });
  }
}