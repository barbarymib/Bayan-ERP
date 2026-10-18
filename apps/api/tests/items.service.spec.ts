import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ItemsService } from '../src/items/items.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { AuditLogsService } from '../src/audit-logs/audit-logs.service.js';

type Row = Record<string, unknown>;

const makeAudits = (sink?: Row[]) =>
  ({
    write: async (entry: Row) => {
      sink?.push(entry);
    },
  }) as unknown as AuditLogsService;

const UNIT_IDS: Record<string, number> = { kg: 11, ton: 10, bar: 12 };

function makePrisma() {
  const state = {
    update: [] as Row[],
    create: [] as Row[],
    finds: [] as Row[],
    audit: [] as Row[],
  };
  const prisma = {
    item: {
      findUnique: async () =>
        ({ id: 1, companyId: 1, nameAr: 'حديد', nameEn: null, active: true, categoryId: 2 }) as never,
      findFirst: async () => null,
      findMany: async (a: Row) => {
        state.finds.push(a);
        return [];
      },
      count: async () => 0,
      create: async (a: { data: Row }) => {
        state.create.push(a.data);
        return { id: 1, ...a.data } as never;
      },
      update: async (a: { data: Row }) => {
        state.update.push(a.data);
        return { id: 1, ...a.data } as never;
      },
    },
    category: { findFirst: async () => ({ id: 2, code: 'STEEL' }) as never },
    brand: { findFirst: async () => ({ id: 3, code: 'B1' }) as never },
    unit: {
      findUnique: async (a: { where: { code: string } }) => {
        const id = UNIT_IDS[a.where.code];
        return (id ? { id, code: a.where.code } : null) as never;
      },
    },
  } as unknown as PrismaService;
  return { prisma, state };
}

describe('ItemsService — تعديل بيانات الصنف الكاملة (R3-A10)', () => {
  it('يستبدل وحدات التحويل والخصائص عند التعديل (deleteMany + create)', async () => {
    const { prisma, state } = makePrisma();
    const svc = new ItemsService(prisma, makeAudits());
    await svc.update(
      1,
      {
        itemUnits: [{ unitCode: 'ton', factorToBase: 1000 }, { unitCode: 'bar', factorToBase: 10.656, isSale: true, isPurchase: false, allowDecimal: true, barcode: 'BC-1' }],
        attributes: [{ key: 'الدرجة', value: '36' }],
      },
      1,
    );
    expect(state.update[0]!.itemUnits).toEqual({
      deleteMany: {},
      create: [
        { unitId: 10, factorToBase: 1000, isSale: true, isPurchase: true, allowDecimal: true, barcode: undefined },
        { unitId: 12, factorToBase: 10.656, isSale: true, isPurchase: false, allowDecimal: true, barcode: 'BC-1' },
      ],
    });
    expect(state.update[0]!.attributes).toEqual({ deleteMany: {}, create: [{ key: 'الدرجة', value: '36' }] });
  });

  it('يمرّر brandCode/origin/minSalePrice/imageUrl/parentItemId للخادم', async () => {
    const { prisma, state } = makePrisma();
    const svc = new ItemsService(prisma, makeAudits());
    await svc.update(1, { brandCode: 'B1', origin: 'مصر', minSalePrice: 42000, imageUrl: 'http://x/img.png', parentItemId: 5 }, 1);
    expect(state.update[0]!).toMatchObject({ brandId: 3, origin: 'مصر', minSalePrice: 42000, imageUrl: 'http://x/img.png', parentItemId: 5 });
  });

  it('يمنع صنفاً أن يكون التنويع الأساسي لنفسه', async () => {
    const { prisma } = makePrisma();
    const svc = new ItemsService(prisma, makeAudits());
    await expect(svc.update(1, { parentItemId: 1 }, 1)).rejects.toBeInstanceOf(ConflictException);
  });

  it('يرفض وحدة تحويل غير معروفة', async () => {
    const { prisma } = makePrisma();
    const svc = new ItemsService(prisma, makeAudits());
    await expect(svc.update(1, { itemUnits: [{ unitCode: 'bogus', factorToBase: 1 }] }, 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('لا يعمد وحدات/خصائص إذا لم تُمرَّر (تعديل جزئي)', async () => {
    const { prisma, state } = makePrisma();
    const svc = new ItemsService(prisma, makeAudits());
    await svc.update(1, { nameAr: 'اسم جديد' }, 1);
    expect(state.update[0]!.itemUnits).toBeUndefined();
    expect(state.update[0]!.attributes).toBeUndefined();
  });

  it('تتضمّن قائمة الأصناف وحدات التحويل', async () => {
    const { prisma, state } = makePrisma();
    const svc = new ItemsService(prisma, makeAudits());
    await svc.list({}, 1);
    expect((state.finds[0]!.include as Row).itemUnits).toBeTruthy();
  });

  it('ينشئ الصنف مع وحدات التحويل والخصائص', async () => {
    const { prisma, state } = makePrisma();
    const svc = new ItemsService(prisma, makeAudits());
    await svc.create(
      {
        code: 'T-1',
        nameAr: 'صنف',
        categoryCode: 'STEEL',
        baseUnitCode: 'kg',
        itemUnits: [{ unitCode: 'ton', factorToBase: 1000 }],
        attributes: [{ key: 'النوع', value: 'ملحوم' }],
      },
      1,
    );
    expect(state.create[0]!.itemUnits).toEqual({
      create: [{ unitId: 10, factorToBase: 1000, isSale: true, isPurchase: true, allowDecimal: true, barcode: undefined }],
    });
    expect(state.create[0]!.attributes).toEqual({ create: [{ key: 'النوع', value: 'ملحوم' }] });
  });
});
