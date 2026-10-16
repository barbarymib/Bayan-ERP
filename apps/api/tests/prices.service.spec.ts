import { describe, expect, it, vi } from 'vitest';
import { PricesService } from '../src/prices/prices.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';

interface PriceRow {
  id: number;
  price: number;
}

/**
 * R3-A7 (§5.3) — بناء خدمة الأسعار بواجهات وهمية تسجّل:
 * - استعلام السعر السارٍ (currentPrice)
 * - إغلاق النوافذ السابقة (itemPrice.updateMany)
 * - إنشاء سطر مجدول جديد (itemPrice.create) أو تحديث سطر بنفس لحظة البدء
 * - سجل التغيير (priceHistory.create) والتدقيق (audits.write)
 */
function build(opts: { current?: PriceRow | null; sameStart?: PriceRow | null } = {}) {
  const calls = {
    updateMany: [] as Record<string, unknown>[],
    create: [] as Record<string, unknown>[],
    update: [] as Record<string, unknown>[],
    history: [] as Record<string, unknown>[],
    audit: [] as Record<string, unknown>[],
  };

  const itemPrice = {
    findFirst: async (args: { where: { validFrom?: unknown } }) => {
      const vf = args.where.validFrom;
      // currentPrice يفلتر بنافذة (lte)؛ sameStart يفلتر بلحظة محددة
      if (vf && typeof vf === 'object' && vf !== null && 'lte' in (vf as object)) {
        return (opts.current ?? null) as never;
      }
      return (opts.sameStart ?? null) as never;
    },
    updateMany: async (args: Record<string, unknown>) => {
      calls.updateMany.push(args);
      return { count: 1 };
    },
    create: async (args: { data: Record<string, unknown> }) => {
      calls.create.push(args);
      return { id: 100, ...args.data };
    },
    update: async (args: Record<string, unknown>) => {
      calls.update.push(args);
      return { id: 1 };
    },
  };

  const prisma = {
    item: {
      findFirst: async () => ({ id: 5, baseUnitId: 2 }),
      findUnique: async () => ({ code: 'IR-12-10', nameAr: 'حديد' }),
    },
    unit: { findUnique: async () => ({ id: 2, code: 'kg' }) },
    priceList: {
      findFirst: async () => ({ id: 3, code: 'RETAIL' }),
      findUnique: async () => ({ id: 3, code: 'RETAIL' }),
    },
    itemPrice,
    priceHistory: {
      create: async (args: Record<string, unknown>) => {
        calls.history.push(args);
        return { id: 1 };
      },
    },
    $transaction: async (cb: (t: unknown) => Promise<unknown>) => cb({ itemPrice }),
  } as unknown as PrismaService;

  const audits = {
    write: vi.fn(async (a: unknown) => {
      calls.audit.push(a as Record<string, unknown>);
    }),
  };

  const service = new PricesService(prisma, audits as never);
  return { service, calls };
}

describe('PricesService.set — التسعير المجدول R3-A7 (§5.3)', () => {
  it('سعر بـ validFrom مستقبلي يُنشئ سطراً جديداً ولا يمس السعر الحالي', async () => {
    const { service, calls } = build({ current: { id: 1, price: 100 }, sameStart: null });
    const future = '2030-01-01T00:00:00.000Z';

    const r = await service.set(
      { itemCode: 'IR-12-10', priceListCode: 'RETAIL', price: 250, validFrom: future },
      7,
      1,
    );

    // سطر جديد فعلاً، لا update للسعر الحالي
    expect(calls.create).toHaveLength(1);
    expect(calls.update).toHaveLength(0);
    const data = calls.create[0].data as Record<string, unknown>;
    expect(data.price).toBe(250);
    expect(data.companyId).toBe(1);
    expect((data.validFrom as Date).toISOString()).toBe(future);

    // تُغلق النافذة السابقة عند بدء السعر الجديد
    expect(calls.updateMany).toHaveLength(1);
    const close = calls.updateMany[0];
    expect((close.data as Record<string, unknown>).validTo).toEqual(new Date(future));
    const where = close.where as Record<string, unknown>;
    expect(where.itemId).toBe(5);
    expect(where.unitId).toBe(2);
    expect(where.priceListId).toBe(3);
    expect(where.companyId).toBe(1);

    expect(r.oldPrice).toBe(100);
    expect(r.newPrice).toBe(250);
    // سجل التغيير والتدقيق
    expect(calls.history).toHaveLength(1);
    expect(calls.audit[0].action).toBe('price.change');
  });

  it('سطر يبدأ بنفس اللحظة يُحدَّث بدل تكراره', async () => {
    const { service, calls } = build({ current: null, sameStart: { id: 55, price: 10 } });
    await service.set({ itemCode: 'IR-12-10', priceListCode: 'RETAIL', price: 90 }, 7, 1);

    expect(calls.create).toHaveLength(0);
    expect(calls.update).toHaveLength(1);
    const upd = calls.update[0] as Record<string, unknown>;
    expect((upd.where as Record<string, unknown>).id).toBe(55);
    expect((upd.data as Record<string, unknown>).price).toBe(90);
  });

  it('بدون validFrom: يبدأ فوراً ويُغلق النافذة السابقة في الحاضر', async () => {
    const before = Date.now();
    const { service, calls } = build({ current: { id: 1, price: 100 } });
    const r = await service.set({ itemCode: 'IR-12-10', priceListCode: 'RETAIL', price: 120 }, 7, 1);

    expect(calls.create).toHaveLength(1);
    const validFrom = (calls.create[0].data as Record<string, unknown>).validFrom as Date;
    expect(validFrom.getTime()).toBeGreaterThanOrEqual(before - 1000);
    const closeTo = (calls.updateMany[0].data as Record<string, unknown>).validTo as Date;
    expect(closeTo.getTime()).toBe(validFrom.getTime());
    expect(r.oldPrice).toBe(100);
  });

  it('أول سعر لصنف: oldPrice = null', async () => {
    const { service, calls } = build({ current: null, sameStart: null });
    const r = await service.set({ itemCode: 'IR-12-10', priceListCode: 'RETAIL', price: 80 }, 7, 1);
    expect(r.oldPrice).toBeNull();
    expect(r.newPrice).toBe(80);
    expect(calls.history).toHaveLength(1);
  });
});
