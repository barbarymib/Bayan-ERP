import { describe, expect, it } from 'vitest';
import { LedgerService } from '../src/common/ledger.service.js';
import { CollectionsService } from '../src/collections/collections.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { NumberingService } from '../src/numbering.service.js';
import type { PeriodsService } from '../src/common/periods.service.js';
import type { AuditLogsService } from '../src/audit-logs/audit-logs.service.js';

interface Captured {
  created: unknown[];
}

function ledgerPrisma(cash: { id: number } | null, captured: Captured): PrismaService {
  return {
    cashAccount: { findFirst: async () => cash },
    ledgerEntry: {
      create: async (args: unknown) => {
        captured.created.push(args);
        return args;
      },
    },
  } as unknown as PrismaService;
}

describe('LedgerService.cashEntry', () => {
  it('يرحّل قيداً نقدياً (CASH) بالحساب المطلوب', async () => {
    const captured: Captured = { created: [] };
    const prisma = ledgerPrisma({ id: 9 }, captured);
    const ledger = new LedgerService(prisma);
    const id = await ledger.cashEntry(prisma as never, { companyId: 1, cashAccountId: 9, debit: 250, refType: 'receipt', refId: 5 });
    expect(id).toBe(9);
    expect(captured.created).toHaveLength(1);
    const data = (captured.created[0] as { data: { accountType: string; accountId: number; debit: number } }).data;
    expect(data.accountType).toBe('CASH');
    expect(data.accountId).toBe(9);
    expect(data.debit).toBe(250);
  });

  it('يستخدم أول حساب خزينة نشط عند غياب الحساب', async () => {
    const captured: Captured = { created: [] };
    const prisma = ledgerPrisma({ id: 3 }, captured);
    const ledger = new LedgerService(prisma);
    const id = await ledger.cashEntry(prisma as never, { companyId: 1, credit: 100, refType: 'payment', refId: 6 });
    expect(id).toBe(3);
    expect(captured.created).toHaveLength(1);
  });

  it('لا يرحّل شيئاً إذا لم يوجد حساب خزينة', async () => {
    const captured: Captured = { created: [] };
    const prisma = ledgerPrisma(null, captured);
    const ledger = new LedgerService(prisma);
    const id = await ledger.cashEntry(prisma as never, { companyId: 1, debit: 50 });
    expect(id).toBeNull();
    expect(captured.created).toHaveLength(0);
  });
});

describe('CollectionsService.supplierStatement', () => {
  function collectionsPrisma(): PrismaService {
    return {
      supplier: {
        findUnique: async () => ({ id: 1, code: 'SUP-01', nameAr: 'مورد', openingBalance: 1000, companyId: 1 }),
      },
      ledgerEntry: {
        findMany: async () => [
          { id: 1, entryDate: new Date('2026-01-01'), description: 'سند صرف', debit: 200, credit: 0, refType: 'payment', refId: 1 },
          { id: 2, entryDate: new Date('2026-01-02'), description: 'بيان توريد', debit: 0, credit: 500, refType: 'purchase_statement', refId: 2 },
        ],
      },
      purchaseStatement: {
        findMany: async () => [
          { id: 1, number: 'PR-1', date: new Date('2026-01-02'), net: 2000, paid: 0, paymentAllocs: [{ amount: 300 }] },
        ],
      },
    } as unknown as PrismaService;
  }

  function makeService(prisma: PrismaService): CollectionsService {
    return new CollectionsService(
      prisma,
      {} as unknown as NumberingService,
      {} as unknown as PeriodsService,
      new LedgerService(prisma),
      { write: async () => {} } as unknown as AuditLogsService,
    );
  }

  it('يحسب الرصيد الجاري والمستحقات (افتتاحي + دائن − مدين)', async () => {
    const service = makeService(collectionsPrisma());
    const res = await service.supplierStatement(1, {}, 1);
    expect(res.openingBalance).toBe(1000);
    expect(res.movements).toHaveLength(2);
    expect(res.movements[0]!.balance).toBe(800);
    expect(res.movements[1]!.balance).toBe(1300);
    expect(res.closingBalance).toBe(1300);
    expect(res.totalOutstanding).toBe(1700);
  });

  it('يرفض كشف مورد من شركة أخرى', async () => {
    const prisma = collectionsPrisma();
    (prisma.supplier.findUnique as unknown as (a: unknown) => Promise<unknown>) = async () => ({
      id: 1,
      code: 'SUP-01',
      nameAr: 'مورد',
      openingBalance: 0,
      companyId: 2,
    });
    const service = makeService(prisma);
    await expect(service.supplierStatement(1, {}, 1)).rejects.toThrow('not found');
  });
});
