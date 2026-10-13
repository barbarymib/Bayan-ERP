import { describe, expect, it } from 'vitest';
import { ReportsService } from '../src/reports/reports.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { QueryDiscountApprovalsDto, QueryDiscountsDto, QueryReturnsDto, QuerySalesByDto, QuerySalesSummaryDto, QueryStoppedCustomersDto } from '../src/reports/reports.dto.js';

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
}

function build(statements: ReturnType<typeof statement>[], lookups: Lookups = {}) {
  const approvals = lookups.approvals ?? [];
  const prisma = {
    priceStatement: { findMany: async () => statements },
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
