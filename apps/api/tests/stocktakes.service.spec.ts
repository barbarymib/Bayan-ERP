import { describe, expect, it } from 'vitest';
import { StocktakesService } from '../src/stocktakes/stocktakes.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { AuthUser } from '../src/auth/auth.decorators.js';

interface Captured {
  balanceWhere: Record<string, unknown>[];
  lineCreate: Record<string, unknown>[];
  lineUpdate: Record<string, unknown>[];
  sessionCreate: Record<string, unknown>[];
}

interface Options {
  existingLine?: { id: number; systemQtyBase: number; countedQtyBase: unknown; counter: string | null } | null;
  lines?: Record<string, unknown>[];
}

function makeService(opts: Options = {}) {
  const captured: Captured = { balanceWhere: [], lineCreate: [], lineUpdate: [], sessionCreate: [] };
  const item = { id: 1, lastPurchaseCost: 90, companyId: 1 };
  const tx = {
    item: { findUnique: async () => item },
    stocktakeLine: {
      findUnique: async () => ('existingLine' in opts ? opts.existingLine : null),
      create: async (args: { data: Record<string, unknown> }) => {
        captured.lineCreate.push(args.data);
        return { id: 100, ...args.data };
      },
      update: async (args: { where: { id: number }; data: Record<string, unknown> }) => {
        captured.lineUpdate.push(args.data);
        return { id: args.where.id };
      },
    },
    stockBalance: { findUnique: async () => ({ qtyBase: 5 }) },
  };
  const prisma = {
    stocktakeSession: {
      findUnique: async () => ({
        id: 42,
        companyId: 1,
        status: 'OPEN',
        warehouseId: 1,
        warehouse: { id: 1, code: 'MAIN', nameAr: 'الرئيسي' },
        openedBy: { id: 1, name: 'Admin' },
        approvedBy: null,
        lines: opts.lines ?? [],
      }),
      findFirst: async () => null,
      create: async (args: { data: Record<string, unknown> }) => {
        captured.sessionCreate.push(args.data);
        return { id: 42 };
      },
    },
    warehouse: { findUnique: async () => ({ id: 1, code: 'MAIN', companyId: 1 }) },
    stockBalance: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        captured.balanceWhere.push(args.where);
        return [{ itemId: 1, batchId: '', qtyBase: 5 }];
      },
    },
    item: { findMany: async () => [item] },
    systemSetting: { findUnique: async () => null },
    $transaction: async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
  } as unknown as PrismaService;
  const numbering = { issue: async () => 'ST-000001' } as never;
  const periods = { open: async () => ({ id: 1 }) } as never;
  const audits = { write: async () => undefined } as never;
  return { service: new StocktakesService(prisma, numbering, periods, audits), captured };
}

const user = { id: 7, companyId: 1 } as AuthUser;

describe('StocktakesService (§5.8)', () => {
  it('counts() ينشئ بنداً ويثبّت العداد ومن أدخل العد (§5.8.3)', async () => {
    const { service, captured } = makeService();
    await service.counts(42, { counts: [{ itemId: 1, batchId: '', qty: 4, counter: '  عداد أ  ' }] }, user);
    expect(captured.lineCreate).toHaveLength(1);
    expect(captured.lineCreate[0]!.counter).toBe('عداد أ');
    expect(captured.lineCreate[0]!.countedById).toBe(7);
    expect(captured.lineCreate[0]!.countedQtyBase).toBe(4);
  });

  it('counts() يحدّث بنداً قائماً ويحفظ العداد الجديد', async () => {
    const { service, captured } = makeService({ existingLine: { id: 100, systemQtyBase: 2, countedQtyBase: 2, counter: 'أ' } });
    await service.counts(42, { counts: [{ itemId: 1, batchId: '', qty: 6, counter: 'ب' }] }, user);
    expect(captured.lineCreate).toHaveLength(0);
    expect(captured.lineUpdate).toHaveLength(1);
    expect(captured.lineUpdate[0]!.counter).toBe('ب');
    expect(captured.lineUpdate[0]!.countedById).toBe(7);
  });

  it('counts() يبقي العداد السابق عند غيابه في الطلب', async () => {
    const { service, captured } = makeService({ existingLine: { id: 100, systemQtyBase: 2, countedQtyBase: 2, counter: 'أ' } });
    await service.counts(42, { counts: [{ itemId: 1, batchId: '', qty: 6 }] }, user);
    expect(captured.lineUpdate[0]!.counter).toBe('أ');
  });

  it('open() بجرد كلي: بلا تصفية نطاق', async () => {
    const { service, captured } = makeService();
    await service.open({ warehouseId: 1 }, user);
    expect(captured.balanceWhere[0]!.itemId).toBeUndefined();
    expect(captured.balanceWhere[0]!.item).toBeUndefined();
  });

  it('open() بجرد جزئي حسب التصنيف/الماركة (§5.8.1)', async () => {
    const { service, captured } = makeService();
    await service.open({ warehouseId: 1, scope: { categoryIds: [3], brandIds: [9] } }, user);
    expect(captured.balanceWhere[0]!.item).toEqual({ categoryId: { in: [3] }, brandId: { in: [9] } });
  });

  it('open() بجرد أصناف محددة (مجموعة أصناف)', async () => {
    const { service, captured } = makeService();
    await service.open({ warehouseId: 1, scope: { itemIds: [4, 5] } }, user);
    expect(captured.balanceWhere[0]!.itemId).toEqual({ in: [4, 5] });
  });

  it('G12: get() يعيد العرض المركب لرصيد النظام (§5.2)', async () => {
    const { service } = makeService({
      lines: [
        {
          id: 1,
          sessionId: 42,
          itemId: 1,
          batchId: '',
          systemQtyBase: 22,
          countedQtyBase: 4,
          lastCost: 90,
          diffQty: -18,
          diffValue: -1620,
          recountCount: 1,
          counter: null,
          countedById: 7,
          item: {
            id: 1,
            code: 'PT-20-02',
            nameAr: 'دهان',
            minStock: 0,
            lastPurchaseCost: 90,
            trackBatch: false,
            baseUnitId: 4,
            baseUnit: { id: 4, nameAr: 'عبوة', measurement: 'COUNT' },
            itemUnits: [{ unitId: 5, factorToBase: 4, allowDecimal: false, unit: { id: 5, nameAr: 'كرتونة' } }],
          },
          countedBy: { id: 7, name: 'Admin' },
        },
      ],
    });
    const out = await service.get(42, 1);
    expect(out.lines[0]!.systemQtyComposite).toBe('5 كرتونة + 2 عبوة');
    expect(out.lines[0]!.countedQtyComposite).toBe('1 كرتونة');
  });

  it('G12: بند بلا عد → countedQtyComposite = null', async () => {
    const { service } = makeService({
      lines: [
        {
          id: 2,
          sessionId: 42,
          itemId: 1,
          batchId: '',
          systemQtyBase: 10,
          countedQtyBase: null,
          lastCost: null,
          diffQty: 10,
          diffValue: 0,
          recountCount: 0,
          counter: null,
          countedById: null,
          item: {
            id: 1,
            code: 'PT-20-02',
            nameAr: 'دهان',
            minStock: 0,
            lastPurchaseCost: null,
            trackBatch: false,
            baseUnitId: 4,
            baseUnit: { id: 4, nameAr: 'عبوة', measurement: 'COUNT' },
            itemUnits: [],
          },
          countedBy: null,
        },
      ],
    });
    const out = await service.get(42, 1);
    expect(out.lines[0]!.systemQtyComposite).toBe('10 عبوة');
    expect(out.lines[0]!.countedQtyComposite).toBeNull();
  });
});

interface ApproveCaptured {
  movements: Record<string, unknown>[];
  upserts: unknown[];
  updates: Record<string, unknown>[];
}

function makeApproveService(opts: {
  mode: string;
  threshold: string;
  qtyThreshold?: string;
  lines: Record<string, unknown>[];
}) {
  const captured: ApproveCaptured = { movements: [], upserts: [], updates: [] };
  const session = { id: 42, companyId: 1, status: 'REVIEW', warehouseId: 1, periodId: 1, lines: opts.lines };
  const settings: Record<string, string> = {
    'stocktake.recount.enforce': opts.mode,
    'stocktake.recount.threshold': opts.threshold,
    'stocktake.recount.qtyThreshold': opts.qtyThreshold ?? '0',
  };
  const tx = {
    stockMovement: {
      create: async (a: { data: Record<string, unknown> }) => {
        captured.movements.push(a.data);
        return { id: 1 };
      },
    },
    stockBalance: { upsert: async (a: unknown) => { captured.upserts.push(a); return {}; } },
    stocktakeSession: {
      update: async (a: { data: Record<string, unknown> }) => {
        captured.updates.push(a.data);
        return {};
      },
    },
  };
  const prisma = {
    systemSetting: { findUnique: async (a: { where: { key: string } }) => ({ key: a.where.key, value: settings[a.where.key] }) },
    stocktakeSession: { findUnique: async () => session },
    $transaction: async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
  } as unknown as PrismaService;
  const audits = { write: async () => undefined } as never;
  return { service: new StocktakesService(prisma, {} as never, {} as never, audits), captured };
}

const bigDiffLine = { itemId: 1, batchId: '', systemQtyBase: 10, countedQtyBase: 20, lastCost: 10 };

describe('StocktakesService.approve — حاجز الفروقات الكبيرة (§5.8.5/§6.3)', () => {
  it('BLOCK + فرق كبير دون تأكيد → يُرفض ولا تُطبَّق أي حركة', async () => {
    const { service, captured } = makeApproveService({ mode: 'BLOCK', threshold: '50', lines: [bigDiffLine] });
    await expect(service.approve(42, user, {})).rejects.toThrow('فرق');
    expect(captured.movements).toHaveLength(0);
    expect(captured.updates).toHaveLength(0);
  });

  it('BLOCK + فرق كبير مع تأكيد → يُعتمد مع تنبيه', async () => {
    const { service, captured } = makeApproveService({ mode: 'BLOCK', threshold: '50', lines: [bigDiffLine] });
    const res = (await service.approve(42, user, { confirm: true })) as { recountWarning?: string | null };
    expect(captured.movements).toHaveLength(1);
    expect(captured.movements[0]!.qtyBase).toBe(10);
    expect(captured.updates[0]!.status).toBe('APPROVED');
    expect(res.recountWarning).toBeTruthy();
  });

  it('WARN + فرق كبير دون تأكيد → يُعتمد مع تنبيه', async () => {
    const { service, captured } = makeApproveService({ mode: 'WARN', threshold: '50', lines: [bigDiffLine] });
    const res = (await service.approve(42, user, {})) as { recountWarning?: string | null };
    expect(captured.movements).toHaveLength(1);
    expect(res.recountWarning).toBeTruthy();
  });

  it('بلا حد (0): لا حاجز ولا تنبيه', async () => {
    const { service, captured } = makeApproveService({ mode: 'BLOCK', threshold: '0', lines: [bigDiffLine] });
    const res = (await service.approve(42, user, {})) as { recountWarning?: string | null };
    expect(captured.movements).toHaveLength(1);
    expect(res.recountWarning).toBeNull();
  });

  it('فرق دون الحد: لا حاجز', async () => {
    const smallDiff = { itemId: 1, batchId: '', systemQtyBase: 10, countedQtyBase: 11, lastCost: 10 };
    const { service, captured } = makeApproveService({ mode: 'BLOCK', threshold: '50', lines: [smallDiff] });
    const res = (await service.approve(42, user, {})) as { recountWarning?: string | null };
    expect(captured.movements).toHaveLength(1);
    expect(res.recountWarning).toBeNull();
  });
});
