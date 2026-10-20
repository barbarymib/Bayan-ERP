import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { roundMoney, roundQty } from '@bayan/shared';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import { compositeQty } from '../common/units.js';
import { weightDeltaOf } from '../price-statements/price-statements.service.js';
import { haversineM } from '../geo/geo.service.js';
import type {
  QueryAgingDto,
  QueryDiscountApprovalsDto,
  QueryDiscountsDto,
  QueryItemCardDto,
  QueryMovementsDto,
  QueryReportSummaryDto,
  QueryRepPerformanceDto,
  QueryReturnsDto,
  QuerySalesByDto,
  QuerySalesSummaryDto,
  QueryItemsWithoutPriceDto,
  QueryStockSummaryDto,
  QueryStockValuesDto,
  QueryStocktakeDiffDto,
  QueryStoppedCustomersDto,
  QuerySupplierDebtDto,
  QueryWeightNotesDto,
} from './reports.dto.js';

const ACTIVE_STOCKTAKE = ['OPEN', 'COUNTING', 'REVIEW'] as const;
const MOVEMENT_LABEL: Record<string, string> = {
  SALE_OUT: 'صرف بيع',
  PURCHASE_IN: 'توريد',
  RETURN_IN: 'مرتجع',
  ADJUSTMENT: 'تسوية جرد',
};

export type ValuationMethod = 'LAST' | 'WEIGHTED' | 'SALES';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** تقييم أرصدة المخزون بطريقة تقييم مختارة (آخر شراء / متوسط مرجح / سعر البيع). */
  async stockValues(query: QueryStockValuesDto, companyId: number | null = null) {
    const method: ValuationMethod = query.method ?? 'LAST';
    const balances = await this.prisma.stockBalance.findMany({
      where: { ...tenantWhere(companyId), ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}) },
      include: {
        item: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            baseUnitId: true,
            lastPurchaseCost: true,
            baseUnit: { select: { id: true, nameAr: true, measurement: true } },
            itemUnits: {
              select: {
                unitId: true,
                factorToBase: true,
                allowDecimal: true,
                unit: { select: { id: true, nameAr: true } },
              },
            },
          },
        },
      },
    });
    const items = [...new Map(balances.map((b) => [b.itemId, b.item])).values()];
    const ids = items.map((i) => i.id);

    // طريقة المتوسط المرجح: متوسط تكلفة المشتريات الفعلية
    const weighted = new Map<number, number>();
    if (method === 'WEIGHTED' && ids.length) {
      const buys = await this.prisma.stockMovement.findMany({
        where: { type: 'PURCHASE_IN', itemId: { in: ids }, cost: { not: null }, qtyBase: { not: 0 }, ...tenantWhere(companyId) },
        select: { itemId: true, qtyBase: true, cost: true },
      });
      const acc = new Map<number, { qty: number; value: number }>();
      for (const m of buys) {
        const q = Number(m.qtyBase);
        const c = Number(m.cost);
        const cur = acc.get(m.itemId) ?? { qty: 0, value: 0 };
        acc.set(m.itemId, { qty: cur.qty + q, value: cur.value + q * c });
      }
      for (const [itemId, a] of acc) {
        if (a.qty > 0) weighted.set(itemId, roundMoney(a.value / a.qty));
      }
    }

    // طريقة سعر البيع: سعر الأساس بسعر بيع أول قائمة أسعار نشطة
    const sales = new Map<number, number>();
    if (method === 'SALES' && ids.length) {
      const prices = await this.prisma.itemPrice.findMany({
        where: { itemId: { in: ids }, priceList: { active: true }, ...tenantWhere(companyId) },
        include: { item: { select: { baseUnitId: true } } },
        orderBy: { id: 'asc' },
      });
      for (const p of prices) {
        if (!sales.has(p.itemId)) sales.set(p.itemId, Number(p.price));
      }
    }

    const perWh = new Map<number, { qtyBase: number; value: number }>();
    const byItem = new Map<number, { qtyBase: number; value: number }>();
    let totalQty = 0;
    let totalValue = 0;
    // R3-C2 (§5.8 note): بنود بلا سعر تُوسم ويُستبعد أثرها من الإجمالي مع إظهار عددها.
    let noPriceLines = 0;
    let noPriceQty = 0;
    let noPriceValue = 0;
    const noPriceItemIds = new Set<number>();
    const noPriceByItem = new Map<number, { code: string; nameAr: string; qtyBase: number }>();

    const rows = balances.map((b) => {
      const qtyBase = roundQty(Number(b.qtyBase));
      let unitCost = 0;
      let noPrice = false;
      if (method === 'LAST') {
        noPrice = b.item.lastPurchaseCost == null;
        unitCost = noPrice ? 0 : Number(b.item.lastPurchaseCost);
      } else if (method === 'WEIGHTED') {
        noPrice = !weighted.has(b.itemId);
        unitCost = weighted.get(b.itemId) ?? 0;
      } else {
        noPrice = !sales.has(b.itemId);
        unitCost = sales.get(b.itemId) ?? 0;
      }
      const value = roundMoney(qtyBase * unitCost);

      if (noPrice) {
        noPriceLines++;
        noPriceQty = roundQty(noPriceQty + qtyBase);
        noPriceValue = roundMoney(noPriceValue + value);
        noPriceItemIds.add(b.itemId);
        const np = noPriceByItem.get(b.itemId) ?? { code: b.item.code, nameAr: b.item.nameAr, qtyBase: 0 };
        np.qtyBase = roundQty(np.qtyBase + qtyBase);
        noPriceByItem.set(b.itemId, np);
      } else {
        const wh = perWh.get(b.warehouseId) ?? { qtyBase: 0, value: 0 };
        wh.qtyBase = roundQty(wh.qtyBase + qtyBase);
        wh.value = roundMoney(wh.value + value);
        perWh.set(b.warehouseId, wh);

        const it = byItem.get(b.itemId) ?? { qtyBase: 0, value: 0 };
        it.qtyBase = roundQty(it.qtyBase + qtyBase);
        it.value = roundMoney(it.value + value);
        byItem.set(b.itemId, it);

        totalQty = roundQty(totalQty + qtyBase);
        totalValue = roundMoney(totalValue + value);
      }

      return {
        itemId: b.itemId,
        code: b.item.code,
        nameAr: b.item.nameAr,
        warehouseId: b.warehouseId,
        batchId: b.batchId,
        qtyBase,
        qtyComposite: compositeQty(qtyBase, b.item),
        unitCost,
        value,
        noPrice,
      };
    });

    const warehouses = await this.prisma.warehouse.findMany({
      where: { id: { in: [...perWh.keys()] }, ...tenantWhere(companyId) },
      select: { id: true, code: true, nameAr: true },
    });
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));

    return {
      method,
      methodLabel:
        method === 'LAST' ? 'آخر سعر شراء' : method === 'WEIGHTED' ? 'متوسط مرجح (المشتريات)' : 'سعر البيع',
      rows,
      byItem: [...byItem.entries()].map(([itemId, v]) => ({
        itemId,
        item: { code: items.find((i) => i.id === itemId)?.code ?? '', nameAr: items.find((i) => i.id === itemId)?.nameAr ?? '' },
        qtyBase: v.qtyBase,
        value: v.value,
      })),
      byWarehouse: [...perWh.entries()].map(([warehouseId, v]) => ({
        warehouseId,
        warehouse: warehouseMap.get(warehouseId) ?? { code: `#${warehouseId}`, nameAr: `مخزن ${warehouseId}` },
        qtyBase: v.qtyBase,
        value: v.value,
      })),
      noPriceItems: [...noPriceByItem.entries()].map(([itemId, v]) => ({
        itemId,
        code: v.code,
        nameAr: v.nameAr,
        qtyBase: v.qtyBase,
      })),
      totals: {
        items: items.length,
        qtyBase: totalQty,
        value: totalValue,
        noPriceItems: noPriceItemIds.size,
        noPriceLines,
        noPriceQtyBase: noPriceQty,
        noPriceValue,
      },
    };
  }

  /** أصناف بلا آخر سعر شراء (تقييم صفري) — قائمة الإصلاح (§11 «اختلاف تقييم المخزون»). */
  async itemsWithoutPrice(query: QueryItemsWithoutPriceDto, companyId: number | null = null) {
    const items = await this.prisma.item.findMany({
      where: {
        ...tenantWhere(companyId),
        active: true,
        lastPurchaseCost: null,
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      },
      select: {
        id: true,
        code: true,
        nameAr: true,
        baseUnit: { select: { code: true, nameAr: true } },
        category: { select: { code: true, nameAr: true } },
      },
      orderBy: { code: 'asc' },
      take: query.limit ?? 1000,
    });

    const onHand = new Map<number, number>();
    const ids = items.map((i) => i.id);
    if (ids.length) {
      const balances = await this.prisma.stockBalance.groupBy({
        by: ['itemId'],
        where: { ...tenantWhere(companyId), itemId: { in: ids } },
        _sum: { qtyBase: true },
      });
      for (const b of balances) onHand.set(b.itemId, roundQty(Number(b._sum.qtyBase ?? 0)));
    }

    const rows = items.map((i) => ({
      itemId: i.id,
      code: i.code,
      nameAr: i.nameAr,
      category: i.category.code,
      categoryName: i.category.nameAr,
      unit: i.baseUnit.code,
      unitName: i.baseUnit.nameAr,
      qtyBase: onHand.get(i.id) ?? 0,
      methodLabel: 'آخر سعر شراء',
    }));

    return { count: rows.length, rows };
  }

  /** دفتر حركات المخزون: عرض لكل حركة مع جارٍ (running balance) لكل صنف/تشغيلة/مخزن. */
  async movements(query: QueryMovementsDto, companyId: number | null = null) {
    const limit = query.limit ?? 500;
    const where: Prisma.StockMovementWhereInput = { ...tenantWhere(companyId) };
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.itemId) where.itemId = query.itemId;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(`${query.from}T00:00:00Z`);
      if (query.to) where.createdAt.lte = new Date(`${query.to}T23:59:59Z`);
    }
    const rows = await this.prisma.stockMovement.findMany({
      where,
      include: {
        item: { select: { id: true, code: true, nameAr: true } },
        warehouse: { select: { id: true, code: true, nameAr: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });

    const running = new Map<string, number>();
    let totalIn = 0;
    let totalOut = 0;
    const out = rows.map((m) => {
      const key = `${m.warehouseId}:${m.itemId}:${m.batchId}`;
      const qty = roundQty(Number(m.qtyBase));
      const balance = roundQty((running.get(key) ?? 0) + qty);
      running.set(key, balance);
      if (qty > 0) totalIn = roundQty(totalIn + qty);
      else totalOut = roundQty(totalOut + qty);
      return {
        id: m.id,
        at: m.createdAt,
        type: m.type,
        typeLabel: MOVEMENT_LABEL[m.type] ?? m.type,
        refType: m.refType,
        refId: m.refId,
        item: m.item,
        warehouse: m.warehouse,
        batchId: m.batchId,
        qtyBase: qty,
        in: qty > 0 ? qty : 0,
        out: qty < 0 ? qty : 0,
        cost: m.cost != null ? Number(m.cost) : null,
        balance,
      };
    });

    return { count: out.length, rows: out, totals: { totalIn, totalOut, net: roundQty(totalIn + totalOut) } };
  }

  /** بطاقة الصنف: رصيد افتتاحي + حركات (رصيد جارٍ) + رصيد ختامي + أرصدة لحظية لكل مخزن (§5.7/§5.14). */
  async itemCard(query: QueryItemCardDto, companyId: number | null = null, canViewCost = false) {
    const item = await this.prisma.item.findFirst({
      where: { id: query.itemId, ...tenantWhere(companyId) },
      select: {
        id: true,
        code: true,
        barcode: true,
        nameAr: true,
        nameEn: true,
        minStock: true,
        minSalePrice: true,
        lastPurchaseCost: true,
        baseUnit: { select: { id: true, code: true, nameAr: true } },
        category: { select: { id: true, nameAr: true } },
      },
    });
    if (!item) throw new NotFoundException('الصنف غير موجود');

    const baseWhere: Prisma.StockMovementWhereInput = { ...tenantWhere(companyId), itemId: query.itemId };
    if (query.warehouseId) baseWhere.warehouseId = query.warehouseId;
    const from = query.from ? new Date(`${query.from}T00:00:00Z`) : null;
    const to = query.to ? new Date(`${query.to}T23:59:59Z`) : null;
    const fallbackCost = item.lastPurchaseCost != null ? Number(item.lastPurchaseCost) : null;
    const unitCostOf = (c: unknown) => (c != null ? Number(c) : fallbackCost);

    let openingQty = 0;
    let openingValue = 0;
    const openingByKey = new Map<string, number>();
    if (from) {
      const before = await this.prisma.stockMovement.findMany({
        where: { ...baseWhere, createdAt: { lt: from } },
        select: { qtyBase: true, cost: true, warehouseId: true, batchId: true },
      });
      for (const m of before) {
        const qty = Number(m.qtyBase);
        const cost = unitCostOf(m.cost);
        openingQty += qty;
        if (cost != null) openingValue += qty * cost;
        const key = `${m.warehouseId}:${m.batchId}`;
        openingByKey.set(key, (openingByKey.get(key) ?? 0) + qty);
      }
    }
    openingQty = roundQty(openingQty);
    openingValue = roundMoney(openingValue);

    const where: Prisma.StockMovementWhereInput = { ...baseWhere };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }
    const rows = await this.prisma.stockMovement.findMany({
      where,
      include: { warehouse: { select: { id: true, code: true, nameAr: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: query.limit ?? 1000,
    });

    const running = new Map<string, number>(openingByKey);
    let totalIn = 0;
    let totalOut = 0;
    let inValue = 0;
    let outValue = 0;
    const out = rows.map((m) => {
      const key = `${m.warehouseId}:${m.batchId}`;
      const qty = roundQty(Number(m.qtyBase));
      const balance = roundQty((running.get(key) ?? 0) + qty);
      running.set(key, balance);
      const unitCost = unitCostOf(m.cost);
      const value = unitCost != null ? roundMoney(qty * unitCost) : null;
      if (qty > 0) {
        totalIn = roundQty(totalIn + qty);
        inValue = roundMoney(inValue + (value ?? 0));
      } else {
        totalOut = roundQty(totalOut + qty);
        outValue = roundMoney(outValue + (value ?? 0));
      }
      return {
        id: m.id,
        at: m.createdAt,
        type: m.type,
        typeLabel: MOVEMENT_LABEL[m.type] ?? m.type,
        refType: m.refType,
        refId: m.refId,
        warehouse: m.warehouse,
        batchId: m.batchId,
        qtyBase: qty,
        in: qty > 0 ? qty : 0,
        out: qty < 0 ? qty : 0,
        unitCost,
        value,
        balance,
      };
    });

    const closingQty = roundQty(openingQty + totalIn + totalOut);
    const closingValue = roundMoney(openingValue + inValue + outValue);

    const balances = await this.prisma.stockBalance.findMany({
      where: { ...tenantWhere(companyId), itemId: query.itemId, ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}) },
      include: { warehouse: { select: { id: true, code: true, nameAr: true } } },
      orderBy: [{ warehouseId: 'asc' }, { batchId: 'asc' }],
    });
    const balanceRows = balances.map((b) => {
      const qtyBase = roundQty(Number(b.qtyBase));
      return {
        warehouse: b.warehouse,
        batchId: b.batchId,
        qtyBase,
        value: fallbackCost != null ? roundMoney(qtyBase * fallbackCost) : null,
      };
    });

    const hideCost = !canViewCost;
    return {
      item: hideCost ? { ...item, lastPurchaseCost: null } : item,
      from: from ? from.toISOString().slice(0, 10) : null,
      to: to ? to.toISOString().slice(0, 10) : null,
      warehouseId: query.warehouseId ?? null,
      opening: { qty: openingQty, value: hideCost ? null : openingValue },
      rows: hideCost ? out.map((r) => ({ ...r, unitCost: null, value: null })) : out,
      totals: {
        in: totalIn,
        out: totalOut,
        net: roundQty(totalIn + totalOut),
        openingQty,
        closingQty,
        closingValue: hideCost ? null : closingValue,
      },
      balances: hideCost ? balanceRows.map((b) => ({ ...b, value: null })) : balanceRows,
    };
  }

  /** أصناف تحت الحد الأدنى عبر المخازن. */
  async lowStock(companyId: number | null = null) {
    const balances = await this.prisma.stockBalance.findMany({
      where: { ...tenantWhere(companyId) },
      include: {
        item: { select: { id: true, code: true, nameAr: true, minStock: true } },
        warehouse: { select: { id: true, code: true, nameAr: true } },
      },
    });
    const rows = balances
      .filter((b) => Number(b.qtyBase) < Number(b.item.minStock))
      .map((b) => {
        const qtyBase = roundQty(Number(b.qtyBase));
        const minStock = roundQty(Number(b.item.minStock));
        return {
          itemId: b.itemId,
          item: { code: b.item.code, nameAr: b.item.nameAr },
          warehouse: { code: b.warehouse.code, nameAr: b.warehouse.nameAr },
          batchId: b.batchId,
          qtyBase,
          minStock,
          diff: roundQty(qtyBase - minStock),
        };
      })
      .sort((a, b) => a.diff - b.diff);
    return { count: rows.length, rows };
  }

  /** ملخص مخزون: كميات وقيم (آخر سعر شراء) وآخر حركة لكل صنف (لاكتشاف الراكد). */
  async stockSummary(query: QueryStockSummaryDto, companyId: number | null = null) {
    const stale = new Date();
    stale.setDate(stale.getDate() - (query.stagnantDays ?? 90));

    const balances = await this.prisma.stockBalance.findMany({
      where: { ...tenantWhere(companyId), ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}) },
      include: {
        item: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            baseUnitId: true,
            lastPurchaseCost: true,
            baseUnit: { select: { id: true, nameAr: true, measurement: true } },
            itemUnits: {
              select: { unitId: true, factorToBase: true, allowDecimal: true, unit: { select: { id: true, nameAr: true } } },
            },
          },
        },
        warehouse: { select: { id: true, code: true, nameAr: true } },
      },
    });
    const lastMov = new Map<number, Date | null>();
    if (balances.length) {
      // ملاحظة (G25/R3-E8): لا نمرّر آلاف المعرّفات في `in` (يسبب P2029/P2028)؛
      // نجمع آخر حركة على مستوى قاعدة البيانات مقيّدة بالشركة، ثم نطابقها في الذاكرة.
      const movs =
        companyId == null
          ? await this.prisma.$queryRaw<{ itemId: number; last: Date | null }[]>`
              SELECT "itemId", MAX("createdAt") AS last
              FROM "StockMovement"
              GROUP BY "itemId"`
          : await this.prisma.$queryRaw<{ itemId: number; last: Date | null }[]>`
              SELECT "itemId", MAX("createdAt") AS last
              FROM "StockMovement"
              WHERE "companyId" = ${companyId}
              GROUP BY "itemId"`;
      for (const m of movs) lastMov.set(m.itemId, m.last ?? null);
    }
    const itemById = new Map<number, (typeof balances)[number]['item']>();
    for (const b of balances) if (!itemById.has(b.itemId)) itemById.set(b.itemId, b.item);

    let totalQty = 0;
    let totalValue = 0;
    const byItem = new Map<number, { qtyBase: number; value: number }>();
    for (const b of balances) {
      const qtyBase = roundQty(Number(b.qtyBase));
      const lastCost = b.item.lastPurchaseCost != null ? Number(b.item.lastPurchaseCost) : 0;
      const cur = byItem.get(b.itemId) ?? { qtyBase: 0, value: 0 };
      cur.qtyBase = roundQty(cur.qtyBase + qtyBase);
      cur.value = roundMoney(cur.value + qtyBase * lastCost);
      byItem.set(b.itemId, cur);
      totalQty = roundQty(totalQty + qtyBase);
      totalValue = roundMoney(totalValue + qtyBase * lastCost);
    }

    const rows = [...byItem.entries()].map(([itemId, v]) => {
      const last = lastMov.get(itemId) ?? null;
      const item = itemById.get(itemId);
      return {
        itemId,
        item: { code: item?.code ?? '', nameAr: item?.nameAr ?? '' },
        qtyBase: v.qtyBase,
        qtyComposite: compositeQty(v.qtyBase, item),
        value: v.value,
        lastMovementAt: last,
        stagnant: last != null ? last < stale : true,
      };
    });
    rows.sort((a, b) => b.value - a.value);

    return { rows, totals: { items: rows.length, qtyBase: totalQty, value: totalValue } };
  }

  /** لوحة المؤشرات: أرقام اللحظة للمالك. */
  async summary(query: QueryReportSummaryDto, companyId: number | null = null) {
    const tenant = tenantWhere(companyId);
    const dateFilter: Record<string, Date> = {};
    if (query.from) dateFilter.gte = new Date(`${query.from}T00:00:00Z`);
    if (query.to) dateFilter.lte = new Date(`${query.to}T23:59:59Z`);

    const [salesRows, saleCount, returnRows, returnCount, receipts, rCount, payments, pCount, pending, activeStocks, lowStockCount, balancesCount, itemCount] =
      await Promise.all([
        this.prisma.priceStatement.findMany({ where: { ...tenant, ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}) }, select: { net: true } }),
        this.prisma.priceStatement.count({ where: { ...tenant, ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}) } }),
        this.prisma.returnStatement.findMany({ where: { ...tenant, ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}) }, select: { total: true } }),
        this.prisma.returnStatement.count({ where: { ...tenant, ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}) } }),
        this.prisma.receipt.findMany({ where: { ...tenant, ...(query.from || query.to ? { receivedAt: dateFilter } : {}) }, select: { amount: true } }),
        this.prisma.receipt.count({ where: { ...tenant, ...(query.from || query.to ? { receivedAt: dateFilter } : {}) } }),
        this.prisma.payment.findMany({ where: { ...tenant, ...(query.from || query.to ? { paidAt: dateFilter } : {}) }, select: { amount: true } }),
        this.prisma.payment.count({ where: { ...tenant, ...(query.from || query.to ? { paidAt: dateFilter } : {}) } }),
        this.prisma.approval.count({ where: { status: 'PENDING', ...tenant } }),
        this.prisma.stocktakeSession.count({ where: { status: { in: [...ACTIVE_STOCKTAKE] }, ...tenant } }),
        this.lowStock(companyId),
        this.prisma.stockBalance.count({ where: { ...tenant } }),
        this.prisma.item.count({ where: { active: true, ...tenant } }),
      ]);

    const sum = (arr: { amount?: unknown; net?: unknown; total?: unknown }[], key: 'amount' | 'net' | 'total') =>
      roundMoney(arr.reduce((a, r) => a + Number(r[key as keyof typeof r] ?? 0), 0));

    const [topItems, topCustomers] = await Promise.all([
      this.prisma.priceStatementLine.groupBy({
        by: ['itemId'],
        where: { statement: { ...tenant, ...(query.from || query.to ? { date: dateFilter } : {}) } },
        _sum: { qtyBase: true },
      }),
      this.prisma.priceStatement.groupBy({
        by: ['customerId'],
        where: { ...tenant, ...(query.from || query.to ? { date: dateFilter } : {}) },
        _sum: { net: true },
      }),
    ]);

    const topItemRows = await this.prisma.item.findMany({
      where: { id: { in: topItems.map((t) => t.itemId) }, ...tenant },
      select: { id: true, code: true, nameAr: true },
    });
    const topCustomerRows = await this.prisma.customer.findMany({
      where: { id: { in: topCustomers.map((t) => t.customerId) }, ...tenant },
      select: { id: true, code: true, nameAr: true },
    });

    return {
      period: { from: query.from ?? null, to: query.to ?? null },
      sales: { count: saleCount, net: sum(salesRows, 'net') },
      returns: { count: returnCount, total: sum(returnRows, 'total') },
      receipts: { count: rCount, amount: sum(receipts, 'amount') },
      payments: { count: pCount, amount: sum(payments, 'amount') },
      pendingApprovals: pending,
      activeStocktakes: activeStocks,
      lowStockCount: lowStockCount.count,
      balancesCount,
      itemCount,
      topItems: await Promise.all(
        topItems
          .slice(0, 5)
          .map(async (t) => {
            const it = topItemRows.find((i) => i.id === t.itemId);
            return { item: it, qtyBase: roundQty(Number(t._sum.qtyBase ?? 0)) };
          }),
      ),
      topCustomers: await Promise.all(
        topCustomers.slice(0, 5).map(async (t) => {
          const c = topCustomerRows.find((x) => x.id === t.customerId);
          return { customer: c, net: roundMoney(Number(t._sum.net ?? 0)) };
        }),
      ),
    };
  }

  /** بنود المبيعات المعتمدة ضمن الفترة (يشمل حقول التكلفة لحساب أرباح من يملك cost.view). */
  private async loadSales(query: { from?: string; to?: string }, companyId: number | null) {
    const where: Prisma.PriceStatementWhereInput = { ...tenantWhere(companyId), status: 'APPROVED' };
    if (query.from || query.to) {
      const date: { gte?: Date; lte?: Date } = {};
      if (query.from) date.gte = new Date(`${query.from}T00:00:00Z`);
      if (query.to) date.lte = new Date(`${query.to}T23:59:59.999Z`);
      where.date = date;
    }
    return this.prisma.priceStatement.findMany({
      where,
      select: {
        id: true,
        date: true,
        customerId: true,
        repId: true,
        warehouseId: true,
        createdById: true,
        discountAmount: true,
        shipping: true,
        taxAmount: true,
        net: true,
        lines: {
          select: {
            itemId: true,
            qty: true,
            unitPrice: true,
            qtyBase: true,
            netLine: true,
            lineDiscountAmount: true,
            allocatedHeaderDiscount: true,
            costSnapshot: true,
            item: { select: { categoryId: true, brandId: true } },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * تقرير المبيعات حسب الفترة (§5.14 — يومي/شهري):
   * لكل فترة: عدد الفواتير، الكميات، الإجمالي قبل الخصم، الخصم، صافي البضاعة، الضريبة، النقل، الإجمالي.
   * الأرباح (cost/profit) تُدرج فقط لمن يملك صلاحية رؤية التكلفة.
   */
  async salesSummary(query: QuerySalesSummaryDto, companyId: number | null = null, canViewCost = false) {
    const statements = await this.loadSales(query, companyId);
    const groupBy = query.groupBy ?? 'day';

    type Bucket = { period: string; count: number; qtyBase: number; gross: number; discount: number; net: number; tax: number; shipping: number; total: number; cost: number };
    const buckets = new Map<string, Bucket>();
    const grand: Bucket = { period: '', count: 0, qtyBase: 0, gross: 0, discount: 0, net: 0, tax: 0, shipping: 0, total: 0, cost: 0 };

    for (const s of statements) {
      const period = groupBy === 'month' ? s.date.toISOString().slice(0, 7) : s.date.toISOString().slice(0, 10);
      const b = buckets.get(period) ?? { period, count: 0, qtyBase: 0, gross: 0, discount: 0, net: 0, tax: 0, shipping: 0, total: 0, cost: 0 };

      let sQty = 0;
      let sGross = 0;
      let sNet = 0;
      let sCost = 0;
      for (const l of s.lines) {
        const q = roundQty(Number(l.qtyBase));
        sQty = roundQty(sQty + q);
        sGross = roundMoney(sGross + Number(l.qty) * Number(l.unitPrice));
        sNet = roundMoney(sNet + Number(l.netLine));
        sCost = roundMoney(sCost + (l.costSnapshot != null ? Number(l.costSnapshot) * q : 0));
      }
      const add = (t: Bucket) => {
        t.count += 1;
        t.qtyBase = roundQty(t.qtyBase + sQty);
        t.gross = roundMoney(t.gross + sGross);
        t.net = roundMoney(t.net + sNet);
        t.tax = roundMoney(t.tax + Number(s.taxAmount));
        t.shipping = roundMoney(t.shipping + Number(s.shipping));
        t.total = roundMoney(t.total + Number(s.net));
        t.cost = roundMoney(t.cost + sCost);
        t.discount = roundMoney(t.gross - t.net);
      };
      add(b);
      add(grand);
      buckets.set(period, b);
    }

    const shape = (t: Bucket) => ({
      count: t.count,
      qtyBase: t.qtyBase,
      gross: t.gross,
      discount: t.discount,
      net: t.net,
      tax: t.tax,
      shipping: t.shipping,
      total: t.total,
      ...(canViewCost ? { cost: t.cost, profit: roundMoney(t.net - t.cost) } : {}),
    });

    const rows = [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period)).map((t) => ({ period: t.period, ...shape(t) }));
    return { from: query.from ?? null, to: query.to ?? null, groupBy, rows, totals: { ...shape(grand), periods: rows.length } };
  }

  /**
   * تقرير المبيعات حسب بُعد (§5.14): الصنف/التصنيف/الماركة/العميل/المندوب/المخزن.
   * الرتب: الكميات الأساسية، الإجمالي قبل الخصم، الخصم، صافي البضاعة، والأرباح لمن يملك cost.view.
   */
  async salesBy(query: QuerySalesByDto, companyId: number | null = null, canViewCost = false) {
    const by = query.by;
    const statements = await this.loadSales(query, companyId);

    type Acc = { id: number | null; qtyBase: number; gross: number; net: number; cost: number };
    const acc = new Map<string, Acc>();
    for (const s of statements) {
      for (const l of s.lines) {
        let id: number | null;
        switch (by) {
          case 'item': id = l.itemId; break;
          case 'category': id = l.item.categoryId; break;
          case 'brand': id = l.item.brandId ?? null; break;
          case 'customer': id = s.customerId; break;
          case 'rep': id = s.repId ?? null; break;
          default: id = s.warehouseId; break;
        }
        const q = roundQty(Number(l.qtyBase));
        const key = String(id ?? 0);
        const a = acc.get(key) ?? { id, qtyBase: 0, gross: 0, net: 0, cost: 0 };
        a.qtyBase = roundQty(a.qtyBase + q);
        a.gross = roundMoney(a.gross + Number(l.qty) * Number(l.unitPrice));
        a.net = roundMoney(a.net + Number(l.netLine));
        a.cost = roundMoney(a.cost + (l.costSnapshot != null ? Number(l.costSnapshot) * q : 0));
        acc.set(key, a);
      }
    }

    const ids = [...acc.values()].map((a) => a.id).filter((v): v is number => v != null);
    let names = new Map<number, { code: string | null; name: string }>();
    if (by === 'item') {
      const rows = await this.prisma.item.findMany({ where: { id: { in: ids }, ...tenantWhere(companyId) }, select: { id: true, code: true, nameAr: true } });
      names = new Map(rows.map((r) => [r.id, { code: r.code, name: r.nameAr }]));
    } else if (by === 'category') {
      const rows = await this.prisma.category.findMany({ where: { id: { in: ids }, ...tenantWhere(companyId) }, select: { id: true, nameAr: true } });
      names = new Map(rows.map((r) => [r.id, { code: null, name: r.nameAr }]));
    } else if (by === 'brand') {
      const rows = await this.prisma.brand.findMany({ where: { id: { in: ids }, ...tenantWhere(companyId) }, select: { id: true, nameAr: true } });
      names = new Map(rows.map((r) => [r.id, { code: null, name: r.nameAr }]));
    } else if (by === 'customer') {
      const rows = await this.prisma.customer.findMany({ where: { id: { in: ids }, ...tenantWhere(companyId) }, select: { id: true, code: true, nameAr: true } });
      names = new Map(rows.map((r) => [r.id, { code: r.code, name: r.nameAr }]));
    } else if (by === 'rep') {
      const rows = await this.prisma.user.findMany({ where: { id: { in: ids }, ...tenantWhere(companyId) }, select: { id: true, name: true } });
      names = new Map(rows.map((r) => [r.id, { code: null, name: r.name }]));
    } else {
      const rows = await this.prisma.warehouse.findMany({ where: { id: { in: ids }, ...tenantWhere(companyId) }, select: { id: true, code: true, nameAr: true } });
      names = new Map(rows.map((r) => [r.id, { code: r.code, name: r.nameAr }]));
    }

    let rows = [...acc.values()].map((a) => {
      const meta = a.id != null ? names.get(a.id) : undefined;
      return {
        id: a.id,
        code: meta?.code ?? null,
        name: meta?.name ?? (a.id == null ? 'بدون' : `#${a.id}`),
        qtyBase: a.qtyBase,
        gross: a.gross,
        discount: roundMoney(a.gross - a.net),
        net: a.net,
        ...(canViewCost ? { cost: a.cost, profit: roundMoney(a.net - a.cost) } : {}),
      };
    });
    rows.sort((a, b) => b.net - a.net);
    if (query.limit) rows = rows.slice(0, query.limit);

    const tQty = roundQty([...acc.values()].reduce((s, a) => s + a.qtyBase, 0));
    const tGross = roundMoney([...acc.values()].reduce((s, a) => s + a.gross, 0));
    const tNet = roundMoney([...acc.values()].reduce((s, a) => s + a.net, 0));
    const tCost = roundMoney([...acc.values()].reduce((s, a) => s + a.cost, 0));
    return {
      by,
      from: query.from ?? null,
      to: query.to ?? null,
      rows,
      totals: {
        qtyBase: tQty,
        gross: tGross,
        discount: roundMoney(tGross - tNet),
        net: tNet,
        ...(canViewCost ? { cost: tCost, profit: roundMoney(tNet - tCost) } : {}),
      },
    };
  }

  /** إجمالي الخصومات حسب المستخدم (منشئ البيان) / المندوب / الصنف (§5.14). */
  async discountsBy(query: QueryDiscountsDto, companyId: number | null = null) {
    const by = query.by;
    const statements = await this.loadSales(query, companyId);

    type Acc = { id: number | null; count: number; qtyBase: number; net: number; discount: number };
    const acc = new Map<string, Acc>();
    const add = (id: number | null, qty: number, net: number, discount: number, count: number) => {
      const key = String(id ?? 0);
      const a = acc.get(key) ?? { id, count: 0, qtyBase: 0, net: 0, discount: 0 };
      a.count += count;
      a.qtyBase = roundQty(a.qtyBase + qty);
      a.net = roundMoney(a.net + net);
      a.discount = roundMoney(a.discount + discount);
      acc.set(key, a);
    };

    for (const s of statements) {
      if (by === 'item') {
        for (const l of s.lines) {
          const q = roundQty(Number(l.qtyBase));
          const disc = roundMoney(Number(l.lineDiscountAmount) + Number(l.allocatedHeaderDiscount));
          add(l.itemId, q, roundMoney(Number(l.netLine)), disc, 1);
        }
      } else {
        const q = roundQty(s.lines.reduce((sum, l) => sum + Number(l.qtyBase), 0));
        const net = roundMoney(s.lines.reduce((sum, l) => sum + Number(l.netLine), 0));
        const disc = roundMoney(Number(s.discountAmount) + s.lines.reduce((sum, l) => sum + Number(l.lineDiscountAmount), 0));
        add(by === 'user' ? s.createdById : s.repId ?? null, q, net, disc, 1);
      }
    }

    const ids = [...acc.values()].map((a) => a.id).filter((v): v is number => v != null);
    let names = new Map<number, { code: string | null; name: string }>();
    if (by === 'item') {
      const rows = await this.prisma.item.findMany({ where: { id: { in: ids }, ...tenantWhere(companyId) }, select: { id: true, code: true, nameAr: true } });
      names = new Map(rows.map((r) => [r.id, { code: r.code, name: r.nameAr }]));
    } else {
      const rows = await this.prisma.user.findMany({ where: { id: { in: ids }, ...tenantWhere(companyId) }, select: { id: true, name: true } });
      names = new Map(rows.map((r) => [r.id, { code: null, name: r.name }]));
    }

    const rows = [...acc.values()]
      .map((a) => {
        const meta = a.id != null ? names.get(a.id) : undefined;
        const net = a.net;
        return {
          id: a.id,
          code: meta?.code ?? null,
          name: meta?.name ?? (a.id == null ? 'بدون' : `#${a.id}`),
          count: a.count,
          qtyBase: a.qtyBase,
          net,
          discount: a.discount,
          discountPct: net + a.discount !== 0 ? roundMoney(((a.discount / (net + a.discount)) * 100)) : 0,
        };
      })
      .sort((a, b) => b.discount - a.discount);

    const totals = {
      count: rows.reduce((s, r) => s + r.count, 0),
      qtyBase: roundQty(rows.reduce((s, r) => s + r.qtyBase, 0)),
      net: roundMoney(rows.reduce((s, r) => s + r.net, 0)),
      discount: roundMoney(rows.reduce((s, r) => s + r.discount, 0)),
    };
    return { by, from: query.from ?? null, to: query.to ?? null, rows, totals };
  }

  /** الخصومات المتجاوزة وطلبات اعتمادها (§5.14) — طلبات ITEM_DISCOUNT/HEADER_DISCOUNT. */
  async discountApprovals(query: QueryDiscountApprovalsDto, companyId: number | null = null) {
    const where: Prisma.ApprovalWhereInput = { ...tenantWhere(companyId), type: { in: ['ITEM_DISCOUNT', 'HEADER_DISCOUNT'] } };
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      const date: { gte?: Date; lte?: Date } = {};
      if (query.from) date.gte = new Date(`${query.from}T00:00:00Z`);
      if (query.to) date.lte = new Date(`${query.to}T23:59:59.999Z`);
      where.createdAt = date;
    }

    const rows = await this.prisma.approval.findMany({
      where,
      include: {
        requestedBy: { select: { id: true, name: true } },
        decidedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit ?? 200,
    });

    const items = rows.map((a) => ({
      id: a.id,
      type: a.type,
      status: a.status,
      refType: a.refType,
      refId: a.refId,
      requestedBy: a.requestedBy?.name ?? null,
      decidedBy: a.decidedBy?.name ?? null,
      decidedAt: a.decidedAt,
      note: a.note,
      details: a.refJson,
      createdAt: a.createdAt,
    }));

    const counts = await this.prisma.approval.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
    const byStatus: Record<string, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    for (const c of counts) byStatus[c.status] = c._count._all;

    return { from: query.from ?? null, to: query.to ?? null, status: query.status ?? null, count: items.length, byStatus, rows: items };
  }

  /** ملاحظات الوزن الفعلي لأصناف الحديد (§5.2): بنود البيانات التي حملت ملاحظة وزن. */
  async weightNotes(query: QueryWeightNotesDto, companyId: number | null = null) {
    const statementWhere: Prisma.PriceStatementWhereInput = {
      ...tenantWhere(companyId),
      status: query.status ? query.status : { not: 'CANCELLED' },
    };
    if (query.customerId) statementWhere.customerId = query.customerId;
    if (query.from || query.to) {
      const date: { gte?: Date; lte?: Date } = {};
      if (query.from) date.gte = new Date(`${query.from}T00:00:00Z`);
      if (query.to) date.lte = new Date(`${query.to}T23:59:59.999Z`);
      statementWhere.date = date;
    }
    const where: Prisma.PriceStatementLineWhereInput = {
      statement: statementWhere,
      OR: [{ weightNote: { not: null } }, { actualWeight: { not: null } }],
    };
    if (query.itemId) where.itemId = query.itemId;

    const lines = await this.prisma.priceStatementLine.findMany({
      where,
      include: {
        item: { select: { id: true, code: true, nameAr: true } },
        unit: { select: { code: true, nameAr: true } },
        statement: {
          select: {
            id: true,
            number: true,
            date: true,
            status: true,
            customer: { select: { id: true, code: true, nameAr: true } },
          },
        },
      },
      orderBy: [{ statement: { date: 'desc' } }, { id: 'desc' }],
      take: query.limit ?? 500,
    });

    const rows = lines
      .filter((l) => (l.weightNote ?? '').trim().length > 0 || l.actualWeight != null)
      .map((l) => ({
        lineId: l.id,
        statementId: l.statement.id,
        number: l.statement.number,
        date: l.statement.date,
        status: l.statement.status,
        customerId: l.statement.customer.id,
        customerCode: l.statement.customer.code,
        customerName: l.statement.customer.nameAr,
        itemId: l.item.id,
        itemCode: l.item.code,
        itemName: l.item.nameAr,
        unit: l.unit.code,
        unitName: l.unit.nameAr,
        qty: Number(l.qty),
        qtyBase: Number(l.qtyBase),
        weightNote: l.weightNote,
        actualWeight: l.actualWeight != null ? Number(l.actualWeight) : null,
        weightDelta: weightDeltaOf(l.actualWeight != null ? Number(l.actualWeight) : null, Number(l.qtyBase)),
      }));

    return {
      from: query.from ?? null,
      to: query.to ?? null,
      status: query.status ?? null,
      count: rows.length,
      rows,
    };
  }

  /** مرتجعات حسب العميل/المندوب/السبب/الصنف ونسبة المرتجع إلى المبيعات (§5.14). */
  async returnsBy(query: QueryReturnsDto, companyId: number | null = null) {
    const by = query.by;
    const range: { gte?: Date; lte?: Date } = {};
    if (query.from) range.gte = new Date(`${query.from}T00:00:00Z`);
    if (query.to) range.lte = new Date(`${query.to}T23:59:59.999Z`);
    const hasRange = query.from != null || query.to != null;

    const where: Prisma.ReturnStatementWhereInput = { ...tenantWhere(companyId), status: 'APPROVED', ...(hasRange ? { date: range } : {}) };
    const returns = await this.prisma.returnStatement.findMany({
      where,
      select: {
        id: true,
        customerId: true,
        repId: true,
        reasonId: true,
        total: true,
        lines: { select: { itemId: true, qtyBase: true, lineTotal: true } },
      },
    });

    type Acc = { id: number | null; count: number; qtyBase: number; total: number };
    const acc = new Map<string, Acc>();
    const add = (id: number | null, qty: number, total: number, count: number) => {
      const key = String(id ?? 0);
      const a = acc.get(key) ?? { id, count: 0, qtyBase: 0, total: 0 };
      a.count += count;
      a.qtyBase = roundQty(a.qtyBase + qty);
      a.total = roundMoney(a.total + total);
      acc.set(key, a);
    };

    let grandCount = 0;
    let grandQty = 0;
    let grandTotal = 0;
    for (const r of returns) {
      const rQty = roundQty(r.lines.reduce((s, l) => s + Number(l.qtyBase), 0));
      const rTotal = roundMoney(Number(r.total));
      grandCount += 1;
      grandQty = roundQty(grandQty + rQty);
      grandTotal = roundMoney(grandTotal + rTotal);
      if (by === 'item') {
        for (const l of r.lines) add(l.itemId, roundQty(Number(l.qtyBase)), roundMoney(Number(l.lineTotal)), 1);
      } else {
        const id = by === 'customer' ? r.customerId : by === 'rep' ? r.repId ?? null : r.reasonId ?? null;
        add(id, rQty, rTotal, 1);
      }
    }

    const ids = [...acc.values()].map((a) => a.id).filter((v): v is number => v != null);
    let names = new Map<number, { code: string | null; name: string }>();
    if (by === 'customer') {
      const rows = await this.prisma.customer.findMany({ where: { id: { in: ids }, ...tenantWhere(companyId) }, select: { id: true, code: true, nameAr: true } });
      names = new Map(rows.map((r) => [r.id, { code: r.code, name: r.nameAr }]));
    } else if (by === 'rep') {
      const rows = await this.prisma.user.findMany({ where: { id: { in: ids }, ...tenantWhere(companyId) }, select: { id: true, name: true } });
      names = new Map(rows.map((r) => [r.id, { code: null, name: r.name }]));
    } else if (by === 'reason') {
      const rows = await this.prisma.returnReason.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, nameAr: true } });
      names = new Map(rows.map((r) => [r.id, { code: r.code, name: r.nameAr }]));
    } else {
      const rows = await this.prisma.item.findMany({ where: { id: { in: ids }, ...tenantWhere(companyId) }, select: { id: true, code: true, nameAr: true } });
      names = new Map(rows.map((r) => [r.id, { code: r.code, name: r.nameAr }]));
    }

    const salesWhere: Prisma.PriceStatementWhereInput = { ...tenantWhere(companyId), status: 'APPROVED', ...(hasRange ? { date: range } : {}) };
    const salesAgg = await this.prisma.priceStatement.aggregate({ where: salesWhere, _sum: { net: true } });
    const salesTotal = roundMoney(Number(salesAgg._sum.net ?? 0));

    const rows = [...acc.values()]
      .map((a) => {
        const meta = a.id != null ? names.get(a.id) : undefined;
        return {
          id: a.id,
          code: meta?.code ?? null,
          name: meta?.name ?? (a.id == null ? 'بدون' : `#${a.id}`),
          count: a.count,
          qtyBase: a.qtyBase,
          total: a.total,
          sharePct: grandTotal !== 0 ? roundMoney((a.total / grandTotal) * 100) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    return {
      by,
      from: query.from ?? null,
      to: query.to ?? null,
      rows,
      totals: {
        count: grandCount,
        qtyBase: grandQty,
        total: grandTotal,
        salesTotal,
        ratioPct: salesTotal !== 0 ? roundMoney((grandTotal / salesTotal) * 100) : 0,
      },
    };
  }

  /** العملاء المتوقفون: لم يتم البيع لهم خلال آخر N يوم (§5.14). */
  async stoppedCustomers(query: QueryStoppedCustomersDto, companyId: number | null = null) {
    const days = query.days ?? 30;
    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 86_400_000);

    const customerWhere: Prisma.CustomerWhereInput = { ...tenantWhere(companyId) };
    if (query.repId != null) customerWhere.repId = query.repId;
    const customers = await this.prisma.customer.findMany({
      where: customerWhere,
      select: { id: true, code: true, nameAr: true, phone: true, repId: true, active: true },
    });

    const grouped = await this.prisma.priceStatement.groupBy({
      by: ['customerId'],
      where: { ...tenantWhere(companyId), status: 'APPROVED', customerId: { in: customers.map((c) => c.id) } },
      _max: { date: true },
    });
    const lastSale = new Map<number, Date>();
    for (const g of grouped) {
      if (g.customerId != null && g._max.date) lastSale.set(g.customerId, g._max.date);
    }

    const repIds = [...new Set(customers.map((c) => c.repId).filter((v): v is number => v != null))];
    const reps = repIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: repIds }, ...tenantWhere(companyId) }, select: { id: true, name: true } })
      : [];
    const repName = new Map(reps.map((r) => [r.id, r.name]));

    let rows = customers
      .map((c) => {
        const last = lastSale.get(c.id) ?? null;
        const daysSince = last ? Math.floor((now.getTime() - last.getTime()) / 86_400_000) : null;
        return {
          id: c.id,
          code: c.code,
          name: c.nameAr,
          phone: c.phone,
          active: c.active,
          repId: c.repId,
          repName: c.repId != null ? repName.get(c.repId) ?? null : null,
          lastSaleDate: last ? last.toISOString().slice(0, 10) : null,
          daysSince,
        };
      })
      .filter((r) => r.lastSaleDate != null && r.daysSince != null && r.daysSince >= days)
      .sort((a, b) => (b.daysSince ?? 0) - (a.daysSince ?? 0));
    if (query.limit != null) rows = rows.slice(0, query.limit);

    return {
      days,
      cutoff: cutoff.toISOString().slice(0, 10),
      rows,
      totals: { count: rows.length, scanned: customers.length },
    };
  }

  /** فروقات الجرد: النظام مقابل المعدود وقيمة الفرق (§5.14). */
  async stocktakeDiff(query: QueryStocktakeDiffDto, companyId: number | null = null) {
    const onlyDiff = query.onlyDiff ?? true;
    const sessionWhere: Prisma.StocktakeSessionWhereInput = { ...tenantWhere(companyId) };
    if (query.sessionId != null) sessionWhere.id = query.sessionId;
    if (query.warehouseId != null) sessionWhere.warehouseId = query.warehouseId;
    const range: { gte?: Date; lte?: Date } = {};
    if (query.from) range.gte = new Date(`${query.from}T00:00:00Z`);
    if (query.to) range.lte = new Date(`${query.to}T23:59:59.999Z`);
    if (query.from != null || query.to != null) sessionWhere.openedAt = range;

    const lines = await this.prisma.stocktakeLine.findMany({
      where: { session: sessionWhere },
      select: {
        sessionId: true,
        itemId: true,
        systemQtyBase: true,
        countedQtyBase: true,
        diffQty: true,
        lastCost: true,
        diffValue: true,
        session: { select: { number: true, status: true, warehouse: { select: { code: true, nameAr: true } } } },
        item: { select: { code: true, nameAr: true } },
      },
    });

    type Acc = {
      sessionId: number;
      sessionNumber: string;
      status: string;
      warehouse: string;
      itemId: number;
      code: string;
      name: string;
      systemQtyBase: number;
      countedQtyBase: number | null;
      anyCounted: boolean;
      diffQty: number;
      diffValue: number;
      lastCost: number | null;
    };
    const acc = new Map<string, Acc>();
    for (const l of lines) {
      const key = `${l.sessionId}:${l.itemId}`;
      const system = Number(l.systemQtyBase);
      const counted = l.countedQtyBase != null ? Number(l.countedQtyBase) : null;
      const diffQty = l.diffQty != null ? Number(l.diffQty) : counted != null ? roundQty(counted - system) : 0;
      const diffValue = l.diffValue != null ? Number(l.diffValue) : roundMoney(diffQty * (l.lastCost != null ? Number(l.lastCost) : 0));
      const a = acc.get(key) ?? {
        sessionId: l.sessionId,
        sessionNumber: l.session.number,
        status: l.session.status,
        warehouse: l.session.warehouse?.nameAr ?? '',
        itemId: l.itemId,
        code: l.item.code,
        name: l.item.nameAr,
        systemQtyBase: 0,
        countedQtyBase: null,
        anyCounted: false,
        diffQty: 0,
        diffValue: 0,
        lastCost: l.lastCost != null ? Number(l.lastCost) : null,
      };
      a.systemQtyBase = roundQty(a.systemQtyBase + system);
      if (counted != null) {
        a.countedQtyBase = roundQty((a.countedQtyBase ?? 0) + counted);
        a.anyCounted = true;
      }
      a.diffQty = roundQty(a.diffQty + diffQty);
      a.diffValue = roundMoney(a.diffValue + diffValue);
      acc.set(key, a);
    }

    const all = [...acc.values()];
    const totals = {
      sessions: new Set(all.map((a) => a.sessionId)).size,
      lines: all.length,
      diffLines: all.filter((a) => a.diffQty !== 0).length,
      surplusQty: roundQty(all.reduce((s, a) => s + (a.diffQty > 0 ? a.diffQty : 0), 0)),
      shortageQty: roundQty(all.reduce((s, a) => s + (a.diffQty < 0 ? a.diffQty : 0), 0)),
      surplusValue: roundMoney(all.reduce((s, a) => s + (a.diffValue > 0 ? a.diffValue : 0), 0)),
      shortageValue: roundMoney(all.reduce((s, a) => s + (a.diffValue < 0 ? a.diffValue : 0), 0)),
      netValue: roundMoney(all.reduce((s, a) => s + a.diffValue, 0)),
    };

    let rows = all
      .filter((a) => (onlyDiff ? a.diffQty !== 0 : true))
      .map((a) => ({
        sessionId: a.sessionId,
        sessionNumber: a.sessionNumber,
        status: a.status,
        warehouse: a.warehouse,
        itemId: a.itemId,
        code: a.code,
        name: a.name,
        systemQtyBase: a.systemQtyBase,
        countedQtyBase: a.anyCounted ? a.countedQtyBase : null,
        diffQty: a.diffQty,
        lastCost: a.lastCost,
        diffValue: a.diffValue,
      }))
      .sort((x, y) => Math.abs(y.diffValue) - Math.abs(x.diffValue));
    if (query.limit != null) rows = rows.slice(0, query.limit);

    return {
      onlyDiff,
      from: query.from ?? null,
      to: query.to ?? null,
      rows,
      totals,
    };
  }

  /** مديونية الموردين: الرصيد الافتتاحي + المشتريات − المدفوع (§5.14). */
  async supplierDebt(query: QuerySupplierDebtDto, companyId: number | null = null) {
    const asOf = query.asOf ? new Date(`${query.asOf}T23:59:59.999Z`) : new Date();
    const onlyOutstanding = query.onlyOutstanding ?? true;

    const suppliers = await this.prisma.supplier.findMany({
      where: { ...tenantWhere(companyId) },
      select: { id: true, code: true, nameAr: true, phone: true, openingBalance: true, active: true },
    });

    const purch = await this.prisma.purchaseStatement.groupBy({
      by: ['supplierId'],
      where: { ...tenantWhere(companyId), status: 'APPROVED', date: { lte: asOf } },
      _sum: { net: true, paid: true },
      _max: { date: true },
    });
    const purchMap = new Map(
      purch.map((p) => [p.supplierId, { net: Number(p._sum.net ?? 0), paid: Number(p._sum.paid ?? 0), last: p._max.date ?? null }]),
    );

    const payAgg = await this.prisma.payment.groupBy({
      by: ['supplierId'],
      where: { ...tenantWhere(companyId), paidAt: { lte: asOf } },
      _sum: { amount: true },
    });
    const payMap = new Map(payAgg.map((p) => [p.supplierId, Number(p._sum.amount ?? 0)]));

    let rows = suppliers
      .map((s) => {
        const pm = purchMap.get(s.id);
        const opening = Number(s.openingBalance);
        const purchases = roundMoney(pm?.net ?? 0);
        const paid = roundMoney(pm?.paid ?? 0);
        const payments = roundMoney(payMap.get(s.id) ?? 0);
        const last = pm?.last ?? null;
        return {
          id: s.id,
          code: s.code,
          name: s.nameAr,
          phone: s.phone,
          active: s.active,
          openingBalance: roundMoney(opening),
          purchases,
          paid,
          payments,
          balance: roundMoney(opening + purchases - paid),
          lastPurchaseDate: last ? last.toISOString().slice(0, 10) : null,
        };
      })
      .filter((r) => (onlyOutstanding ? r.balance > 0 : true))
      .sort((a, b) => b.balance - a.balance);
    if (query.limit != null) rows = rows.slice(0, query.limit);

    return {
      asOf: asOf.toISOString().slice(0, 10),
      onlyOutstanding,
      rows,
      totals: {
        suppliers: rows.length,
        openingBalance: roundMoney(rows.reduce((s, r) => s + r.openingBalance, 0)),
        purchases: roundMoney(rows.reduce((s, r) => s + r.purchases, 0)),
        paid: roundMoney(rows.reduce((s, r) => s + r.paid, 0)),
        payments: roundMoney(rows.reduce((s, r) => s + r.payments, 0)),
        balance: roundMoney(rows.reduce((s, r) => s + r.balance, 0)),
      },
    };
  }

  /** أداء المناديب: الأهداف والتحصيل والزيارات والمسافات (§5.14). */
  async repPerformance(query: QueryRepPerformanceDto, companyId: number | null = null) {
    const now = new Date();
    const from = query.from
      ? new Date(`${query.from}T00:00:00Z`)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : now;

    const repWhere: Prisma.UserWhereInput = { ...tenantWhere(companyId), repCode: { not: null } };
    if (query.repId != null) repWhere.id = query.repId;
    const reps = await this.prisma.user.findMany({ where: repWhere, select: { id: true, name: true, repCode: true } });
    const repIds = reps.map((r) => r.id);

    const round2 = (n: number) => Math.round(n * 100) / 100;

    if (repIds.length === 0) {
      return {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        rows: [],
        totals: { reps: 0, targetAmount: 0, achievedAmount: 0, commissionDue: 0, salesNet: 0, salesCount: 0, collected: 0, visits: 0, distanceKm: 0 },
      };
    }

    const [targets, salesAgg, customers, visitAgg, points] = await Promise.all([
      this.prisma.repTarget.findMany({
        where: { ...tenantWhere(companyId), repId: { in: repIds }, active: true, fromDate: { lte: to }, toDate: { gte: from } },
        select: { repId: true, targetAmount: true, achievedAmount: true, commissionDue: true },
      }),
      this.prisma.priceStatement.groupBy({
        by: ['repId'],
        where: { ...tenantWhere(companyId), status: 'APPROVED', repId: { in: repIds }, date: { gte: from, lte: to } },
        _sum: { net: true },
        _count: { _all: true },
      }),
      this.prisma.customer.findMany({ where: { ...tenantWhere(companyId), repId: { in: repIds } }, select: { id: true, repId: true } }),
      this.prisma.repVisit.groupBy({
        by: ['repId', 'status'],
        where: { ...tenantWhere(companyId), repId: { in: repIds }, at: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      this.prisma.repLocation.findMany({
        where: { ...tenantWhere(companyId), repId: { in: repIds }, capturedAt: { gte: from, lte: to } },
        orderBy: [{ repId: 'asc' }, { capturedAt: 'asc' }],
        select: { repId: true, lat: true, lng: true },
      }),
    ]);

    const targetMap = new Map<number, { target: number; achieved: number; commission: number }>();
    for (const t of targets) {
      const e = targetMap.get(t.repId) ?? { target: 0, achieved: 0, commission: 0 };
      e.target = roundMoney(e.target + Number(t.targetAmount));
      e.achieved = roundMoney(e.achieved + Number(t.achievedAmount));
      e.commission = roundMoney(e.commission + Number(t.commissionDue));
      targetMap.set(t.repId, e);
    }

    const salesMap = new Map<number, { net: number; count: number }>();
    for (const s of salesAgg) {
      if (s.repId == null) continue;
      salesMap.set(s.repId, { net: roundMoney(Number(s._sum.net ?? 0)), count: s._count._all });
    }

    const custRep = new Map<number, number>();
    for (const c of customers) if (c.repId != null) custRep.set(c.id, c.repId);
    const collectByRep = new Map<number, number>();
    const custIds = [...custRep.keys()];
    if (custIds.length > 0) {
      const receipts = await this.prisma.receipt.groupBy({
        by: ['customerId'],
        where: { ...tenantWhere(companyId), customerId: { in: custIds }, receivedAt: { gte: from, lte: to } },
        _sum: { amount: true },
      });
      for (const r of receipts) {
        const rep = custRep.get(r.customerId);
        if (rep == null) continue;
        collectByRep.set(rep, roundMoney((collectByRep.get(rep) ?? 0) + Number(r._sum.amount ?? 0)));
      }
    }

    const visitMap = new Map<number, { total: number; done: number; missed: number }>();
    for (const v of visitAgg) {
      const e = visitMap.get(v.repId) ?? { total: 0, done: 0, missed: 0 };
      e.total += v._count._all;
      if (v.status === 'DONE') e.done += v._count._all;
      else e.missed += v._count._all;
      visitMap.set(v.repId, e);
    }

    const distByRep = new Map<number, number>();
    let prev: { repId: number; lat: number; lng: number } | null = null;
    for (const p of points) {
      const cur = { repId: p.repId, lat: Number(p.lat), lng: Number(p.lng) };
      if (prev && prev.repId === cur.repId) {
        distByRep.set(cur.repId, (distByRep.get(cur.repId) ?? 0) + haversineM(prev.lat, prev.lng, cur.lat, cur.lng));
      }
      prev = cur;
    }

    let rows = reps.map((r) => {
      const t = targetMap.get(r.id);
      const s = salesMap.get(r.id);
      const col = collectByRep.get(r.id) ?? 0;
      const v = visitMap.get(r.id);
      const salesNet = s?.net ?? 0;
      const target = t?.target ?? 0;
      return {
        repId: r.id,
        repCode: r.repCode,
        name: r.name,
        targetAmount: target,
        achievedAmount: t?.achieved ?? 0,
        commissionDue: t?.commission ?? 0,
        salesNet,
        salesCount: s?.count ?? 0,
        collected: col,
        collectionRatePct: salesNet > 0 ? roundMoney((col / salesNet) * 100) : 0,
        visits: v?.total ?? 0,
        visitsDone: v?.done ?? 0,
        visitsMissed: v?.missed ?? 0,
        distanceKm: round2((distByRep.get(r.id) ?? 0) / 1000),
        achievementPct: target > 0 ? roundMoney((salesNet / target) * 100) : 0,
      };
    });
    rows = rows.sort((a, b) => b.salesNet - a.salesNet);
    if (query.limit != null) rows = rows.slice(0, query.limit);

    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      rows,
      totals: {
        reps: rows.length,
        targetAmount: roundMoney(rows.reduce((s, r) => s + r.targetAmount, 0)),
        achievedAmount: roundMoney(rows.reduce((s, r) => s + r.achievedAmount, 0)),
        commissionDue: roundMoney(rows.reduce((s, r) => s + r.commissionDue, 0)),
        salesNet: roundMoney(rows.reduce((s, r) => s + r.salesNet, 0)),
        salesCount: rows.reduce((s, r) => s + r.salesCount, 0),
        collected: roundMoney(rows.reduce((s, r) => s + r.collected, 0)),
        visits: rows.reduce((s, r) => s + r.visits, 0),
        distanceKm: round2(rows.reduce((s, r) => s + r.distanceKm, 0)),
      },
    };
  }

  toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');
  }

  /** أعمار الديون (FIFO): كل سند قبض يُخصم من أقدم فاتورة مفتوحة، والمتبقي يُقسّم على فترات 0-30/31-60/61-90/+90 */
  async aging(query: QueryAgingDto, companyId: number | null = null) {
    const asOf = query.asOf ? new Date(query.asOf + 'T23:59:59.999Z') : new Date();
    const d1 = query.days1 ?? 30;
    const d2 = query.days2 ?? 60;
    const d3 = query.days3 ?? 90;

    const customers = await this.prisma.customer.findMany({
      where: { ...tenantWhere(companyId) },
      select: { id: true, code: true, nameAr: true, openingBalance: true },
    });
    const ids = customers.map((c) => c.id);
    if (ids.length === 0) {
      return this.agingResult(asOf, d1, d2, d3, [], query);
    }

    const entries = await this.prisma.ledgerEntry.findMany({
      where: { accountType: 'CUSTOMER', accountId: { in: ids }, entryDate: { lte: asOf }, ...tenantWhere(companyId) },
      select: { accountId: true, entryDate: true, debit: true, credit: true },
      orderBy: [{ entryDate: 'asc' }, { id: 'asc' }],
    });

    type Lot = { date: Date; amount: number };
    const open = new Map<number, Lot[]>();
    const byId = new Map(customers.map((c) => [c.id, c]));

    // الرصيد الافتتاحي يُعامَل كأقدم دين مفتوح
    for (const c of customers) {
      const ob = Number(c.openingBalance ?? 0);
      if (ob > 0) {
        open.set(c.id, [{ date: new Date(0), amount: ob }]);
      }
    }

    for (const e of entries) {
      const debit = Number(e.debit ?? 0);
      const credit = Number(e.credit ?? 0);
      const lots = open.get(e.accountId) ?? [];
      if (debit > 0) lots.push({ date: e.entryDate, amount: debit });
      let toPay = credit;
      while (toPay > 0 && lots.length > 0) {
        const head = lots[0]!;
        const used = Math.min(head.amount, toPay);
        head.amount -= used;
        toPay -= used;
        if (head.amount <= 0.005) lots.shift();
      }
      open.set(e.accountId, lots);
    }

    const rows: {
      customer: { id: number; code: string; nameAr: string };
      balance: number;
      current: number;
      b31: number;
      b61: number;
      b91: number;
    }[] = [];
    for (const [id, lots] of open) {
      const c = byId.get(id);
      if (!c) continue;
      let balance = 0;
      let current = 0;
      let b31 = 0;
      let b61 = 0;
      let b91 = 0;
      for (const lot of lots) {
        if (lot.amount <= 0) continue;
        const age = Math.floor((asOf.getTime() - lot.date.getTime()) / 86400000);
        balance += lot.amount;
        if (age <= d1) current += lot.amount;
        else if (age <= d2) b31 += lot.amount;
        else if (age <= d3) b61 += lot.amount;
        else b91 += lot.amount;
      }
      if (balance > 0.005) {
        rows.push({
          customer: { id: c.id, code: c.code, nameAr: c.nameAr },
          balance: roundMoney(balance),
          current: roundMoney(current),
          b31: roundMoney(b31),
          b61: roundMoney(b61),
          b91: roundMoney(b91),
        });
      }
    }
    rows.sort((a, b) => b.balance - a.balance);
    return this.agingResult(asOf, d1, d2, d3, rows, query);
  }

  private agingResult(
    asOf: Date,
    d1: number,
    d2: number,
    d3: number,
    rows: {
      customer: { id: number; code: string; nameAr: string };
      balance: number;
      current: number;
      b31: number;
      b61: number;
      b91: number;
    }[],
    query: QueryAgingDto,
  ) {
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 1000;
    const items = rows.slice(offset, offset + limit);
    const totals = rows.reduce(
      (acc, r) => ({
        balance: acc.balance + r.balance,
        current: acc.current + r.current,
        b31: acc.b31 + r.b31,
        b61: acc.b61 + r.b61,
        b91: acc.b91 + r.b91,
      }),
      { balance: 0, current: 0, b31: 0, b61: 0, b91: 0 },
    );
    return {
      asOf: asOf.toISOString().slice(0, 10),
      days1: d1,
      days2: d2,
      days3: d3,
      total: rows.length,
      items,
      rows: items.map((r) => ({
        customerId: r.customer.id,
        customerCode: r.customer.code,
        customerName: r.customer.nameAr,
        balance: r.balance,
        current: r.current,
        b31: r.b31,
        b61: r.b61,
        b91: r.b91,
      })),
      totals: {
        balance: roundMoney(totals.balance),
        current: roundMoney(totals.current),
        b31: roundMoney(totals.b31),
        b61: roundMoney(totals.b61),
        b91: roundMoney(totals.b91),
      },
    };
  }
}