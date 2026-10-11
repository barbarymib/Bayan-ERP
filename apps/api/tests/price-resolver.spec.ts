import { describe, expect, it } from 'vitest';
import { PriceResolverService } from '../src/common/price-resolver.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';

type SpecialRow = {
  customerId?: number | null;
  customerGroupId?: number | null;
  priceListId?: number | null;
  price: number;
  validFrom?: Date;
  validTo?: Date | null;
};

function mockPrisma(overrides: Record<string, unknown> = {}): PrismaService {
  return {
    customer: { findFirst: async () => null },
    specialPrice: { findMany: async () => [] },
    itemPrice: { findFirst: async () => null },
    ...overrides,
  } as unknown as PrismaService;
}

const customerScope = () => ({
  findFirst: async () => ({ customerGroupId: 7, priceListId: 3 }),
});

describe('PriceResolverService (§5.16 الأسعار الخاصة)', () => {
  const args = { itemId: 4, unitId: 1, customerId: 5, priceListId: 3 };

  it('أولوية السعر الخاص: عميل > مجموعة > قائمة أسعار > عام', async () => {
    const all: SpecialRow[] = [
      { price: 10 },
      { priceListId: 3, price: 20 },
      { customerGroupId: 7, price: 30 },
      { customerId: 5, price: 40 },
    ];
    const svc = new PriceResolverService(
      mockPrisma({ customer: customerScope(), specialPrice: { findMany: async () => all } }),
    );
    expect(await svc.resolve(args)).toBe(40);
  });

  it('يتراجع للمجموعة عندما لا يوجد سعر للعميل', async () => {
    const rows: SpecialRow[] = [
      { price: 10 },
      { priceListId: 3, price: 20 },
      { customerGroupId: 7, price: 30 },
    ];
    const svc = new PriceResolverService(
      mockPrisma({ customer: customerScope(), specialPrice: { findMany: async () => rows } }),
    );
    expect(await svc.resolve(args)).toBe(30);
  });

  it('يتراجع لقائمة الأسعار ثم للسعر العام', async () => {
    const onlyList: SpecialRow[] = [{ priceListId: 3, price: 20 }];
    const svcList = new PriceResolverService(
      mockPrisma({ customer: customerScope(), specialPrice: { findMany: async () => onlyList } }),
    );
    expect(await svcList.resolve(args)).toBe(20);

    const onlyGlobal: SpecialRow[] = [{ price: 10 }];
    const svcGlobal = new PriceResolverService(
      mockPrisma({ customer: customerScope(), specialPrice: { findMany: async () => onlyGlobal } }),
    );
    expect(await svcGlobal.resolve(args)).toBe(10);
  });

  it('يتخطى السعر الخاص غير النشط أو منتهي الصلاحية', async () => {
    const past = new Date('2020-01-01');
    const svc = new PriceResolverService(
      mockPrisma({
        customer: customerScope(),
        specialPrice: {
          findMany: async () => [{ customerId: 5, price: 40, validFrom: past, validTo: past }],
        },
      }),
    );
    // السطر منتهي ⇒ findMany لا يعيده، وقائمة الأسعار تُرجع السعر العادي
    const itemPrice = { findFirst: async () => ({ price: '99.5' }) };
    const svc2 = new PriceResolverService(
      mockPrisma({ customer: customerScope(), specialPrice: { findMany: async () => [] }, itemPrice }),
    );
    expect(await svc2.resolve(args)).toBe(99.5);
    expect(await svc.resolve({ itemId: 4, unitId: 1 })).toBeUndefined();
  });

  it('يسقط لقائمة الأسعار عندما لا يوجد أي سعر خاص', async () => {
    const calls: unknown[] = [];
    const svc = new PriceResolverService(
      mockPrisma({
        customer: customerScope(),
        itemPrice: {
          findFirst: async (where: unknown) => {
            calls.push(where);
            return { price: '123.45' };
          },
        },
      }),
    );
    expect(await svc.resolve(args)).toBe(123.45);
    expect(calls).toHaveLength(1);
  });

  it('يعيد undefined حين لا توجد قائمة أسعار ولا سعر خاص', async () => {
    const svc = new PriceResolverService(mockPrisma());
    expect(await svc.resolve({ itemId: 4, unitId: 1 })).toBeUndefined();
  });

  it('يستخدم قائمة أسعار العميل عند عدم تمرير priceListId', async () => {
    let seen: unknown;
    const svc = new PriceResolverService(
      mockPrisma({
        customer: customerScope(),
        itemPrice: {
          findFirst: async (w: unknown) => {
            seen = w;
            return { price: 50 };
          },
        },
      }),
    );
    expect(await svc.resolve({ itemId: 4, unitId: 1, customerId: 5 })).toBe(50);
    expect(JSON.stringify(seen)).toContain('"priceListId":3');
  });
});
