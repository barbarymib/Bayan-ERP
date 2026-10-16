import { describe, expect, it } from 'vitest';
import { TreasuryService } from '../src/treasury/treasury.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';

interface Captured {
  receiptWhere: Record<string, unknown>[];
  handoverWhere: Record<string, unknown>[];
}

function makeService(opts: {
  rep?: { id: number; name: string; repCode: string | null; companyId: number | null } | null;
  receipts?: { amount: number; [k: string]: unknown }[];
  handovers?: { amount: number; [k: string]: unknown }[];
  handover?: Record<string, unknown> | null;
}) {
  const captured: Captured = { receiptWhere: [], handoverWhere: [] };
  const rep = 'rep' in opts ? opts.rep : { id: 2, name: 'مندوب', repCode: 'M03', companyId: 1 };
  const prisma = {
    user: {
      findUnique: async (a: { where: { id: number } }) =>
        a.where.id === (rep?.id ?? -1) ? rep : rep ? { id: a.where.id, name: 'مستلِم', repCode: null } : null,
    },
    receipt: {
      findMany: async (a: { where: Record<string, unknown> }) => {
        captured.receiptWhere.push(a.where);
        return opts.receipts ?? [];
      },
    },
    custodyHandover: {
      findMany: async (a: { where: Record<string, unknown> }) => {
        captured.handoverWhere.push(a.where);
        return opts.handovers ?? [];
      },
      findUnique: async () => ('handover' in opts ? opts.handover : null),
    },
    cashAccount: { findUnique: async () => ({ id: 1, code: 'MAIN', nameAr: 'الرئيسي' }) },
  } as unknown as PrismaService;
  const service = new TreasuryService(prisma, {} as never, {} as never, {} as never, {} as never);
  return { service, captured };
}

describe('TreasuryService.custodyReconciliation (§5.10)', () => {
  it('يجمع التحصيل والمُسلَّم ويحسب العهدة القائمة', async () => {
    const { service, captured } = makeService({
      receipts: [{ amount: 100 }, { amount: 50 }],
      handovers: [{ amount: 40 }],
    });
    const res = await service.custodyReconciliation({ repId: 2 }, 1);
    expect(res.collected).toBe(150);
    expect(res.delivered).toBe(40);
    expect(res.outstanding).toBe(110);
    expect(res.receiptCount).toBe(2);
    expect(res.handoverCount).toBe(1);
    expect(res.rep).toEqual({ id: 2, code: 'M03', name: 'مندوب' });
    // receipts attributed via customer.repId
    expect(captured.receiptWhere[0]!.customer).toEqual({ repId: 2 });
    // VOID handovers excluded
    expect(captured.handoverWhere[0]!.status).toEqual({ not: 'VOID' });
  });

  it('يبني نطاق التاريخ (from شامل، to يشمل اليوم كاملاً)', async () => {
    const { service, captured } = makeService({ receipts: [], handovers: [] });
    await service.custodyReconciliation({ repId: 2, from: '2026-10-01', to: '2026-10-10' }, 1);
    const range = captured.receiptWhere[0]!.receivedAt as { gte: Date; lt: Date };
    expect(range.gte.toISOString().slice(0, 10)).toBe('2026-10-01');
    expect(range.lt.toISOString().slice(0, 10)).toBe('2026-10-11');
  });

  it('بلا نطاق: لا يوجد فلتر تاريخ', async () => {
    const { service, captured } = makeService({ receipts: [], handovers: [] });
    await service.custodyReconciliation({ repId: 2 }, 1);
    expect(captured.receiptWhere[0]!.receivedAt).toBeUndefined();
    expect(captured.handoverWhere[0]!.date).toBeUndefined();
  });

  it('يرمي NotFound لمندوب غير موجود / شركة أخرى', async () => {
    const { service } = makeService({ rep: { id: 2, name: 'x', repCode: 'M03', companyId: 999 } });
    await expect(service.custodyReconciliation({ repId: 2 }, 1)).rejects.toThrow(/not found/);
  });
});

describe('TreasuryService.getHandover (§5.10)', () => {
  it('يعيد المحضر مع المندوب والمستلِم وحساب الخزينة', async () => {
    const { service } = makeService({
      handover: { id: 5, number: 'CH-000001', repId: 2, receivedById: 1, cashAccountId: 1, amount: 100, companyId: 1 },
    });
    const res = (await service.getHandover(5, 1)) as {
      number: string;
      rep: { name: string } | null;
      receiver: { name: string } | null;
      cashAccount: { code: string } | null;
    };
    expect(res.number).toBe('CH-000001');
    expect(res.rep).toBeTruthy();
    expect(res.receiver).toBeTruthy();
    expect(res.cashAccount?.code).toBe('MAIN');
  });

  it('يرمي NotFound لمحضر غير موجود', async () => {
    const { service } = makeService({ handover: null });
    await expect(service.getHandover(5, 1)).rejects.toThrow(/not found/);
  });
});
