import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { roundMoney, roundQty } from '@bayan/shared';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import type {
  QueryAgingDto,
  QueryMovementsDto,
  QueryReportSummaryDto,
  QueryStockSummaryDto,
  QueryStockValuesDto,
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
      include: { item: { select: { id: true, code: true, nameAr: true, baseUnitId: true, lastPurchaseCost: true } } },
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

    const rows = balances.map((b) => {
      const qtyBase = roundQty(Number(b.qtyBase));
      let unitCost = 0;
      if (method === 'LAST') unitCost = b.item.lastPurchaseCost != null ? Number(b.item.lastPurchaseCost) : 0;
      else if (method === 'WEIGHTED') unitCost = weighted.get(b.itemId) ?? 0;
      else unitCost = sales.get(b.itemId) ?? 0;
      const value = roundMoney(qtyBase * unitCost);

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

      return {
        itemId: b.itemId,
        code: b.item.code,
        nameAr: b.item.nameAr,
        warehouseId: b.warehouseId,
        batchId: b.batchId,
        qtyBase,
        unitCost,
        value,
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
      totals: { items: items.length, qtyBase: totalQty, value: totalValue },
    };
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
        item: { select: { id: true, code: true, nameAr: true, lastPurchaseCost: true } },
        warehouse: { select: { id: true, code: true, nameAr: true } },
      },
    });
    const ids = [...new Set(balances.map((b) => b.itemId))];
    const lastMov = new Map<number, Date | null>();
    if (ids.length) {
      const movs = await this.prisma.stockMovement.groupBy({
        by: ['itemId'],
        where: { itemId: { in: ids }, ...tenantWhere(companyId) },
        _max: { createdAt: true },
      });
      for (const m of movs) lastMov.set(m.itemId, m._max.createdAt ?? null);
    }

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
      return {
        itemId,
        item: { code: balances.find((b) => b.itemId === itemId)?.item.code ?? '', nameAr: balances.find((b) => b.itemId === itemId)?.item.nameAr ?? '' },
        qtyBase: v.qtyBase,
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