import { describe, expect, it } from 'vitest';
import { ReportsService } from '../src/reports/reports.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { QueryDiscountApprovalsDto, QueryDiscountsDto, QueryItemCardDto, QueryItemsWithoutPriceDto, QueryRepPerformanceDto, QueryReturnsDto, QuerySalesByDto, QuerySalesSummaryDto, QueryStockValuesDto, QueryStocktakeDiffDto, QueryStoppedCustomersDto, QuerySupplierDebtDto, QueryWeightNotesDto } from '../src/reports/reports.dto.js';

interface Line {
  itemId?: number;
  qty?: number;
  unitPrice?: number;
  qtyBase?: number;
  netLine?: number;
  lineDiscountAmount?: number;
  allocatedHeaderDiscount?: number;
  costSnapshot?: number | null;
  categoryId?: number;
  brandId?: number | null;
}

interface Statement {
  id?: number;
  date?: Date;
  customerId?: number;
  repId?: number | null;
  warehouseId?: number;
  createdById?: number;
  discountAmount?: number;
  shipping?: number;
  taxAmount?: number;
  net?: number;
  lines?: Line[];
}

function line(over: Line = {}) {
  return {
    itemId: over.itemId ?? 1,
    qty: over.qty ?? 10,
    unitPrice: over.unitPrice ?? 30,
    qtyBase: over.qtyBase ?? 10,
    netLine: over.netLine ?? 300,
    lineDiscountAmount: over.lineDiscountAmount ?? 0,
    allocatedHeaderDiscount: over.allocatedHeaderDiscount ?? 0,
    costSnapshot: over.costSnapshot === undefined ? 20 : over.costSnapshot,
    item: { categoryId: over.categoryId ?? 1, brandId: over.brandId === undefined ? 1 : over.brandId },
  };
}

function statement(over: Statement = {}) {
  return {
    id: over.id ?? 1,
    date: over.date ?? new Date('2026-10-01T00:00:00Z'),
    customerId: over.customerId ?? 1,
    repId: over.repId === undefined ? 2 : over.repId,
    warehouseId: over.warehouseId ?? 1,
    createdById: over.createdById ?? 5,
    discountAmount: over.discountAmount ?? 0,
    shipping: over.shipping ?? 0,
    taxAmount: over.taxAmount ?? 0,
    net: over.net ?? 0,
    lines: over.lines ?? [line()],
  };
}

interface Approval {
  id: number;
  type: string;
  status: string;
  refType: string;
  refId: number;
  refJson?: unknown;
  note?: string | null;
  decidedAt?: Date | null;
  createdAt?: Date;
  requestedBy?: { id: number; name: string } | null;
  decidedBy?: { id: number; name: string } | null;
}

interface Lookups {
  items?: { id: number; code: string; nameAr: string }[];
  categories?: { id: number; nameAr: string }[];
  brands?: { id: number; nameAr: string }[];
  customers?: { id: number; code: string; nameAr: string }[];
  users?: { id: number; name: string }[];
  warehouses?: { id: number; code: string; nameAr: string }[];
  approvals?: Approval[];
  weightNoteLines?: {
    id: number;
    qty: number;
    qtyBase: number;
    weightNote: string | null;
    item: { id: number; code: string; nameAr: string };
    unit: { code: string; nameAr: string };
    statement: { id: number; number: string; date: Date; status: string; customer: { id: number; code: string; nameAr: string } };
  }[];
}

function build(statements: ReturnType<typeof statement>[], lookups: Lookups = {}) {
  const approvals = lookups.approvals ?? [];
  const prisma = {
    priceStatement: { findMany: async () => statements },
    priceStatementLine: { findMany: async () => lookups.weightNoteLines ?? [] },
    item: { findMany: async () => lookups.items ?? [] },
    category: { findMany: async () => lookups.categories ?? [] },
    brand: { findMany: async () => lookups.brands ?? [] },
    customer: { findMany: async () => lookups.customers ?? [] },
    user: { findMany: async () => lookups.users ?? [] },
    warehouse: { findMany: async () => lookups.warehouses ?? [] },
    approval: {
      findMany: async () => approvals,
      groupBy: async () => {
        const counts: Record<string, number> = {};
        for (const a of approvals) counts[a.status] = (counts[a.status] ?? 0) + 1;
        return Object.entries(counts).map(([status, n]) => ({ status, _count: { _all: n } }));
      },
    },
  } as unknown as PrismaService;
  return new ReportsService(prisma);
}

describe('ReportsService.salesSummary — المبيعات حسب الفترة (§5.14)', () => {
  const s1 = statement({
    id: 1,
    date: new Date('2026-10-01T00:00:00Z'),
    taxAmount: 40,
    net: 440,
    lines: [
      line({ itemId: 1, qty: 10, unitPrice: 30, netLine: 300, qtyBase: 10, costSnapshot: 20 }),
      line({ itemId: 2, qty: 1, unitPrice: 100, netLine: 100, qtyBase: 1, costSnapshot: 50 }),
    ],
  });
  const s2 = statement({
    id: 2,
    date: new Date('2026-10-02T00:00:00Z'),
    taxAmount: 9,
    net: 189,
    lines: [line({ qty: 2, unitPrice: 100, netLine: 180, qtyBase: 2, costSnapshot: 50 })],
  });

  it('يجمّع يومياً ويعيد الفترات مرتّبة مع الإجماليات', async () => {
    const out = await build([s1, s2]).salesSummary({ groupBy: 'day' } as QuerySalesSummaryDto);
    expect(out.rows.map((r) => r.period)).toEqual(['2026-10-01', '2026-10-02']);
    expect(out.rows[0]).toMatchObject({ count: 1, qtyBase: 11, gross: 400, discount: 0, net: 400, tax: 40, total: 440 });
    expect(out.rows[1]).toMatchObject({ count: 1, qtyBase: 2, gross: 200, discount: 20, net: 180, tax: 9, total: 189 });
    expect(out.totals).toMatchObject({ count: 2, qtyBase: 13, gross: 600, discount: 20, net: 580, tax: 49, total: 629, periods: 2 });
  });

  it('يُخفي الأرباح بدون صلاحية التكلفة ويُظهرها عند توفّرها', async () => {
    const hidden = await build([s1], {}).salesSummary({ groupBy: 'day' } as QuerySalesSummaryDto, null, false);
    expect(hidden.totals).not.toHaveProperty('profit');
    expect(hidden.rows[0]).not.toHaveProperty('cost');

    const shown = await build([s1], {}).salesSummary({ groupBy: 'day' } as QuerySalesSummaryDto, null, true);
    // تكلفة s1 = 10*20 + 1*50 = 250، صافي البضاعة 400 → ربح 150
    expect(shown.totals).toMatchObject({ cost: 250, profit: 150 });
    expect(shown.rows[0]).toMatchObject({ cost: 250, profit: 150 });
  });

  it('يجمّع شهرياً', async () => {
    const out = await build([s1, s2]).salesSummary({ groupBy: 'month' } as QuerySalesSummaryDto);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]?.period).toBe('2026-10');
    expect(out.rows[0]?.count).toBe(2);
  });
});

describe('ReportsService.salesBy — المبيعات حسب البُعد (§5.14)', () => {
  const s1 = statement({
    id: 1,
    customerId: 7,
    repId: 2,
    warehouseId: 3,
    lines: [
      line({ itemId: 1, categoryId: 5, brandId: 9, qty: 10, unitPrice: 30, netLine: 300, qtyBase: 10, costSnapshot: 20 }),
      line({ itemId: 2, categoryId: 5, brandId: 9, qty: 1, unitPrice: 100, netLine: 100, qtyBase: 1, costSnapshot: 50 }),
    ],
  });
  const s2 = statement({
    id: 2,
    customerId: 8,
    repId: 2,
    warehouseId: 3,
    lines: [line({ itemId: 1, categoryId: 5, brandId: 9, qty: 2, unitPrice: 100, netLine: 180, qtyBase: 2, costSnapshot: 50 })],
  });

  const lookups: Lookups = {
    items: [
      { id: 1, code: 'A', nameAr: 'صنف أ' },
      { id: 2, code: 'B', nameAr: 'صنف ب' },
    ],
    categories: [{ id: 5, nameAr: 'تصنيف' }],
    brands: [{ id: 9, nameAr: 'ماركة' }],
    customers: [
      { id: 7, code: 'C7', nameAr: 'عميل 7' },
      { id: 8, code: 'C8', nameAr: 'عميل 8' },
    ],
    users: [{ id: 2, name: 'مندوب' }],
    warehouses: [{ id: 3, code: 'M', nameAr: 'مخزن' }],
  };

  it('حسب الصنف: يجمع البنود ويرتّب تنازلياً بالصافي ويحلّ الأسماء', async () => {
    const out = await build([s1, s2], lookups).salesBy({ by: 'item' } as QuerySalesByDto);
    // صنف 1: 300 + 180 = 480، صنف 2: 100 → الصنف 1 أولاً
    expect(out.rows.map((r) => r.id)).toEqual([1, 2]);
    expect(out.rows[0]).toMatchObject({ code: 'A', name: 'صنف أ', qtyBase: 12, gross: 500, net: 480 });
    expect(out.rows[1]).toMatchObject({ code: 'B', name: 'صنف ب', qtyBase: 1, net: 100 });
    expect(out.totals).toMatchObject({ qtyBase: 13, gross: 600, net: 580 });
  });

  it('يحترم حدّ النتائج limit', async () => {
    const out = await build([s1, s2], lookups).salesBy({ by: 'item', limit: 1 } as QuerySalesByDto);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]?.id).toBe(1);
  });

  it('حسب العميل ويُدرج الأرباح عند صلاحية التكلفة', async () => {
    const out = await build([s1, s2], lookups).salesBy({ by: 'customer' } as QuerySalesByDto, null, true);
    expect(out.rows.map((r) => r.id).sort()).toEqual([7, 8]);
    expect(out.totals).toMatchObject({ net: 580, cost: 350, profit: 230 });
  });

  it('حسب المندوب/المخزن/التصنيف/الماركة يحلّ الأبعاد الصحيحة', async () => {
    const svc = build([s1, s2], lookups);
    const byRep = await svc.salesBy({ by: 'rep' } as QuerySalesByDto);
    expect(byRep.rows[0]).toMatchObject({ id: 2, name: 'مندوب', net: 580 });
    const byWh = await svc.salesBy({ by: 'warehouse' } as QuerySalesByDto);
    expect(byWh.rows[0]).toMatchObject({ id: 3, name: 'مخزن', net: 580 });
    const byCat = await svc.salesBy({ by: 'category' } as QuerySalesByDto);
    expect(byCat.rows[0]).toMatchObject({ id: 5, name: 'تصنيف', net: 580 });
    const byBrand = await svc.salesBy({ by: 'brand' } as QuerySalesByDto);
    expect(byBrand.rows[0]).toMatchObject({ id: 9, name: 'ماركة', net: 580 });
  });

  it('يتعامل مع مندوب/ماركة بلا معرّف (بدون)', async () => {
    const noRep = statement({ repId: null, lines: [line({ itemId: 1, brandId: null, netLine: 50, qtyBase: 1, costSnapshot: null })] });
    const svc = build([noRep], lookups);
    const byRep = await svc.salesBy({ by: 'rep' } as QuerySalesByDto);
    expect(byRep.rows[0]).toMatchObject({ id: null, name: 'بدون' });
    const byBrand = await svc.salesBy({ by: 'brand' } as QuerySalesByDto);
    expect(byBrand.rows[0]).toMatchObject({ id: null, name: 'بدون', net: 50 });
  });
});

describe('ReportsService.discountsBy / discountApprovals — الخصومات (§5.14)', () => {
  // s1: منشئ 5، مندوب 2، هامش خصم بند 30 + خصم بيان 20
  const s1 = statement({
    id: 1,
    createdById: 5,
    repId: 2,
    discountAmount: 20,
    lines: [
      line({ itemId: 1, qty: 10, unitPrice: 30, netLine: 280, qtyBase: 10, lineDiscountAmount: 30 }),
      line({ itemId: 2, qty: 1, unitPrice: 100, netLine: 90, qtyBase: 1, lineDiscountAmount: 10 }),
    ],
  });
  // s2: منشئ 6، مندوب 2، خصم بيان بلا خصومات بنود
  const s2 = statement({
    id: 2,
    createdById: 6,
    repId: 2,
    discountAmount: 50,
    lines: [line({ itemId: 1, qty: 2, unitPrice: 100, netLine: 180, qtyBase: 2 })],
  });

  const lookups: Lookups = {
    items: [
      { id: 1, code: 'A', nameAr: 'صنف أ' },
      { id: 2, code: 'B', nameAr: 'صنف ب' },
    ],
    users: [
      { id: 5, name: 'مستخدم 5' },
      { id: 6, name: 'مستخدم 6' },
      { id: 2, name: 'مندوب' },
    ],
  };

  it('حسب الصنف: يجمع خصومات البنود والخصم الموزّع', async () => {
    const out = await build([s1, s2], lookups).discountsBy({ by: 'item' } as QueryDiscountsDto);
    // صنف 1: 30 (بند s1) + 0 + 0 (s2) = 30، صنف 2: 10
    expect(out.rows.map((r) => r.id)).toEqual([1, 2]);
    expect(out.rows[0]).toMatchObject({ code: 'A', discount: 30, net: 460 });
    expect(out.rows[1]).toMatchObject({ code: 'B', discount: 10, net: 90 });
    expect(out.totals).toMatchObject({ discount: 40, net: 550 });
  });

  it('حسب المستخدم: خصم البيان + خصومات البنود', async () => {
    const out = await build([s1, s2], lookups).discountsBy({ by: 'user' } as QueryDiscountsDto);
    // مستخدم 5 = 20 + (30+10) = 60؛ مستخدم 6 = 50
    expect(out.rows[0]).toMatchObject({ id: 5, name: 'مستخدم 5', discount: 60, count: 1 });
    expect(out.rows[1]).toMatchObject({ id: 6, name: 'مستخدم 6', discount: 50, count: 1 });
  });

  it('حسب المندوب: يجمع فواتير المندوب', async () => {
    const out = await build([s1, s2], lookups).discountsBy({ by: 'rep' } as QueryDiscountsDto);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ id: 2, name: 'مندوب', discount: 110, count: 2 });
  });

  it('يحسب نسبة الخصم', async () => {
    const out = await build([s1, s2], lookups).discountsBy({ by: 'rep' } as QueryDiscountsDto);
    // 110 / (550+110) = 16.67%
    expect(out.rows[0]?.discountPct).toBe(16.67);
  });

  it('يُرجع الخصومات المتجاوزة مع أسماء الطالب/المعتمد وحالاتها', async () => {
    const approvals: Approval[] = [
      { id: 1, type: 'ITEM_DISCOUNT', status: 'APPROVED', refType: 'price_statement', refId: 1, refJson: { itemCode: 'A', userLimitPct: 5, effectivePercent: 12 }, createdAt: new Date('2026-10-02T00:00:00Z'), decidedAt: new Date('2026-10-02T01:00:00Z'), requestedBy: { id: 5, name: 'مستخدم 5' }, decidedBy: { id: 9, name: 'المالك' } },
      { id: 2, type: 'HEADER_DISCOUNT', status: 'PENDING', refType: 'price_statement', refId: 2, refJson: { userLimitPct: 3 }, createdAt: new Date('2026-10-03T00:00:00Z'), requestedBy: { id: 6, name: 'مستخدم 6' } },
    ];
    const out = await build([], { ...lookups, approvals }).discountApprovals({} as QueryDiscountApprovalsDto);
    expect(out.count).toBe(2);
    expect(out.byStatus).toEqual({ APPROVED: 1, PENDING: 1, REJECTED: 0 });
    expect(out.rows[0]).toMatchObject({ id: 1, type: 'ITEM_DISCOUNT', status: 'APPROVED', requestedBy: 'مستخدم 5', decidedBy: 'المالك' });
    expect(out.rows[0]?.details).toEqual({ itemCode: 'A', userLimitPct: 5, effectivePercent: 12 });
    expect(out.rows[1]).toMatchObject({ id: 2, status: 'PENDING', decidedBy: null });
  });
});

interface ReturnRowTest {
  id?: number;
  customerId?: number | null;
  repId?: number | null;
  reasonId?: number | null;
  total?: number;
  lines?: { itemId: number; qtyBase: number; lineTotal: number }[];
}

function ret(over: ReturnRowTest = {}) {
  return {
    id: over.id ?? 1,
    customerId: over.customerId === undefined ? 1 : over.customerId,
    repId: over.repId === undefined ? 2 : over.repId,
    reasonId: over.reasonId === undefined ? 10 : over.reasonId,
    total: over.total ?? 0,
    lines: over.lines ?? [],
  };
}

function buildReturns(returns: ReturnType<typeof ret>[], lookups: Lookups & { reasons?: { id: number; code: string; nameAr: string }[] } = {}, salesNet = 0) {
  const prisma = {
    returnStatement: { findMany: async () => returns },
    customer: { findMany: async () => lookups.customers ?? [] },
    user: { findMany: async () => lookups.users ?? [] },
    returnReason: { findMany: async () => lookups.reasons ?? [] },
    item: { findMany: async () => lookups.items ?? [] },
    priceStatement: { aggregate: async () => ({ _sum: { net: salesNet } }) },
  } as unknown as PrismaService;
  return new ReportsService(prisma);
}

describe('ReportsService.returnsBy — المرتجعات ونسبتها للمبيعات (§5.14)', () => {
  const lookups: Lookups & { reasons?: { id: number; code: string; nameAr: string }[] } = {
    customers: [
      { id: 1, code: 'C1', nameAr: 'عميل 1' },
      { id: 2, code: 'C2', nameAr: 'عميل 2' },
    ],
    users: [{ id: 2, name: 'مندوب' }],
    reasons: [
      { id: 10, code: 'DAMAGED', nameAr: 'تالف' },
      { id: 11, code: 'OTHER', nameAr: 'أخرى' },
    ],
    items: [
      { id: 1, code: 'A', nameAr: 'صنف A' },
      { id: 2, code: 'B', nameAr: 'صنف B' },
    ],
  };
  const r1 = ret({
    id: 1,
    customerId: 1,
    repId: 2,
    reasonId: 10,
    total: 200,
    lines: [
      { itemId: 1, qtyBase: 5, lineTotal: 120 },
      { itemId: 2, qtyBase: 2, lineTotal: 80 },
    ],
  });
  const r2 = ret({ id: 2, customerId: 2, repId: 2, reasonId: 11, total: 100, lines: [{ itemId: 1, qtyBase: 5, lineTotal: 100 }] });

  it('حسب العميل مع الاسم والمجموع', async () => {
    const out = await buildReturns([r1, r2], lookups, 1000).returnsBy({ by: 'customer' } as QueryReturnsDto);
    expect(out.rows[0]).toMatchObject({ id: 1, code: 'C1', name: 'عميل 1', total: 200, count: 1 });
    expect(out.rows[1]).toMatchObject({ id: 2, code: 'C2', name: 'عميل 2', total: 100 });
  });

  it('حسب المندوب: يجمع المرتجعات', async () => {
    const out = await buildReturns([r1, r2], lookups).returnsBy({ by: 'rep' } as QueryReturnsDto);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ id: 2, name: 'مندوب', total: 300, qtyBase: 12, count: 2 });
  });

  it('حسب السبب', async () => {
    const out = await buildReturns([r1, r2], lookups).returnsBy({ by: 'reason' } as QueryReturnsDto);
    expect(out.rows[0]).toMatchObject({ id: 10, code: 'DAMAGED', name: 'تالف', total: 200 });
    expect(out.rows[1]).toMatchObject({ id: 11, name: 'أخرى', total: 100 });
  });

  it('حسب الصنف يجمع البنود', async () => {
    const out = await buildReturns([r1, r2], lookups).returnsBy({ by: 'item' } as QueryReturnsDto);
    expect(out.rows[0]).toMatchObject({ id: 1, code: 'A', total: 220, qtyBase: 10, count: 2 });
    expect(out.rows[1]).toMatchObject({ id: 2, code: 'B', total: 80, qtyBase: 2, count: 1 });
  });

  it('يحسب النسبة إلى المبيعات والإجماليات', async () => {
    const out = await buildReturns([r1, r2], lookups, 1000).returnsBy({ by: 'rep' } as QueryReturnsDto);
    expect(out.totals).toMatchObject({ count: 2, qtyBase: 12, total: 300, salesTotal: 1000, ratioPct: 30 });
  });

  it('يحسب حصة كل مجموعة من إجمالي المرتجعات', async () => {
    const out = await buildReturns([r1, r2], lookups).returnsBy({ by: 'customer' } as QueryReturnsDto);
    expect(out.rows[0]?.sharePct).toBe(66.67);
    expect(out.rows[1]?.sharePct).toBe(33.33);
  });

  it('يتعامل مع الأبعاد الفارغة (بدون مرجع)', async () => {
    const r = ret({ id: 3, customerId: null, repId: null, reasonId: null, total: 50, lines: [] });
    const out = await buildReturns([r], lookups).returnsBy({ by: 'rep' } as QueryReturnsDto);
    expect(out.rows[0]).toMatchObject({ id: null, name: 'بدون', total: 50 });
  });
});

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000);
}

interface StoppedLookups {
  customers?: { id: number; code: string; nameAr: string; phone?: string | null; repId?: number | null; active?: boolean }[];
  users?: { id: number; name: string }[];
  lastSales?: { customerId: number; date: Date }[];
}

function buildStopped(lookups: StoppedLookups = {}) {
  const prisma = {
    customer: {
      findMany: async ({ where }: { where?: { repId?: number } } = {}) =>
        (lookups.customers ?? []).filter((c) => where?.repId == null || c.repId === where.repId),
    },
    priceStatement: {
      groupBy: async () => (lookups.lastSales ?? []).map((l) => ({ customerId: l.customerId, _max: { date: l.date } })),
    },
    user: { findMany: async () => lookups.users ?? [] },
  } as unknown as PrismaService;
  return new ReportsService(prisma);
}

describe('ReportsService.stoppedCustomers — العملاء المتوقفون (§5.14)', () => {
  const lookups: StoppedLookups = {
    customers: [
      { id: 1, code: 'C1', nameAr: 'عميل 1', phone: '011', repId: 2, active: true },
      { id: 2, code: 'C2', nameAr: 'عميل 2', phone: null, repId: 2, active: true },
      { id: 3, code: 'C3', nameAr: 'عميل 3', phone: null, repId: null, active: true },
    ],
    users: [{ id: 2, name: 'مندوب' }],
    lastSales: [
      { customerId: 1, date: daysAgo(40) },
      { customerId: 2, date: daysAgo(5) },
    ],
  };

  it('يُرجع فقط من تجاوز الحد مع اسم المندوب', async () => {
    const out = await buildStopped(lookups).stoppedCustomers({ days: 30 } as QueryStoppedCustomersDto);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ id: 1, code: 'C1', name: 'عميل 1', repId: 2, repName: 'مندوب' });
    expect(out.rows[0]?.daysSince).toBeGreaterThanOrEqual(39);
    expect(out.rows[0]?.lastSaleDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(out.totals).toMatchObject({ count: 1, scanned: 3 });
  });

  it('يستبعد العميل الذي لم يشترِ قط', async () => {
    const out = await buildStopped(lookups).stoppedCustomers({ days: 1 } as QueryStoppedCustomersDto);
    expect(out.rows.map((r) => r.id)).not.toContain(3);
  });

  it('يوسّع النتيجة عند تقليل عدد الأيام', async () => {
    const out = await buildStopped(lookups).stoppedCustomers({ days: 3 } as QueryStoppedCustomersDto);
    expect(out.rows.map((r) => r.id).sort()).toEqual([1, 2]);
  });

  it('يُرتب تنازلياً حسب عدد أيام التوقف ويطبّق limit', async () => {
    const out = await buildStopped(lookups).stoppedCustomers({ days: 1, limit: 1 } as QueryStoppedCustomersDto);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]?.id).toBe(1);
  });

  it('يحترم فلتر المندوب', async () => {
    const out = await buildStopped(lookups).stoppedCustomers({ days: 30, repId: 2 } as QueryStoppedCustomersDto);
    expect(out.rows.map((r) => r.id)).toEqual([1]);
    expect(out.totals.scanned).toBe(2);
  });
});

interface StockLineTest {
  sessionId?: number;
  sessionNumber?: string;
  status?: string;
  warehouse?: string;
  itemId?: number;
  code?: string;
  name?: string;
  systemQtyBase?: number;
  countedQtyBase?: number | null;
  diffQty?: number | null;
  lastCost?: number | null;
  diffValue?: number | null;
}

function stLine(over: StockLineTest = {}) {
  return {
    sessionId: over.sessionId ?? 1,
    itemId: over.itemId ?? 1,
    systemQtyBase: over.systemQtyBase ?? 10,
    countedQtyBase: over.countedQtyBase === undefined ? 8 : over.countedQtyBase,
    diffQty: over.diffQty === undefined ? -2 : over.diffQty,
    lastCost: over.lastCost === undefined ? 50 : over.lastCost,
    diffValue: over.diffValue === undefined ? -100 : over.diffValue,
    session: { number: over.sessionNumber ?? 'ST-1', status: over.status ?? 'APPROVED', warehouse: { code: 'MAIN', nameAr: over.warehouse ?? 'المخزن الرئيسي' } },
    item: { code: over.code ?? 'A', nameAr: over.name ?? 'صنف A' },
  };
}

function buildStocktakeDiff(lines: ReturnType<typeof stLine>[]) {
  const prisma = { stocktakeLine: { findMany: async () => lines } } as unknown as PrismaService;
  return new ReportsService(prisma);
}

describe('ReportsService.stocktakeDiff — فروقات الجرد (§5.14)', () => {
  const lines = [
    stLine({ itemId: 1, code: 'A', systemQtyBase: 10, countedQtyBase: 8, diffQty: -2, lastCost: 50, diffValue: -100 }),
    stLine({ itemId: 1, code: 'A', systemQtyBase: 5, countedQtyBase: 5, diffQty: 0, lastCost: 50, diffValue: 0 }),
    stLine({ itemId: 2, code: 'B', name: 'صنف B', systemQtyBase: 4, countedQtyBase: 7, diffQty: 3, lastCost: 10, diffValue: 30 }),
    stLine({ itemId: 3, code: 'C', name: 'صنف C', systemQtyBase: 6, countedQtyBase: 6, diffQty: 0, lastCost: 5, diffValue: 0 }),
  ];

  it('يجمع البنود لكل صنف ويُظهر الفروقات فقط افتراضياً', async () => {
    const out = await buildStocktakeDiff(lines).stocktakeDiff({});
    expect(out.onlyDiff).toBe(true);
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0]).toMatchObject({ itemId: 1, code: 'A', systemQtyBase: 15, countedQtyBase: 13, diffQty: -2, diffValue: -100 });
    expect(out.rows[1]).toMatchObject({ itemId: 2, diffQty: 3, diffValue: 30 });
  });

  it('يرتّب تنازلياً حسب |قيمة الفرق|', async () => {
    const out = await buildStocktakeDiff(lines).stocktakeDiff({});
    expect(out.rows.map((r) => r.itemId)).toEqual([1, 2]);
  });

  it('onlyDiff=false يُظهر كل الأصناف المعدودة', async () => {
    const out = await buildStocktakeDiff(lines).stocktakeDiff({ onlyDiff: false } as QueryStocktakeDiffDto);
    expect(out.rows).toHaveLength(3);
    expect(out.rows.map((r) => r.itemId).sort()).toEqual([1, 2, 3]);
  });

  it('يحسب الإجماليات (زيادة/عجز/صافي)', async () => {
    const out = await buildStocktakeDiff(lines).stocktakeDiff({});
    expect(out.totals).toMatchObject({ sessions: 1, lines: 3, diffLines: 2, surplusQty: 3, shortageQty: -2, surplusValue: 30, shortageValue: -100, netValue: -70 });
  });

  it('بيانات وصفية للجلسة والمخزن', async () => {
    const out = await buildStocktakeDiff(lines).stocktakeDiff({});
    expect(out.rows[0]).toMatchObject({ sessionId: 1, sessionNumber: 'ST-1', status: 'APPROVED', warehouse: 'المخزن الرئيسي', name: 'صنف A' });
  });

  it('يستبعد الأسطر غير المعدودة (countedQtyBase=null)', async () => {
    const out = await buildStocktakeDiff([stLine({ itemId: 9, countedQtyBase: null, diffQty: null, diffValue: null })]).stocktakeDiff({});
    expect(out.rows).toHaveLength(0);
  });
});

interface SupplierLookups {
  suppliers?: { id: number; code: string; nameAr: string; phone?: string | null; openingBalance?: number; active?: boolean }[];
  purchases?: { supplierId: number; net: number; paid: number; last?: Date | null }[];
  payments?: { supplierId: number; amount: number }[];
}

function buildSupplierDebt(lookups: SupplierLookups = {}) {
  const prisma = {
    supplier: { findMany: async () => lookups.suppliers ?? [] },
    purchaseStatement: {
      groupBy: async () =>
        (lookups.purchases ?? []).map((p) => ({ supplierId: p.supplierId, _sum: { net: p.net, paid: p.paid }, _max: { date: p.last ?? null } })),
    },
    payment: {
      groupBy: async () => (lookups.payments ?? []).map((p) => ({ supplierId: p.supplierId, _sum: { amount: p.amount } })),
    },
  } as unknown as PrismaService;
  return new ReportsService(prisma);
}

describe('ReportsService.supplierDebt — مديونية الموردين (§5.14)', () => {
  const lookups: SupplierLookups = {
    suppliers: [
      { id: 1, code: 'SUP-01', nameAr: 'مورد 1', phone: '011', openingBalance: 100, active: true },
      { id: 2, code: 'SUP-02', nameAr: 'مورد 2', phone: null, openingBalance: 0, active: true },
    ],
    purchases: [
      { supplierId: 1, net: 1000, paid: 400, last: new Date('2026-10-07T00:00:00Z') },
      { supplierId: 2, net: 500, paid: 500, last: new Date('2026-10-06T00:00:00Z') },
    ],
    payments: [{ supplierId: 1, amount: 400 }],
  };

  it('يحسب الرصيد = افتتاحي + مشتريات − مدفوع (المديونون فقط افتراضياً)', async () => {
    const out = await buildSupplierDebt(lookups).supplierDebt({});
    expect(out.onlyOutstanding).toBe(true);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ id: 1, code: 'SUP-01', openingBalance: 100, purchases: 1000, paid: 400, payments: 400, balance: 700, lastPurchaseDate: '2026-10-07' });
  });

  it('onlyOutstanding=false يشمل الرصيد الصفري', async () => {
    const out = await buildSupplierDebt(lookups).supplierDebt({ onlyOutstanding: false } as QuerySupplierDebtDto);
    expect(out.rows.map((r) => r.id)).toEqual([1, 2]);
    expect(out.rows[1]).toMatchObject({ id: 2, balance: 0 });
  });

  it('الإجماليات تعكس الصفوف المُرشَّحة', async () => {
    const out = await buildSupplierDebt(lookups).supplierDebt({});
    expect(out.totals).toMatchObject({ suppliers: 1, openingBalance: 100, purchases: 1000, paid: 400, payments: 400, balance: 700 });
  });

  it('المورد بلا مشتريات برصيده الافتتاحي فقط', async () => {
    const out = await buildSupplierDebt({
      suppliers: [{ id: 3, code: 'SUP-03', nameAr: 'مورد 3', openingBalance: 250, active: true }],
    }).supplierDebt({});
    expect(out.rows[0]).toMatchObject({ id: 3, purchases: 0, paid: 0, balance: 250, lastPurchaseDate: null });
  });
});

interface RepPerfLookups {
  reps?: { id: number; name: string; repCode: string | null }[];
  targets?: { repId: number; targetAmount: number; achievedAmount: number; commissionDue: number }[];
  sales?: { repId: number; net: number; count: number }[];
  customers?: { id: number; repId: number | null }[];
  visits?: { repId: number; status: string; count: number }[];
  points?: { repId: number; lat: number; lng: number }[];
  receipts?: { customerId: number; amount: number }[];
}

function buildRepPerformance(lookups: RepPerfLookups = {}) {
  const prisma = {
    user: { findMany: async () => lookups.reps ?? [] },
    repTarget: { findMany: async () => lookups.targets ?? [] },
    priceStatement: {
      groupBy: async () => (lookups.sales ?? []).map((s) => ({ repId: s.repId, _sum: { net: s.net }, _count: { _all: s.count } })),
    },
    customer: { findMany: async () => lookups.customers ?? [] },
    repVisit: {
      groupBy: async () => (lookups.visits ?? []).map((v) => ({ repId: v.repId, status: v.status, _count: { _all: v.count } })),
    },
    repLocation: { findMany: async () => lookups.points ?? [] },
    receipt: {
      groupBy: async () => (lookups.receipts ?? []).map((r) => ({ customerId: r.customerId, _sum: { amount: r.amount } })),
    },
  } as unknown as PrismaService;
  return new ReportsService(prisma);
}

describe('ReportsService.repPerformance — أداء المناديب (§5.14)', () => {
  const lookups: RepPerfLookups = {
    reps: [
      { id: 2, name: 'مندوب', repCode: 'M03' },
      { id: 5, name: 'مندوب 2', repCode: 'M05' },
    ],
    targets: [{ repId: 2, targetAmount: 1000, achievedAmount: 400, commissionDue: 40 }],
    sales: [
      { repId: 2, net: 500, count: 3 },
      { repId: 5, net: 200, count: 1 },
    ],
    customers: [
      { id: 1, repId: 2 },
      { id: 2, repId: 2 },
      { id: 3, repId: 5 },
    ],
    visits: [
      { repId: 2, status: 'DONE', count: 4 },
      { repId: 2, status: 'MISSED', count: 1 },
      { repId: 5, status: 'DONE', count: 2 },
    ],
    points: [
      { repId: 2, lat: 30.0, lng: 31.0 },
      { repId: 2, lat: 30.009, lng: 31.0 },
      { repId: 5, lat: 30.0, lng: 31.0 },
      { repId: 5, lat: 30.0, lng: 31.009 },
    ],
    receipts: [
      { customerId: 1, amount: 300 },
      { customerId: 3, amount: 100 },
    ],
  };

  it('يجمع الأهداف والمبيعات والتحصيل والزيارات', async () => {
    const out = await buildRepPerformance(lookups).repPerformance({});
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0]).toMatchObject({
      repId: 2,
      repCode: 'M03',
      targetAmount: 1000,
      achievedAmount: 400,
      commissionDue: 40,
      salesNet: 500,
      salesCount: 3,
      collected: 300,
      collectionRatePct: 60,
      visits: 5,
      visitsDone: 4,
      visitsMissed: 1,
      achievementPct: 50,
    });
  });

  it('يرتّب تنازلياً حسب صافي المبيعات', async () => {
    const out = await buildRepPerformance(lookups).repPerformance({});
    expect(out.rows.map((r) => r.repId)).toEqual([2, 5]);
  });

  it('مندوب بلا هدف: achievementPct = 0', async () => {
    const out = await buildRepPerformance(lookups).repPerformance({});
    const r5 = out.rows.find((r) => r.repId === 5);
    expect(r5).toMatchObject({ targetAmount: 0, achievementPct: 0, collected: 100, collectionRatePct: 50, visits: 2, visitsDone: 2 });
  });

  it('يحسب المسافة المقطوعة (كم) من مسار GPS', async () => {
    const out = await buildRepPerformance(lookups).repPerformance({});
    const r2 = out.rows.find((r) => r.repId === 2);
    expect(r2?.distanceKm).toBeGreaterThan(0.9);
    expect(r2?.distanceKm).toBeLessThan(1.1);
    expect(out.totals.distanceKm).toBeGreaterThan(1.8);
  });

  it('يحسب الإجماليات على الصفوف', async () => {
    const out = await buildRepPerformance(lookups).repPerformance({});
    expect(out.totals).toMatchObject({ reps: 2, targetAmount: 1000, salesNet: 700, salesCount: 4, collected: 400, visits: 7 });
  });

  it('بلا مناديب: صفوف وإجماليات صفرية', async () => {
    const out = await buildRepPerformance({ reps: [] }).repPerformance({});
    expect(out.rows).toHaveLength(0);
    expect(out.totals.reps).toBe(0);
  });

  it('يطبّق limit', async () => {
    const out = await buildRepPerformance(lookups).repPerformance({ limit: 1 } as QueryRepPerformanceDto);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]?.repId).toBe(2);
  });
});

interface ItemCardLookups {
  item?: {
    id: number;
    code: string;
    nameAr: string;
    minStock: number;
    minSalePrice: number | null;
    lastPurchaseCost: number | null;
    baseUnit: { id: number; code: string; nameAr: string };
    category: { id: number; nameAr: string };
  } | null;
  before?: { qtyBase: number; cost: number | null; warehouseId: number; batchId: string }[];
  rows?: { id: number; qtyBase: number; cost: number | null; type: string; warehouseId: number; batchId: string }[];
  balances?: { warehouseId: number; qtyBase: number; batchId: string; warehouse: { id: number; code: string; nameAr: string } }[];
}

function buildItemCard(lookups: ItemCardLookups = {}) {
  let call = 0;
  const prisma = {
    item: { findFirst: async () => lookups.item ?? null },
    stockMovement: {
      findMany: async () => {
        call += 1;
        if (call === 1 && lookups.before) return lookups.before;
        return (lookups.rows ?? []).map((r) => ({
          id: r.id,
          createdAt: new Date('2026-10-07T10:00:00Z'),
          type: r.type,
          refType: null,
          refId: null,
          warehouseId: r.warehouseId,
          batchId: r.batchId,
          qtyBase: r.qtyBase,
          cost: r.cost,
          warehouse: { id: r.warehouseId, code: `W${r.warehouseId}`, nameAr: 'مخزن' },
        }));
      },
    },
    stockBalance: { findMany: async () => lookups.balances ?? [] },
  } as unknown as PrismaService;
  return new ReportsService(prisma);
}

const itemStub = {
  id: 1,
  code: 'IR-16-10',
  nameAr: 'ماسورة',
  minStock: 5,
  minSalePrice: null,
  lastPurchaseCost: 100,
  baseUnit: { id: 1, code: 'PCS', nameAr: 'قطعة' },
  category: { id: 1, nameAr: 'حديد' },
};

describe('ReportsService.itemCard — بطاقة الصنف (§5.7/§5.14)', () => {
  it('يرمي NotFound للصنف غير الموجود', async () => {
    await expect(buildItemCard({ item: null }).itemCard({ itemId: 999 } as QueryItemCardDto)).rejects.toThrow();
  });

  it('رصيد افتتاحي + رصيد جارٍ وإجماليات', async () => {
    const svc = buildItemCard({
      item: itemStub,
      before: [{ qtyBase: 5, cost: 100, warehouseId: 1, batchId: '' }],
      rows: [
        { id: 1, qtyBase: 10, cost: 100, type: 'PURCHASE_IN', warehouseId: 1, batchId: '' },
        { id: 2, qtyBase: -3, cost: 100, type: 'SALE_OUT', warehouseId: 1, batchId: '' },
      ],
    });
    const out = await svc.itemCard({ itemId: 1, from: '2026-10-01' } as QueryItemCardDto, null, true);
    expect(out.opening).toEqual({ qty: 5, value: 500 });
    expect(out.rows.map((r) => r.balance)).toEqual([15, 12]);
    expect(out.rows[1]).toMatchObject({ out: -3, balance: 12, value: -300 });
    expect(out.totals).toMatchObject({ in: 10, out: -3, net: 7, openingQty: 5, closingQty: 12, closingValue: 1200 });
  });

  it('يخفي التكاليف دون cost.view', async () => {
    const svc = buildItemCard({
      item: itemStub,
      rows: [{ id: 1, qtyBase: 10, cost: 100, type: 'PURCHASE_IN', warehouseId: 1, batchId: '' }],
      balances: [{ warehouseId: 1, qtyBase: 10, batchId: '', warehouse: { id: 1, code: 'W1', nameAr: 'مخزن' } }],
    });
    const out = await svc.itemCard({ itemId: 1 } as QueryItemCardDto, null, false);
    expect(out.item.lastPurchaseCost).toBeNull();
    expect(out.opening.value).toBeNull();
    expect(out.totals.closingValue).toBeNull();
    expect(out.rows[0]).toMatchObject({ unitCost: null, value: null });
    expect(out.balances[0]?.value).toBeNull();
  });

  it('أرصدة لحظية لكل مخزن مُقيّمة بآخر سعر شراء', async () => {
    const svc = buildItemCard({
      item: itemStub,
      rows: [],
      balances: [
        { warehouseId: 1, qtyBase: 10, batchId: '', warehouse: { id: 1, code: 'W1', nameAr: 'مخزن 1' } },
        { warehouseId: 2, qtyBase: 4, batchId: 'B1', warehouse: { id: 2, code: 'W2', nameAr: 'مخزن 2' } },
      ],
    });
    const out = await svc.itemCard({ itemId: 1 } as QueryItemCardDto, null, true);
    expect(out.balances).toHaveLength(2);
    expect(out.balances[0]).toMatchObject({ qtyBase: 10, value: 1000 });
    expect(out.balances[1]).toMatchObject({ batchId: 'B1', qtyBase: 4, value: 400 });
  });

  it('بلا حركات: رصيد ختامي صفري', async () => {
    const svc = buildItemCard({ item: itemStub, rows: [] });
    const out = await svc.itemCard({ itemId: 1 } as QueryItemCardDto, null, true);
    expect(out.rows).toHaveLength(0);
    expect(out.totals.closingQty).toBe(0);
    expect(out.totals.closingValue).toBe(0);
  });
});

describe('ReportsService.weightNotes — ملاحظات الوزن الفعلي (R3-A6 §5.2)', () => {
  type WeightNoteLine = NonNullable<Lookups['weightNoteLines']>[number];
  const wl = (over: Partial<WeightNoteLine> = {}): WeightNoteLine => ({
    id: 11,
    qty: 2,
    qtyBase: 2,
    weightNote: 'فرق 20كج',
    item: { id: 5, code: 'IR-16-10', nameAr: 'حديد تسليح' },
    unit: { code: 'ton', nameAr: 'طن' },
    statement: {
      id: 7,
      number: 'BP-000007',
      date: new Date('2026-10-02T00:00:00Z'),
      status: 'APPROVED',
      customer: { id: 2, code: 'CUST-02', nameAr: 'عميل ثانٍ' },
    },
    ...over,
  });

  it('يُعيد البنود ذات ملاحظة الوزن فقط مع بيانات البيان والعميل والصنف', async () => {
    const svc = build([], {
      weightNoteLines: [wl(), wl({ id: 12, weightNote: '   ' }), wl({ id: 13, weightNote: null })],
    });
    const out = await svc.weightNotes({} as QueryWeightNotesDto, 1);
    expect(out.count).toBe(1);
    expect(out.rows[0]).toMatchObject({
      lineId: 11,
      number: 'BP-000007',
      customerCode: 'CUST-02',
      itemCode: 'IR-16-10',
      unit: 'ton',
      weightNote: 'فرق 20كج',
    });
  });

  it('يُرجع صفراً بلا بنود ذات ملاحظة', async () => {
    const svc = build([], { weightNoteLines: [] });
    const out = await svc.weightNotes({} as QueryWeightNotesDto, 1);
    expect(out.count).toBe(0);
    expect(out.rows).toEqual([]);
  });
});

interface ValuationBalance {
  itemId: number;
  warehouseId: number;
  batchId: string;
  qtyBase: number;
  item: { id: number; code: string; nameAr: string; baseUnitId: number; lastPurchaseCost: number | null };
}

interface ValuationLookups {
  balances?: ValuationBalance[];
  buys?: { itemId: number; qtyBase: number; cost: number }[];
  prices?: { itemId: number; price: number }[];
  warehouses?: { id: number; code: string; nameAr: string }[];
  noPriceItems?: {
    id: number;
    code: string;
    nameAr: string;
    baseUnit: { code: string; nameAr: string };
    category: { code: string; nameAr: string };
  }[];
  balancesGroup?: { itemId: number; _sum: { qtyBase: number } }[];
}

function buildValuation(l: ValuationLookups = {}) {
  const prisma = {
    stockBalance: {
      findMany: async () => l.balances ?? [],
      groupBy: async () => l.balancesGroup ?? [],
    },
    stockMovement: { findMany: async () => l.buys ?? [] },
    itemPrice: { findMany: async () => l.prices ?? [] },
    item: { findMany: async () => l.noPriceItems ?? [] },
    warehouse: { findMany: async () => l.warehouses ?? [] },
  } as unknown as PrismaService;
  return new ReportsService(prisma);
}

const vBal = (over: Partial<ValuationBalance> = {}): ValuationBalance => ({
  itemId: 1,
  warehouseId: 1,
  batchId: '',
  qtyBase: 10,
  item: { id: 1, code: 'IR-16-10', nameAr: 'حديد', baseUnitId: 1, lastPurchaseCost: 90 },
  ...over,
});

describe('ReportsService.stockValues — تقييم بلا سعر (R3-C2 §5.8)', () => {
  it('LAST: يوسم بلا سعر ويستبعده من الإجمالي مع إظهار العدد', async () => {
    const svc = buildValuation({
      balances: [
        vBal(),
        vBal({
          itemId: 2,
          qtyBase: 5,
          item: { id: 2, code: 'PT-20-02', nameAr: 'دهان', baseUnitId: 4, lastPurchaseCost: null },
        }),
      ],
      warehouses: [{ id: 1, code: 'MAIN', nameAr: 'رئيسي' }],
    });
    const out = await svc.stockValues({ method: 'LAST' } as QueryStockValuesDto);
    expect(out.rows[0]).toMatchObject({ unitCost: 90, value: 900, noPrice: false });
    expect(out.rows[1]).toMatchObject({ unitCost: 0, value: 0, noPrice: true });
    expect(out.totals).toMatchObject({
      items: 2,
      qtyBase: 10,
      value: 900,
      noPriceItems: 1,
      noPriceLines: 1,
      noPriceQtyBase: 5,
      noPriceValue: 0,
    });
    expect(out.noPriceItems).toEqual([{ itemId: 2, code: 'PT-20-02', nameAr: 'دهان', qtyBase: 5 }]);
  });

  it('WEIGHTED: الصنف بلا مشتريات يُعد بلا سعر', async () => {
    const svc = buildValuation({
      balances: [
        vBal(),
        vBal({
          itemId: 2,
          qtyBase: 5,
          item: { id: 2, code: 'PT-20-02', nameAr: 'دهان', baseUnitId: 4, lastPurchaseCost: 10 },
        }),
      ],
      buys: [{ itemId: 1, qtyBase: 10, cost: 88 }],
      warehouses: [{ id: 1, code: 'MAIN', nameAr: 'رئيسي' }],
    });
    const out = await svc.stockValues({ method: 'WEIGHTED' } as QueryStockValuesDto);
    expect(out.rows[0]).toMatchObject({ unitCost: 88, value: 880, noPrice: false });
    expect(out.rows[1]).toMatchObject({ noPrice: true, value: 0 });
    expect(out.totals).toMatchObject({ value: 880, noPriceItems: 1 });
  });

  it('SALES: الصنف بلا سعر بيع يُعد بلا سعر', async () => {
    const svc = buildValuation({
      balances: [vBal(), vBal({ itemId: 2, qtyBase: 5, item: { id: 2, code: 'X', nameAr: 'س', baseUnitId: 4, lastPurchaseCost: 10 } })],
      prices: [{ itemId: 1, price: 120 }],
      warehouses: [{ id: 1, code: 'MAIN', nameAr: 'رئيسي' }],
    });
    const out = await svc.stockValues({ method: 'SALES' } as QueryStockValuesDto);
    expect(out.rows[0]).toMatchObject({ unitCost: 120, value: 1200, noPrice: false });
    expect(out.rows[1]).toMatchObject({ noPrice: true, value: 0 });
    expect(out.totals).toMatchObject({ value: 1200, noPriceItems: 1 });
  });
});

describe('ReportsService.itemsWithoutPrice — أصناف بلا آخر سعر شراء (R3-E5 §11)', () => {
  const npItem = (over: Partial<NonNullable<ValuationLookups['noPriceItems']>[number]> = {}) => ({
    id: 1,
    code: 'IR-16-10',
    nameAr: 'حديد',
    baseUnit: { code: 'kg', nameAr: 'كجم' },
    category: { code: 'STEEL', nameAr: 'حديد' },
    ...over,
  });

  it('يُدرج الأصناف مع الرصيد المتاح والتصنيف والوحدة', async () => {
    const svc = buildValuation({
      noPriceItems: [npItem(), npItem({ id: 2, code: 'PT-20-02', nameAr: 'دهان', category: { code: 'PAINT', nameAr: 'دهانات' } })],
      balancesGroup: [{ itemId: 1, _sum: { qtyBase: 7 } }],
    });
    const out = await svc.itemsWithoutPrice({} as QueryItemsWithoutPriceDto, 1);
    expect(out.count).toBe(2);
    expect(out.rows[0]).toMatchObject({ itemId: 1, code: 'IR-16-10', category: 'STEEL', unit: 'kg', qtyBase: 7 });
    expect(out.rows[1]).toMatchObject({ itemId: 2, category: 'PAINT', qtyBase: 0 });
  });

  it('يُرجع صفراً بلا أصناف', async () => {
    const svc = buildValuation({ noPriceItems: [] });
    const out = await svc.itemsWithoutPrice({} as QueryItemsWithoutPriceDto, 1);
    expect(out.count).toBe(0);
    expect(out.rows).toEqual([]);
  });
});
