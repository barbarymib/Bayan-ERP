import { describe, expect, it, vi } from 'vitest';
import { PurchasesService } from '../src/purchases/purchases.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { AuthUser } from '../src/auth/auth.decorators.js';
import type { CreatePurchaseDto } from '../src/purchases/purchases.dto.js';

const user = { id: 7, companyId: 1, repCode: 'M03' } as unknown as AuthUser;

interface Line {
  itemCode: string;
  qty: number;
  unitPrice: number;
  batchId?: string;
  expiry?: string;
}

/**
 * يبني خدمة المشتريات بواجهات وهمية ويلتقط:
 * - وسائط إنشاء بيان التوريد (البنود + landedCost + landedCostTotal)
 * - نداءات إدخال المخزون (stock.purchaseIn) وتحديث آخر سعر شراء
 */
function build(
  lineItems: Record<string, number>,
  opts: { trackBatch?: boolean; autoUpdateLastCost?: string | null } = {},
) {
  const calls = {
    create: [] as Record<string, unknown>[],
    purchaseIn: [] as Record<string, unknown>[],
    itemUpdate: [] as Record<string, unknown>[],
    batchCreate: [] as Record<string, unknown>[],
    batchUpdate: [] as Record<string, unknown>[],
  };

  const tx = {
    purchaseStatement: {
      create: async (args: Record<string, unknown>) => {
        calls.create.push(args);
        return { id: 99 };
      },
    },
    systemSetting: {
      findUnique: async (args: { where: { key: string } }) =>
        opts.autoUpdateLastCost == null || args.where.key !== 'purchase.auto_update_last_cost'
          ? null
          : { key: args.where.key, value: opts.autoUpdateLastCost },
    },
    item: {
      update: async (args: Record<string, unknown>) => {
        calls.itemUpdate.push(args);
        return {};
      },
    },
    batch: {
      findFirst: async () => null,
      create: async (args: Record<string, unknown>) => {
        calls.batchCreate.push(args);
        return { id: 1, ...(args as { data: Record<string, unknown> }).data };
      },
      update: async (args: Record<string, unknown>) => {
        calls.batchUpdate.push(args);
        return {};
      },
    },
  };

  const prisma = {
    supplier: { findUnique: async () => ({ id: 1, companyId: 1 }) },
    warehouse: { findUnique: async () => ({ id: 3, code: 'MAIN', companyId: 1 }) },
    item: {
      findFirst: async (args: { where: { code: string } }) => ({
        id: lineItems[args.where.code] ?? 0,
        code: args.where.code,
        baseUnitId: 1,
        trackBatch: opts.trackBatch ?? false,
        baseUnit: { measurement: 'WEIGHT', nameAr: 'كجم' },
      }),
    },
    purchaseStatement: {
      findUnique: async () => ({ id: 99, landedCostTotal: null, lines: [] }),
    },
    $transaction: async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
  } as unknown as PrismaService;

  const stock = {
    assertMovable: vi.fn(async () => ({ mode: 'OFF' as const, frozen: false })),
    purchaseIn: vi.fn(async (...a: unknown[]) => {
      calls.purchaseIn.push(a[1] as Record<string, unknown>);
    }),
  };

  const service = new PurchasesService(
    prisma,
    { issue: async () => 'PR-1' } as never,
    { open: async () => ({ id: 1 }) } as never,
    stock as never,
    { entry: async () => {}, resolveCashAccountId: async () => 1, cashEntry: async () => {} } as never,
    { write: async () => {} } as never,
  );

  return { service, calls };
}

function dto(lines: Line[], extra: Partial<CreatePurchaseDto> = {}): CreatePurchaseDto {
  return { supplierId: 1, warehouseId: 3, lines, ...extra } as CreatePurchaseDto;
}

describe('PurchasesService.create — توزيع مصاريف النقل Landed Cost (§5.5)', () => {
  const map = { A: 11, B: 22 };

  it('أساس القيمة: يوزّع النقل نسبياً لصافي البنود في landedCost والمخزون وآخر سعر شراء', async () => {
    const { service, calls } = build(map);
    await service.create(
      dto(
        [
          { itemCode: 'A', qty: 10, unitPrice: 30 },
          { itemCode: 'B', qty: 1, unitPrice: 100 },
        ],
        { shipping: 80, landedCostBasis: 'VALUE' },
      ),
      user,
    );

    const create = calls.create[0] as {
      data: { landedCostTotal: number; lines: { create: { landedCost: number }[] } };
    };
    expect(create.data.landedCostTotal).toBe(80);
    // A: صافي 300 + نصيب 60 → 36/وحدة، B: صافي 100 + نصيب 20 → 120/وحدة
    expect(create.data.lines.create[0]?.landedCost).toBe(36);
    expect(create.data.lines.create[1]?.landedCost).toBe(120);
    expect((calls.purchaseIn[0]?.lines as { cost: number }[])[0]?.cost).toBe(36);
    expect((calls.purchaseIn[1]?.lines as { cost: number }[])[0]?.cost).toBe(120);
    expect(calls.itemUpdate[0]).toMatchObject({ data: { lastPurchaseCost: 36 } });
    expect(calls.itemUpdate[1]).toMatchObject({ data: { lastPurchaseCost: 120 } });
  });

  it('أساس الكمية: يوزّع النقل بحسب الكمية الأساسية', async () => {
    const { service, calls } = build(map);
    await service.create(
      dto(
        [
          { itemCode: 'A', qty: 10, unitPrice: 30 },
          { itemCode: 'B', qty: 1, unitPrice: 100 },
        ],
        { shipping: 11, landedCostBasis: 'QTY' },
      ),
      user,
    );
    const create = calls.create[0] as { data: { lines: { create: { landedCost: number }[] } } };
    // A: 300+10 → 31/وحدة، B: 100+1 → 101/وحدة
    expect(create.data.lines.create[0]?.landedCost).toBe(31);
    expect(create.data.lines.create[1]?.landedCost).toBe(101);
  });

  it('بلا مصاريف نقل: التكلفة = صافي البند / الكمية و landedCostTotal = null', async () => {
    const { service, calls } = build(map);
    await service.create(
      dto([
        { itemCode: 'A', qty: 10, unitPrice: 30 },
        { itemCode: 'B', qty: 1, unitPrice: 100 },
      ]),
      user,
    );
    const create = calls.create[0] as {
      data: { landedCostTotal: number | null; lines: { create: { landedCost: number }[] } };
    };
    expect(create.data.landedCostTotal).toBeNull();
    expect(create.data.lines.create[0]?.landedCost).toBe(30);
    expect(create.data.lines.create[1]?.landedCost).toBe(100);
  });

  it('يتراجع لأساس الكمية عند بنود مجانية (صافي صفري) مع أساس القيمة', async () => {
    const { service, calls } = build(map);
    await service.create(
      dto(
        [
          { itemCode: 'A', qty: 3, unitPrice: 0 },
          { itemCode: 'B', qty: 1, unitPrice: 0 },
        ],
        { shipping: 40, landedCostBasis: 'VALUE' },
      ),
      user,
    );
    const create = calls.create[0] as { data: { lines: { create: { landedCost: number }[] } } };
    // [3,1] بالكمية → نصيب 30 و10، والتكلفة 10 للوحدة في الحالتين
    expect(create.data.lines.create[0]?.landedCost).toBe(10);
    expect(create.data.lines.create[1]?.landedCost).toBe(10);
  });
});

describe('PurchasesService.create — دفعات الأصناف (§5.1)', () => {
  it('يسجّل دفعة الصنف ويحفظ batchId على البند والمخزون', async () => {
    const { service, calls } = build({ A: 11 }, { trackBatch: true });
    await service.create(
      dto([{ itemCode: 'A', qty: 5, unitPrice: 10, batchId: 'B-1', expiry: '2027-01-15' }]),
      user,
    );

    expect(calls.batchCreate[0]).toMatchObject({ data: { itemId: 11, code: 'B-1', companyId: 1 } });
    expect((calls.batchCreate[0] as { data: { expiry?: unknown } }).data.expiry).toBeInstanceOf(Date);
    const create = calls.create[0] as { data: { lines: { create: { batchId: string }[] } } };
    expect(create.data.lines.create[0]?.batchId).toBe('B-1');
    expect((calls.purchaseIn[0]?.lines as { batchId?: string }[])[0]?.batchId).toBe('B-1');
  });

  it('يرفض دفعة على صنف لا يتتبع الدفعات', async () => {
    const { service, calls } = build({ A: 11 }, { trackBatch: false });
    await expect(
      service.create(dto([{ itemCode: 'A', qty: 5, unitPrice: 10, batchId: 'B-1' }]), user),
    ).rejects.toThrow('لا يتتبع الدفعات');
    expect(calls.create).toHaveLength(0);
  });

  it('يرفض تاريخ صلاحية بلا كود دفعة', async () => {
    const { service } = build({ A: 11 }, { trackBatch: true });
    await expect(
      service.create(dto([{ itemCode: 'A', qty: 5, unitPrice: 10, expiry: '2027-01-15' }]), user),
    ).rejects.toThrow('يتطلب كود دفعة');
  });
});

describe('PurchasesService.create — مفتاح إيقاف تحديث آخر سعر شراء (R3-B10)', () => {
  const map = { A: 11 };

  it('بلا إعداد (افتراضي): يحدّث lastPurchaseCost', async () => {
    const { service, calls } = build(map);
    await service.create(dto([{ itemCode: 'A', qty: 2, unitPrice: 50 }]), user);
    expect(calls.itemUpdate).toHaveLength(1);
    expect(calls.itemUpdate[0]).toMatchObject({ data: { lastPurchaseCost: 50 } });
  });

  it('الإعداد true: يحدّث lastPurchaseCost', async () => {
    const { service, calls } = build(map, { autoUpdateLastCost: 'true' });
    await service.create(dto([{ itemCode: 'A', qty: 2, unitPrice: 50 }]), user);
    expect(calls.itemUpdate).toHaveLength(1);
  });

  it('الإعداد false: لا يحدّث lastPurchaseCost مع بقاء المخزون والقيد', async () => {
    const { service, calls } = build(map, { autoUpdateLastCost: 'false' });
    await service.create(dto([{ itemCode: 'A', qty: 2, unitPrice: 50 }]), user);
    expect(calls.itemUpdate).toHaveLength(0);
    expect(calls.purchaseIn).toHaveLength(1);
    expect(calls.create).toHaveLength(1);
  });
});
