import { describe, expect, it } from 'vitest';
import { BatchesService } from '../src/batches/batches.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';

interface Captured {
  findMany: { where: Record<string, unknown> }[];
  create: { data: Record<string, unknown> }[];
  update: { where: { id: number }; data: Record<string, unknown> }[];
  delete: { where: { id: number } }[];
}

interface Options {
  item?: { id: number; trackBatch: boolean } | null;
  existing?: { id: number } | null;
  batch?: { id: number; itemId: number; code: string; companyId: number | null } | null;
  balances?: number;
  movements?: number;
}

function makePrisma(opts: Options = {}): { prisma: PrismaService; captured: Captured } {
  const captured: Captured = { findMany: [], create: [], update: [], delete: [] };
  const tx = {
    stockBalance: { count: async () => opts.balances ?? 0 },
    stockMovement: { count: async () => opts.movements ?? 0 },
  };
  const prisma = {
    item: {
      findFirst: async () => ('item' in opts ? opts.item : { id: 11, trackBatch: true }),
    },
    batch: {
      findUnique: async () =>
        ('batch' in opts ? opts.batch : { id: 9, itemId: 11, code: 'B-1', companyId: 1 }),
      findFirst: async () => ('existing' in opts ? opts.existing : null),
      findMany: async (args: { where: Record<string, unknown> }) => {
        captured.findMany.push(args);
        return [];
      },
      create: async (args: { data: Record<string, unknown> }) => {
        captured.create.push(args);
        return { id: 4, ...args.data };
      },
      update: async (args: { where: { id: number }; data: Record<string, unknown> }) => {
        captured.update.push(args);
        return { id: args.where.id };
      },
      delete: async (args: { where: { id: number } }) => {
        captured.delete.push(args);
        return { id: args.where.id };
      },
    },
    $transaction: async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
  } as unknown as PrismaService;
  return { prisma, captured };
}

describe('BatchesService (§5.1)', () => {
  it('يفلتر القائمة بالصنف والشركة ويستثني المنتهية افتراضياً', async () => {
    const { prisma, captured } = makePrisma();
    await new BatchesService(prisma).list({ itemId: 11 }, 5);
    const where = captured.findMany[0]!.where;
    expect(where.itemId).toBe(11);
    expect(where.companyId).toBe(5);
    expect(where.OR).toBeDefined();
  });

  it('يرفض إنشاء دفعة لصنف لا يتتبع الدفعات', async () => {
    const { prisma, captured } = makePrisma({ item: { id: 11, trackBatch: false } });
    await expect(new BatchesService(prisma).create({ itemId: 11, code: 'B-1' }, 1)).rejects.toThrow(
      'لا يتتبع الدفعات',
    );
    expect(captured.create).toHaveLength(0);
  });

  it('ينشئ دفعة جديدة مرتبطة بالشركة والصنف', async () => {
    const { prisma, captured } = makePrisma();
    const res = await new BatchesService(prisma).create(
      { itemId: 11, code: 'B-1', expiry: '2027-01-15' },
      7,
    );
    expect(res.id).toBe(4);
    expect(captured.create[0]!.data.itemId).toBe(11);
    expect(captured.create[0]!.data.code).toBe('B-1');
    expect(captured.create[0]!.data.companyId).toBe(7);
    expect(captured.create[0]!.data.expiry).toBeInstanceOf(Date);
  });

  it('يحدّث الدفعة القائمة بدل إنشاء أخرى عند تكرار الكود', async () => {
    const { prisma, captured } = makePrisma({ existing: { id: 9 } });
    await new BatchesService(prisma).create({ itemId: 11, code: 'B-1', expiry: '2027-01-15' }, 7);
    expect(captured.create).toHaveLength(0);
    expect(captured.update[0]!.where.id).toBe(9);
  });

  it('يمنع حذف دفعة لها رصيد أو حركات مخزنية', async () => {
    const { prisma, captured } = makePrisma({ balances: 1 });
    await expect(new BatchesService(prisma).remove(9, 1)).rejects.toThrow('رصيد');
    expect(captured.delete).toHaveLength(0);
  });

  it('يحذف دفعة بلا رصيد ولا حركات', async () => {
    const { prisma, captured } = makePrisma();
    const res = await new BatchesService(prisma).remove(9, 1);
    expect(res).toEqual({ ok: true });
    expect(captured.delete).toHaveLength(1);
  });
});
