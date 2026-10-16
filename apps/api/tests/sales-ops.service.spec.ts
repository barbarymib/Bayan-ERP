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

type Settlement = 'BALANCE' | 'CASH' | 'CREDIT';

function buildReturn(opts: { settlement?: Settlement; permissions?: string[] } = {}) {
  const calls = {
    returnIn: [] as unknown[],
    ledger: [] as unknown[],
    cash: [] as unknown[],
    updates: [] as Record<string, unknown>[],
  };
  const rt = {
    id: 8,
    status: 'DRAFT',
    companyId: 1,
    customerId: 9,
    number: 'RT-1',
    total: 120,
    settlement: opts.settlement ?? 'BALANCE',
    lines: [
      { itemId: 11, qtyBase: 2, condition: 'GOOD', sourceLine: { statement: { warehouseId: 3 } } },
      { itemId: 12, qtyBase: 1, condition: 'DAMAGED', sourceLine: { statement: { warehouseId: 3 } } },
    ],
  };
  const tx = {
    returnStatement: {
      update: async (args: Record<string, unknown>) => {
        calls.updates.push(args);
        return {};
      },
    },
  };
  const prisma = {
    returnStatement: { findUnique: async () => rt },
    warehouse: {
      findMany: async () => [
        { id: 3, type: 'MAIN', code: 'MAIN' },
        { id: 4, type: 'DAMAGED', code: 'DMG' },
      ],
    },
    $transaction: async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
  } as unknown as PrismaService;

  const returnIn = vi.fn(async (...a: unknown[]) => {
    calls.returnIn.push(a);
  });
  const entry = vi.fn(async (...a: unknown[]) => {
    calls.ledger.push(a);
  });
  const cashEntry = vi.fn(async (...a: unknown[]) => {
    calls.cash.push(a);
    return 1;
  });
  const resolveCashAccountId = vi.fn(async () => 1);

  const service = new SalesOpsService(
    prisma,
    { returnIn } as never,
    { entry, cashEntry, resolveCashAccountId } as never,
    {} as never,
    { open: async () => ({ id: 1 }) } as never,
  );

  const actingUser = { id: 7, companyId: 1, permissions: opts.permissions ?? [] } as unknown as AuthUser;
  return { service, calls, returnIn, entry, cashEntry, actingUser };
}

describe('SalesOpsService.finalizeReturn (G9 §5.9 settlement)', () => {
  it('BALANCE: يرجع للمخزن + قيد دائن للعميل فقط (لا خزينة)', async () => {
    const { service, calls, returnIn, cashEntry, actingUser } = buildReturn({ settlement: 'BALANCE' });
    const r = await service.finalizeReturn(8, actingUser);
    expect(r).toBe(true);
    expect(returnIn).toHaveBeenCalledTimes(2); // صالح → MAIN، تالف → DAMAGED
    const creditEntry = calls.ledger.find((e) => (e as unknown[])[1] && (e as [unknown, { credit?: number }])[1].credit === 120);
    expect(creditEntry).toBeDefined();
    expect(cashEntry).not.toHaveBeenCalled();
    expect(calls.updates[0]).toMatchObject({ data: { status: 'APPROVED' } });
  });

  it('CREDIT: يرجع للمخزن + قيد دائن للعميل (رصيد دائن، لا خزينة)', async () => {
    const { service, cashEntry } = buildReturn({ settlement: 'CREDIT' });
    await service.finalizeReturn(8, { id: 7, companyId: 1, permissions: [] } as unknown as AuthUser);
    expect(cashEntry).not.toHaveBeenCalled();
  });

  it('CASH بصلاحية return.cash_refund: يعادل العميل ويُخرج النقدية عبر cashEntry', async () => {
    const { service, calls, cashEntry, actingUser } = buildReturn({ settlement: 'CASH', permissions: ['return.cash_refund'] });
    await service.finalizeReturn(8, actingUser);
    expect(cashEntry).toHaveBeenCalledTimes(1);
    const cashArgs = calls.cash[0] as unknown[];
    expect(cashArgs[1]).toMatchObject({ credit: 120, refType: 'return_refund' });
    // مدين على العميل يعادل الدائن الأصلي
    const debitEntry = calls.ledger.find((e) => (e as [unknown, { debit?: number }])[1].debit === 120);
    expect(debitEntry).toBeDefined();
    expect(calls.updates[0]).toMatchObject({ data: { status: 'APPROVED' } });
  });

  it('CASH بلا صلاحية return.cash_refund: يُرفض ولا يؤثر', async () => {
    const { service, returnIn, entry, cashEntry, actingUser } = buildReturn({ settlement: 'CASH', permissions: [] });
    await expect(service.finalizeReturn(8, actingUser)).rejects.toThrow(/return\.cash_refund/);
    expect(returnIn).not.toHaveBeenCalled();
    expect(entry).not.toHaveBeenCalled();
    expect(cashEntry).not.toHaveBeenCalled();
  });
});

function buildCredit(opts: {
  mode?: string | null;
  creditLimit?: number | null;
  opening?: number;
  debit?: number;
  credit?: number;
  net?: number;
}) {
  const st = {
    id: 5,
    status: 'DRAFT',
    companyId: 1,
    warehouseId: 3,
    customerId: 9,
    paid: 0,
    net: opts.net ?? 100,
    number: 'BP-1',
    lines: [{ itemId: 11, qtyBase: 2 }],
  };
  const saleOut = vi.fn(async () => {});
  const prisma = {
    systemSetting: { findUnique: async () => (opts.mode === null ? null : { value: opts.mode ?? 'WARN' }) },
    customer: {
      findUnique: async () =>
        opts.creditLimit === null ? null : { id: 9, creditLimit: opts.creditLimit ?? 0, openingBalance: opts.opening ?? 0 },
    },
    priceStatement: { findUnique: async () => st },
    $transaction: async (cb: (t: unknown) => Promise<unknown>) =>
      cb({ priceStatement: { update: async () => ({}) }, receipt: { create: async () => ({ id: 1, number: 'RC-1' }) } }),
  } as unknown as PrismaService;
  const service = new SalesOpsService(
    prisma,
    { saleOut, releaseReservations: vi.fn() } as never,
    { entry: vi.fn(), balanceOf: async () => ({ debit: opts.debit ?? 0, credit: opts.credit ?? 0 }) } as never,
    { issue: async () => 'RC-1' } as never,
    { open: async () => ({ id: 1 }) } as never,
  );
  return { service, saleOut };
}

describe('SalesOpsService.assertCustomerCredit (R3-B1 §5.4)', () => {
  it('WARN (افتراضي عند غياب الإعداد): لا يمنع حتى عند التجاوز', async () => {
    const { service } = buildCredit({ mode: null, creditLimit: 100, debit: 150 });
    await expect(service.assertCustomerCredit(9, 0, 1)).resolves.toBeUndefined();
  });

  it('WARN صريح: لا يمنع', async () => {
    const { service } = buildCredit({ mode: 'WARN', creditLimit: 100, debit: 150 });
    await expect(service.assertCustomerCredit(9, 0, 1)).resolves.toBeUndefined();
  });

  it('BLOCK مع تجاوز: يرفض', async () => {
    const { service } = buildCredit({ mode: 'BLOCK', creditLimit: 100, debit: 90, net: 20 });
    await expect(service.assertCustomerCredit(9, 20, 1)).rejects.toThrow(/الحد الائتماني/);
  });

  it('BLOCK ضمن الحد: يمرّ', async () => {
    const { service } = buildCredit({ mode: 'BLOCK', creditLimit: 1000, debit: 90 });
    await expect(service.assertCustomerCredit(9, 20, 1)).resolves.toBeUndefined();
  });

  it('BLOCK بلا حد ائتماني (0): يمرّ', async () => {
    const { service } = buildCredit({ mode: 'BLOCK', creditLimit: 0, debit: 999 });
    await expect(service.assertCustomerCredit(9, 20, 1)).resolves.toBeUndefined();
  });

  it('BLOCK والعميل غير موجود: يمرّ', async () => {
    const { service } = buildCredit({ mode: 'BLOCK', creditLimit: null, debit: 999 });
    await expect(service.assertCustomerCredit(9, 20, 1)).resolves.toBeUndefined();
  });

  it('finalizeStatement بـ BLOCK عند التجاوز: يرفض ولا يصرف من المخزن', async () => {
    const { service, saleOut } = buildCredit({ mode: 'BLOCK', creditLimit: 50, net: 100 });
    await expect(service.finalizeStatement(5, user)).rejects.toThrow(/الحد الائتماني/);
    expect(saleOut).not.toHaveBeenCalled();
  });
});
