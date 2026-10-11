import { describe, expect, it } from 'vitest';
import { BrandsService } from '../src/brands/brands.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';

interface Captured {
  create: { data: Record<string, unknown> }[];
  findMany: { where: Record<string, unknown> }[];
  delete: { where: { id: number } }[];
}

interface Options {
  existingBrand?: unknown;
  itemCount?: number;
  findOne?: unknown;
}

function makePrisma(opts: Options = {}): { prisma: PrismaService; captured: Captured } {
  const captured: Captured = { create: [], findMany: [], delete: [] };
  const prisma = {
    brand: {
      findFirst: async () => opts.existingBrand ?? null,
      findUnique: async () => ('findOne' in opts ? opts.findOne : { id: 9, companyId: 1, code: 'X' }),
      findMany: async (args: { where: Record<string, unknown> }) => {
        captured.findMany.push(args);
        return [{ id: 9, code: 'X' }];
      },
      count: async () => 1,
      create: async (args: { data: Record<string, unknown> }) => {
        captured.create.push(args);
        return { id: 4, ...args.data };
      },
      update: async () => ({ id: 9 }),
      delete: async (args: { where: { id: number } }) => {
        captured.delete.push(args);
        return { id: args.where.id };
      },
    },
    item: { count: async () => opts.itemCount ?? 0 },
  } as unknown as PrismaService;
  return { prisma, captured };
}

describe('BrandsService', () => {
  it('ينشئ ماركة مرتبطة بالشركة', async () => {
    const { prisma, captured } = makePrisma();
    const res = await new BrandsService(prisma).create({ code: 'CRC', nameAr: 'الخليج' }, 5);
    expect(res.id).toBe(4);
    expect(captured.create[0]!.data.companyId).toBe(5);
    expect(captured.create[0]!.data.code).toBe('CRC');
  });

  it('يرفض كود ماركة مكرراً داخل نفس الشركة', async () => {
    const { prisma, captured } = makePrisma({ existingBrand: { id: 1 } });
    await expect(new BrandsService(prisma).create({ code: 'CRC', nameAr: 'x' }, 5)).rejects.toThrow(
      'already exists',
    );
    expect(captured.create).toHaveLength(0);
  });

  it('يمرّر نطاق الشركة في القائمة', async () => {
    const { prisma, captured } = makePrisma();
    await new BrandsService(prisma).list({}, 7);
    expect(captured.findMany[0]!.where.companyId).toBe(7);
  });

  it('يمنع حذف ماركة مستخدمة في أصناف', async () => {
    const { prisma, captured } = makePrisma({ itemCount: 2 });
    await expect(new BrandsService(prisma).remove(9, 1)).rejects.toThrow('items');
    expect(captured.delete).toHaveLength(0);
  });

  it('يحذف ماركة غير مستخدمة', async () => {
    const { prisma, captured } = makePrisma({ itemCount: 0 });
    const res = await new BrandsService(prisma).remove(9, 1);
    expect(res).toEqual({ ok: true });
    expect(captured.delete).toHaveLength(1);
  });
});
