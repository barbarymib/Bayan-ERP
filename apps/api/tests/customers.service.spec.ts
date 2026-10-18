import { describe, expect, it } from 'vitest';
import { CustomersService } from '../src/customers/customers.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { AuditLogsService } from '../src/audit-logs/audit-logs.service.js';

const makeAudits = (sink?: Row[]) =>
  ({
    write: async (entry: Row) => {
      sink?.push(entry);
    },
  }) as unknown as AuditLogsService;

type Row = Record<string, unknown>;

function makePrisma(options: { openAssignments?: Row[]; customer?: Row | null } = {}) {
  const state = {
    createdAssignments: [] as Row[],
    closed: [] as number[],
    customerCreate: [] as Row[],
    customerUpdate: [] as Row[],
    audit: [] as Row[],
  };
  const prisma = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma as never),
    priceList: { findFirst: async () => ({ id: 3, code: 'RETAIL', nameAr: 'تجارة' }) },
    user: {
      findUnique: async (a: { where: { repCode: string } }) =>
        ({ id: 42, name: 'مندوب', repCode: a.where.repCode }) as never,
      findFirst: async () => null,
      findMany: async () => [],
    },
    customer: {
      findFirst: async () => null,
      findUnique: async () => {
        if (options.customer === null) return null as never;
        const base = options.customer === undefined ? ({ id: 1, companyId: 1 } as Row) : options.customer;
        return { assignments: [], ...base } as never;
      },
      create: async (a: { data: Row }) => {
        state.customerCreate.push(a.data);
        return { id: 1, ...a.data } as never;
      },
      update: async (a: { data: Row }) => {
        state.customerUpdate.push(a.data);
        return { id: 1, ...a.data } as never;
      },
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
    const svc = new CustomersService(prisma, makeAudits());
    await svc.create({ nameAr: 'عميل', repCode: 'M03' }, 1);
    expect(state.createdAssignments).toEqual([
      { customerId: 1, repId: 42, companyId: 1 },
    ]);
  });

  it('لا ينشئ تعييناً عند إنشاء عميل بدون مندوب', async () => {
    const { prisma, state } = makePrisma();
    const svc = new CustomersService(prisma, makeAudits());
    await svc.create({ nameAr: 'عميل' }, 1);
    expect(state.createdAssignments).toEqual([]);
  });

  it('عند إعادة تعيين عميل: يغلق التعيين المفتوح السابق ويفتح تعييناً للمندوب الجديد', async () => {
    const { prisma, state } = makePrisma({ openAssignments: [{ id: 5, repId: 99 }] });
    const svc = new CustomersService(prisma, makeAudits());
    await svc.update(1, { repCode: 'M03' }, 1);
    expect(state.closed).toEqual([5]);
    expect(state.createdAssignments).toEqual([
      { customerId: 1, repId: 42, companyId: 1 },
    ]);
  });

  it('لا يعيد فتح تعيين إن كان التعيين المفتوح مطابقاً للمندوب نفسه', async () => {
    const { prisma, state } = makePrisma({ openAssignments: [{ id: 5, repId: 42 }] });
    const svc = new CustomersService(prisma, makeAudits());
    await svc.update(1, { repCode: 'M03' }, 1);
    expect(state.closed).toEqual([]);
    expect(state.createdAssignments).toEqual([]);
  });
});

describe('CustomersService — تقييم سداد العميل (customer.rating)', () => {
  it('يحفظ تقييم السداد والملاحظات ويسجل التدقيق', async () => {
    const audit: Row[] = [];
    const { prisma, state } = makePrisma();
    const svc = new CustomersService(prisma, makeAudits(audit));
    await svc.rate(1, { paymentRating: 80, paymentNotes: 'منتظم' }, 1, 7);
    expect(state.customerUpdate).toEqual([{ paymentRating: 80, paymentNotes: 'منتظم' }]);
    expect(audit).toHaveLength(1);
    expect(audit[0] as Row).toMatchObject({ action: 'customer.rate', entity: 'Customer', entityId: 1 });
    expect((audit[0] as Row).afterJson).toEqual({ paymentRating: 80, paymentNotes: 'منتظم' });
  });

  it('يحدّث التقييم فقط دون المساس بالملاحظات عند إرسال الحقل وحده', async () => {
    const { prisma, state } = makePrisma();
    const svc = new CustomersService(prisma, makeAudits());
    await svc.rate(1, { paymentRating: 40 }, 1, 7);
    expect(state.customerUpdate).toEqual([{ paymentRating: 40 }]);
  });

  it('يرفض تقييم عميل خارج المستأجر (NotFound)', async () => {
    const { prisma } = makePrisma({ customer: null });
    const svc = new CustomersService(prisma, makeAudits());
    await expect(svc.rate(1, { paymentRating: 50 }, 1, 7)).rejects.toThrow();
  });
});

