import { describe, expect, it, vi } from 'vitest';
import { SalesOpsService } from '../src/common/sales-ops.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { AuthUser } from '../src/auth/auth.decorators.js';

const user = { id: 7, companyId: 1 } as unknown as AuthUser;

type Status = 'DRAFT' | 'APPROVED' | 'PENDING_REVIEW' | 'CANCELLED';

function build(status: Status, opts: { paid?: number; hasActive?: boolean } = {}) {
  const calls = {
    restock: [] as unknown[],
    reserve: [] as unknown[],
    ledger: [] as unknown[],
    updates: [] as Record<string, unknown>[],
  };

  const st = {
    id: 5,
    status,
    companyId: 1,
    warehouseId: 3,
    customerId: 9,
    paid: opts.paid ?? 0,
    net: 100,
    number: 'BP-1',
    lines: [{ itemId: 11, qtyBase: 2 }],
  };

  const tx = {
    stockReservation: {
      findFirst: async () => (opts.hasActive ? { id: 1 } : null),
    },
    priceStatement: {
      update: async (args: Record<string, unknown>) => {
        calls.updates.push(args);
        return {};
      },
    },
  };

  const prisma = {
    priceStatement: { findUnique: async () => st },
    $transaction: async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
  } as unknown as PrismaService;

  const restock = vi.fn(async (...a: unknown[]) => {
    calls.restock.push(a);
  });
  const reserve = vi.fn(async (...a: unknown[]) => {
    calls.reserve.push(a);
  });
  const entry = vi.fn(async (...a: unknown[]) => {
    calls.ledger.push(a);
  });

  const service = new SalesOpsService(
    prisma,
    { restock, reserve } as never,
    { entry } as never,
    {} as never,
    { open: async () => ({ id: 1 }) } as never,
  );

  return { service, calls, restock, reserve, entry };
}

describe('SalesOpsService.holdForReview (G8 §5.7)', () => {
  it('يعتمد بياناً معلّقاً: يعكس الصرف + قيد عكسي ثم يحجز ويضبط PENDING_REVIEW', async () => {
    const { service, calls, restock, reserve, entry } = build('APPROVED');
    const r = await service.holdForReview(5, user);
    expect(r).toBe(true);
    expect(restock).toHaveBeenCalledTimes(1);
    expect(entry).toHaveBeenCalledTimes(1);
    expect((calls.ledger[0] as unknown[])[1]).toMatchObject({ credit: 100, accountType: 'CUSTOMER' });
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(calls.updates[0]).toMatchObject({ data: { status: 'PENDING_REVIEW' } });
  });

  it('مسودة بلا حجز نشط: يحجز الكميات دون عكس (لا صرف أصلاً)', async () => {
    const { service, calls, restock, reserve, entry } = build('DRAFT', { hasActive: false });
    await service.holdForReview(5, user);
    expect(restock).not.toHaveBeenCalled();
    expect(entry).not.toHaveBeenCalled();
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(calls.updates[0]).toMatchObject({ data: { status: 'PENDING_REVIEW' } });
  });

  it('مسودة بحجز نشط (موافقة معلّقة): لا يكرّر الحجز', async () => {
    const { service, reserve } = build('DRAFT', { hasActive: true });
    await service.holdForReview(5, user);
    expect(reserve).not.toHaveBeenCalled();
  });

  it('بيان مراجعة أصلاً: لا يفعل شيئاً', async () => {
    const { service, reserve, entry, calls } = build('PENDING_REVIEW');
    const r = await service.holdForReview(5, user);
    expect(r).toBe(false);
    expect(reserve).not.toHaveBeenCalled();
    expect(entry).not.toHaveBeenCalled();
    expect(calls.updates).toHaveLength(0);
  });

  it('معتمد مدفوع: يُرفض (لا يمكن عكس سند القبض)', async () => {
    const { service, reserve } = build('APPROVED', { paid: 50 });
    await expect(service.holdForReview(5, user)).rejects.toThrow(/payments/);
    expect(reserve).not.toHaveBeenCalled();
  });

  it('ملغي: يُرفض', async () => {
    const { service } = build('CANCELLED');
    await expect(service.holdForReview(5, user)).rejects.toThrow(/cancelled/);
  });
});
