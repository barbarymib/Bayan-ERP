import { describe, expect, it } from 'vitest';
import { ArchivesService } from '../src/archives/archives.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';

type Range = { from: Date; to: Date; toEnd: Date };
type VerifyResult = { ok: boolean; detail: string };

function mockPrisma(over: { counts?: Record<string, number>; sums?: Record<string, number> } = {}): PrismaService {
  const counts = over.counts ?? {};
  const sums = over.sums ?? {};
  const c = (k: string) => async () => counts[k] ?? 0;
  const models = {
    priceStatement: { count: c('price_statements'), aggregate: async () => ({ _sum: { net: sums.salesNet ?? 0 } }) },
    priceStatementLine: { count: c('price_statement_lines') },
    statementRevision: { count: c('statement_revisions') },
    returnStatement: { count: c('return_statements'), aggregate: async () => ({ _sum: { total: sums.returnsTotal ?? 0 } }) },
    returnLine: { count: c('return_lines') },
    purchaseStatement: { count: c('purchase_statements'), aggregate: async () => ({ _sum: { net: sums.purchaseNet ?? 0 } }) },
    purchaseStatementLine: { count: c('purchase_statement_lines') },
    receipt: { count: c('receipts'), aggregate: async () => ({ _sum: { amount: sums.receiptsTotal ?? 0 } }) },
    receiptAllocation: { count: c('receipt_allocations') },
    payment: { count: c('payments'), aggregate: async () => ({ _sum: { amount: sums.paymentsTotal ?? 0 } }) },
    cheque: { count: c('cheques'), aggregate: async () => ({ _sum: { amount: sums.chequesTotal ?? 0 } }) },
    stockMovement: { count: c('stock_movements') },
    stocktakeSession: { count: c('stocktake_sessions') },
    stocktakeLine: { count: c('stocktake_lines') },
    ledgerEntry: {
      count: c('ledger_entries'),
      aggregate: async () => ({ _sum: { debit: sums.ledgerDebit ?? 0, credit: sums.ledgerCredit ?? 0 } }),
    },
  };
  return models as unknown as PrismaService;
}

function verifyOf(service: ArchivesService) {
  return (
    service as unknown as { verify: (r: Range, m: { counts: Record<string, number>; totals: Record<string, number> }) => Promise<VerifyResult> }
  ).verify.bind(service);
}

const R: Range = { from: new Date('2026-01-01'), to: new Date('2026-06-30'), toEnd: new Date('2026-07-01') };

describe('ArchivesService.verify — مطابقة كل الأعداد والإجماليات (§5.11.4, R3-C12)', () => {
  it('ينجح عندما تطابق كل الأعداد والإجماليات', async () => {
    const counts = { price_statements: 3, return_statements: 2, stock_movements: 7, ledger_entries: 5 };
    const sums = { salesNet: 500, purchaseNet: 300, returnsTotal: 40, ledgerDebit: 640, ledgerCredit: 200 };
    const service = new ArchivesService(mockPrisma({ counts, sums }), {} as never, {} as never);
    const res = await verifyOf(service)(R, { counts, totals: sums });
    expect(res.ok).toBe(true);
  });

  it('يكشف اختلاف عدد في جدول لم يكن يُطابق سابقًا (stock_movements)', async () => {
    const counts = { stock_movements: 7 };
    const service = new ArchivesService(mockPrisma({ counts: { stock_movements: 3 } }), {} as never, {} as never);
    const res = await verifyOf(service)(R, { counts, totals: {} });
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('count stock_movements');
  });

  it('يكشف اختلاف عدد في جدول بنود (return_lines)', async () => {
    const counts = { return_lines: 4 };
    const service = new ArchivesService(mockPrisma({ counts: { return_lines: 2 } }), {} as never, {} as never);
    const res = await verifyOf(service)(R, { counts, totals: {} });
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('count return_lines');
  });

  it('يكشف اختلاف إجمالي في القيود (ledgerDebit) وليس salesNet فقط', async () => {
    const sums = { ledgerDebit: 100 };
    const service = new ArchivesService(mockPrisma({ sums: { ledgerDebit: 90 } }), {} as never, {} as never);
    const res = await verifyOf(service)(R, { counts: {}, totals: sums });
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('total ledgerDebit');
  });

  it('يتسامح مع فرق أقل من 0.01 في الإجماليات', async () => {
    const sums = { salesNet: 100.005 };
    const service = new ArchivesService(mockPrisma({ sums: { salesNet: 100 } }), {} as never, {} as never);
    const res = await verifyOf(service)(R, { counts: {}, totals: sums });
    expect(res.ok).toBe(true);
  });

  it('يجمع كل الفروق في detail واحدة', async () => {
    const service = new ArchivesService(
      mockPrisma({ counts: { price_statements: 0, receipts: 0 }, sums: { ledgerCredit: 0 } }),
      {} as never,
      {} as never,
    );
    const res = await verifyOf(service)(R, {
      counts: { price_statements: 1, receipts: 2 },
      totals: { ledgerCredit: 5 },
    });
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('count price_statements');
    expect(res.detail).toContain('count receipts');
    expect(res.detail).toContain('total ledgerCredit');
  });
});
