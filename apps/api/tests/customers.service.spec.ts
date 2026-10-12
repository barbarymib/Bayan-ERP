import { describe, expect, it } from 'vitest';
import { CustomersService } from '../src/customers/customers.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';

type Row = Record<string, unknown>;

function makePrisma(options: { openAssignments?: Row[] } = {}) {
  const state = {
    createdAssignments: [] as Row[],
    closed: [] as number[],
    customerCreate: [] as Row[],
  };
  const prisma = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma as never),
    priceList: { findFirst: async () => ({ id: 3, code: 'RETAIL', nameAr: 'تجارة' }) },
    user: {
      findUnique: async (a: { where: { repCode: string } }) =>
        ({ id: 42, name: 'مندوب', repCode: a.where.repCode }) as never,
      findFirst: async () => null,
    },
    customer: {
      findFirst: async () => null,
      findUnique: async () => ({ id: 1, companyId: 1 }) as never,
      create: async (a: { data: Row }) => {
        state.customerCreate.push(a.data);
        return { id: 1, ...a.data } as never;
      },
      update: async (a: { data: Row }) => ({ id: 1, ...a.data }) as never,
    },
    customerRepAssignment: {
      findMany: async () => options.openAssignments ?? [],
      create: async (a: { data: Row }) => {
        state.createdAssignments.push(a.data);
        return { id: 100 + state.createdAssignments.length, ...a.data } as never;
      },
      updateMany: async (a: { where: { id: { in: number[] } } }) => {
        state.closed.push(...a.where.id.in);
        return { count: a.where.id.in.length } as never;
      },
    },
  } as unknown as PrismaService;
  return { prisma, state };
}

describe('CustomersService — مزامنة تعيين المندوب (CustomerRepAssignment)', () => {
  it('ينشئ تعييناً مفتوحاً عند إنشاء عميل بمندوب، مربوطاً بالمستأجر', async () => {
    const { prisma, state } = makePrisma();
    const svc = new CustomersService(prisma);
    await svc.create({ nameAr: 'عميل', repCode: 'M03' }, 1);
    expect(state.createdAssignments).toEqual([
      { customerId: 1, repId: 42, companyId: 1 },
    ]);
  });

  it('لا ينشئ تعييناً عند إنشاء عميل بدون مندوب', async () => {
    const { prisma, state } = makePrisma();
    const svc = new CustomersService(prisma);
    await svc.create({ nameAr: 'عميل' }, 1);
    expect(state.createdAssignments).toEqual([]);
  });

  it('عند إعادة تعيين عميل: يغلق التعيين المفتوح السابق ويفتح تعييناً للمندوب الجديد', async () => {
    const { prisma, state } = makePrisma({ openAssignments: [{ id: 5, repId: 99 }] });
    const svc = new CustomersService(prisma);
    await svc.update(1, { repCode: 'M03' }, 1);
    expect(state.closed).toEqual([5]);
    expect(state.createdAssignments).toEqual([
      { customerId: 1, repId: 42, companyId: 1 },
    ]);
  });

  it('لا يعيد فتح تعيين إن كان التعيين المفتوح مطابقاً للمندوب نفسه', async () => {
    const { prisma, state } = makePrisma({ openAssignments: [{ id: 5, repId: 42 }] });
    const svc = new CustomersService(prisma);
    await svc.update(1, { repCode: 'M03' }, 1);
    expect(state.closed).toEqual([]);
    expect(state.createdAssignments).toEqual([]);
  });
});

