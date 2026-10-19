import { describe, expect, it, vi } from 'vitest';
import { ApprovalsService } from '../src/approvals/approvals.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { AuthUser } from '../src/auth/auth.decorators.js';

const user = { id: 2, permissions: ['discount.approve'] } as unknown as AuthUser;
const returnUser = { id: 2, permissions: ['return.approve'] } as unknown as AuthUser;

type Dispatch = { refType: string; refId: number };

function build(dispatch: Dispatch = { refType: 'price_statement', refId: 5 }) {
  const calls: {
    statementUpdates: Record<string, unknown>[];
    returnUpdates: Record<string, unknown>[];
    decisionUpdates: Record<string, unknown>[];
    approvalUpdateMany: Record<string, unknown>[];
  } = { statementUpdates: [], returnUpdates: [], decisionUpdates: [], approvalUpdateMany: [] };

  const tx = {
    stockReservation: { updateMany: async () => ({ count: 0 }) },
    priceStatement: {
      findUnique: async ({ where }: { where: { id: number } }) => ({ id: where.id, status: 'DRAFT' }),
      update: async (args: unknown) => {
        calls.statementUpdates.push(args as Record<string, unknown>);
        return {};
      },
    },
    returnStatement: {
      findUnique: async ({ where }: { where: { id: number } }) => ({ id: where.id, status: 'DRAFT' }),
      update: async (args: unknown) => {
        calls.returnUpdates.push(args as Record<string, unknown>);
        return {};
      },
    },
    approval: {
      updateMany: async (args: unknown) => {
        calls.approvalUpdateMany.push(args as Record<string, unknown>);
        return { count: 1 };
      },
    },
  };

  const releaseReservations = vi.fn(async (_tx: unknown, _type: string, _id: number) => undefined);
  const assertSalePermitted = vi.fn(async () => undefined);
  const finalizeStatement = vi.fn(async () => true);
  const finalizeReturn = vi.fn(async () => true);
  const assertCustomerCredit = vi.fn(async () => undefined);

  const prisma = {
    approval: {
      findUnique: async () => ({ id: 1, type: 'BELOW_COST', refType: dispatch.refType, refId: dispatch.refId, status: 'PENDING' }),
      update: async (args: unknown) => {
        calls.decisionUpdates.push(args as Record<string, unknown>);
        return {};
      },
    },
    priceStatement: {
      findUnique: async () => ({
        id: 5,
        status: 'DRAFT',
        companyId: null,
        customerId: 9,
        net: 100,
        warehouseId: 3,
        lines: [{ itemId: 11, qtyBase: 2 }],
      }),
    },
    returnStatement: { findUnique: async () => ({ id: dispatch.refId, status: 'DRAFT' }) },
    $transaction: async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
  } as unknown as PrismaService;

  const service = new ApprovalsService(
    prisma,
    { finalizeStatement, finalizeReturn, assertCustomerCredit } as never,
    { releaseReservations, assertSalePermitted } as never,
    { write: async () => undefined } as never,
  );

  return { service, prisma, calls, releaseReservations, assertSalePermitted, finalizeStatement, finalizeReturn, assertCustomerCredit };
}

describe('ApprovalsService lifecycle', () => {
  it('رفض بيان: يلغي المستند، يحرر الحجز، ويغلق الموافقات المعلقة الأخرى', async () => {
    const { service, calls, releaseReservations } = build();
    const res = await service.decide(1, { approved: false, note: 'الخصم مرفوض' }, user);
    expect(res.approved).toBe(false);

    const st = calls.statementUpdates[0]!.data as Record<string, unknown>;
    expect(st.status).toBe('CANCELLED');
    expect(st.cancelledById).toBe(2);
    expect(st.cancelReason).toBe('الخصم مرفوض');

    expect(releaseReservations).toHaveBeenCalledTimes(1);
    expect(releaseReservations.mock.calls[0]![1]).toBe('price_statement');
    expect(releaseReservations.mock.calls[0]![2]).toBe(5);

    const sibling = calls.approvalUpdateMany.find((c) => (c.where as Record<string, unknown>).id !== undefined);
    expect(sibling).toBeDefined();
    expect((sibling!.data as Record<string, unknown>).status).toBe('REJECTED');
  });

  it('اعتماد بيان: ينفذ التثبيت المالي/المخزني', async () => {
    const { service, finalizeStatement } = build();
    const res = await service.decide(1, { approved: true }, user);
    expect(res.approved).toBe(true);
    expect(finalizeStatement).toHaveBeenCalledWith(5, user);
  });

  it('اعتماد BELOW_MIN_PRICE: يُربط بصلاحية discount.approve (G7/G8)', async () => {
    const { prisma } = build();
    const belowMinPrisma = {
      ...prisma,
      approval: {
        findUnique: async () => ({
          id: 3,
          type: 'BELOW_MIN_PRICE',
          refType: 'price_statement',
          refId: 5,
          status: 'PENDING',
        }),
        update: async () => ({}),
      },
    } as unknown as PrismaService;
    const finalizeStatement = vi.fn(async () => true);
    const svc = new ApprovalsService(
      belowMinPrisma,
      { finalizeStatement, finalizeReturn: async () => true, assertCustomerCredit: async () => undefined } as never,
      { releaseReservations: async () => undefined, assertSalePermitted: async () => undefined } as never,
      { write: async () => undefined } as never,
    );
    await svc.decide(3, { approved: true }, user);
    expect(finalizeStatement).toHaveBeenCalledWith(5, user);
  });

  it('رفض مرتجع: يلغي بيان المرتجع', async () => {
    const { prisma, calls } = build();
    const returnPrisma = {
      ...prisma,
      approval: {
        findUnique: async () => ({ id: 2, type: 'RETURN', refType: 'return_statement', refId: 9, status: 'PENDING' }),
        update: async () => ({}),
      },
    } as unknown as PrismaService;
    const svc = new ApprovalsService(
      returnPrisma,
      { finalizeStatement: async () => true, finalizeReturn: async () => true } as never,
      { releaseReservations: async () => undefined, assertSalePermitted: async () => undefined } as never,
      { write: async () => undefined } as never,
    );
    await svc.decide(2, { approved: false }, returnUser);
    expect(calls.returnUpdates.length).toBeGreaterThan(0);
    expect((calls.returnUpdates[0]!.data as Record<string, unknown>).status).toBe('CANCELLED');
  });

  it('يرفض الاعتماد على مستند ملغي', async () => {
    const { prisma } = build();
    const cancelledPrisma = {
      ...prisma,
      priceStatement: { findUnique: async () => ({ id: 5, status: 'CANCELLED' }) },
    } as unknown as PrismaService;
    const svc = new ApprovalsService(
      cancelledPrisma,
      { finalizeStatement: async () => true, finalizeReturn: async () => true } as never,
      { releaseReservations: async () => undefined, assertSalePermitted: async () => undefined } as never,
      { write: async () => undefined } as never,
    );
    await expect(svc.decide(1, { approved: true }, user)).rejects.toThrow('ملغي');
  });

  it('اعتماد مرتجع CASH يتطلب return.cash_refund (G9) — يُرفض بلا الصلاحية ويبقى القرار معلّقاً', async () => {
    const { prisma, calls } = build();
    const cashPrisma = {
      ...prisma,
      approval: {
        findUnique: async () => ({ id: 4, type: 'RETURN', refType: 'return_statement', refId: 9, status: 'PENDING' }),
        update: async (args: unknown) => {
          calls.decisionUpdates.push(args as Record<string, unknown>);
          return {};
        },
      },
      returnStatement: { findUnique: async () => ({ id: 9, status: 'DRAFT', settlement: 'CASH' }) },
    } as unknown as PrismaService;
    const finalizeReturn = vi.fn(async () => true);
    const svc = new ApprovalsService(
      cashPrisma,
      { finalizeStatement: async () => true, finalizeReturn } as never,
      { releaseReservations: async () => undefined, assertSalePermitted: async () => undefined } as never,
      { write: async () => undefined } as never,
    );
    await expect(svc.decide(4, { approved: true }, returnUser)).rejects.toThrow(/return\.cash_refund/);
    expect(finalizeReturn).not.toHaveBeenCalled();
    expect(calls.decisionUpdates).toHaveLength(0);
  });

  it('اعتماد مرتجع CASH بصلاحية return.cash_refund يمرّ وينفّذ التثبيت (G9)', async () => {
    const { prisma } = build();
    const cashPrisma = {
      ...prisma,
      approval: {
        findUnique: async () => ({ id: 4, type: 'RETURN', refType: 'return_statement', refId: 9, status: 'PENDING' }),
        update: async () => ({}),
      },
      returnStatement: { findUnique: async () => ({ id: 9, status: 'DRAFT', settlement: 'CASH' }) },
    } as unknown as PrismaService;
    const finalizeReturn = vi.fn(async () => true);
    const svc = new ApprovalsService(
      cashPrisma,
      { finalizeStatement: async () => true, finalizeReturn } as never,
      { releaseReservations: async () => undefined, assertSalePermitted: async () => undefined } as never,
      { write: async () => undefined } as never,
    );
    const cashUser = { id: 2, permissions: ['return.approve', 'return.cash_refund'] } as unknown as AuthUser;
    await svc.decide(4, { approved: true }, cashUser);
    expect(finalizeReturn).toHaveBeenCalledWith(9, cashUser);
  });

  it('لا يعتمد المستخدم مرتجعاً أنشأه بنفسه (§5.9 — يلزم معتمِد ثانٍ)', async () => {
    const { prisma, calls } = build();
    const selfPrisma = {
      ...prisma,
      approval: {
        findUnique: async () => ({ id: 6, type: 'RETURN', refType: 'return_statement', refId: 9, status: 'PENDING', requestedById: 2 }),
        update: async (args: unknown) => {
          calls.decisionUpdates.push(args as Record<string, unknown>);
          return {};
        },
      },
    } as unknown as PrismaService;
    const finalizeReturn = vi.fn(async () => true);
    const svc = new ApprovalsService(
      selfPrisma,
      { finalizeStatement: async () => true, finalizeReturn } as never,
      { releaseReservations: async () => undefined, assertSalePermitted: async () => undefined } as never,
      { write: async () => undefined } as never,
    );
    await expect(svc.decide(6, { approved: true }, returnUser)).rejects.toThrow(/معتمِد ثان/i);
    expect(finalizeReturn).not.toHaveBeenCalled();
    expect(calls.decisionUpdates).toHaveLength(0);
  });

  it('يعتمد المستخدم مرتجعاً أنشأه غيره (معتمِد ثانٍ)', async () => {
    const { prisma } = build();
    const otherPrisma = {
      ...prisma,
      approval: {
        findUnique: async () => ({ id: 7, type: 'RETURN', refType: 'return_statement', refId: 9, status: 'PENDING', requestedById: 99 }),
        update: async () => ({}),
      },
    } as unknown as PrismaService;
    const finalizeReturn = vi.fn(async () => true);
    const svc = new ApprovalsService(
      otherPrisma,
      { finalizeStatement: async () => true, finalizeReturn } as never,
      { releaseReservations: async () => undefined, assertSalePermitted: async () => undefined } as never,
      { write: async () => undefined } as never,
    );
    await svc.decide(7, { approved: true }, returnUser);
    expect(finalizeReturn).toHaveBeenCalledWith(9, returnUser);
  });
});

describe('ApprovalsService.list (R4-B3)', () => {
  function listHarness() {
    const calls: { where: Record<string, unknown> }[] = [];
    const prisma = {
      approval: {
        findMany: async (args: { where: Record<string, unknown> }) => {
          calls.push(args);
          return [];
        },
      },
      priceStatement: { findMany: async () => [] },
      returnStatement: { findMany: async () => [] },
    } as unknown as PrismaService;
    const svc = new ApprovalsService(
      prisma,
      {} as never,
      {} as never,
      { write: async () => undefined } as never,
    );
    return { svc, calls };
  }

  it('يحصر القائمة في أنواع الطلبات التي يملك المستخدم صلاحيتها', async () => {
    const { svc, calls } = listHarness();
    await svc.list({}, 1, ['return.approve']);
    const where = calls[0]!.where as { type?: { in?: string[] } };
    expect(where.type?.in).toEqual(['RETURN']);
  });

  it('يمنح حامل صلاحية الخصومات كل أنواع الخصم دون المرتجعات', async () => {
    const { svc, calls } = listHarness();
    await svc.list({}, 1, ['discount.approve']);
    const where = calls[0]!.where as { type?: { in?: string[] } };
    expect(where.type?.in).toEqual(
      expect.arrayContaining(['ITEM_DISCOUNT', 'HEADER_DISCOUNT', 'BELOW_COST', 'BELOW_MIN_PRICE']),
    );
    expect(where.type?.in).not.toContain('RETURN');
  });

  it('بلا صلاحيات معروفة يعيد كل الأنواع (توافق خلفي)', async () => {
    const { svc, calls } = listHarness();
    await svc.list({}, 1);
    const where = calls[0]!.where as { type?: unknown };
    expect(where.type).toBeUndefined();
  });
});
