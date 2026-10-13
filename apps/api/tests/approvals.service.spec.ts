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
  const finalizeStatement = vi.fn(async () => true);
  const finalizeReturn = vi.fn(async () => true);

  const prisma = {
    approval: {
      findUnique: async () => ({ id: 1, type: 'BELOW_COST', refType: dispatch.refType, refId: dispatch.refId, status: 'PENDING' }),
      update: async (args: unknown) => {
        calls.decisionUpdates.push(args as Record<string, unknown>);
        return {};
      },
    },
    priceStatement: { findUnique: async () => ({ id: 5, status: 'DRAFT' }) },
    returnStatement: { findUnique: async () => ({ id: dispatch.refId, status: 'DRAFT' }) },
    $transaction: async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
  } as unknown as PrismaService;

  const service = new ApprovalsService(
    prisma,
    { finalizeStatement, finalizeReturn } as never,
    { releaseReservations } as never,
    { write: async () => undefined } as never,
  );

  return { service, prisma, calls, releaseReservations, finalizeStatement, finalizeReturn };
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
      { finalizeStatement, finalizeReturn: async () => true } as never,
      { releaseReservations: async () => undefined } as never,
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
      { releaseReservations: async () => undefined } as never,
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
      { releaseReservations: async () => undefined } as never,
      { write: async () => undefined } as never,
    );
    await expect(svc.decide(1, { approved: true }, user)).rejects.toThrow('ملغي');
  });
});