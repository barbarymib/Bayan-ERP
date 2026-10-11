import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import type { Tx } from './stock.service.js';
import { tenantWhere } from './tenant.js';

export type LedgerAccount = 'CUSTOMER' | 'SUPPLIER' | 'CASH';

export interface LedgerEntryInput {
  periodId?: number | null;
  companyId?: number | null;
  accountType: LedgerAccount;
  accountId: number;
  debit?: number;
  credit?: number;
  refType?: string | null;
  refId?: number | null;
  description?: string | null;
}

export interface CashEntryInput {
  periodId?: number | null;
  companyId?: number | null;
  /** حساب خزينة صريح؛ وإلا يُستخدم أول حساب نشط للشركة. */
  cashAccountId?: number | null;
  debit?: number;
  credit?: number;
  refType?: string | null;
  refId?: number | null;
  description?: string | null;
}

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /** قيد واحد في دفتر الحسابات الفرعي (ADR-5). */
  async entry(tx: Tx, p: LedgerEntryInput): Promise<void> {
    await tx.ledgerEntry.create({
      data: {
        periodId: p.periodId ?? null,
        companyId: p.companyId ?? null,
        entryDate: new Date(),
        accountType: p.accountType,
        accountId: p.accountId,
        debit: p.debit ?? 0,
        credit: p.credit ?? 0,
        refType: p.refType ?? null,
        refId: p.refId ?? null,
        description: p.description ?? null,
      },
    });
  }

  /** اجمالي مدين/دائن حساب. */
  async balance(tx: Tx, accountType: LedgerAccount, accountId: number, companyId: number | null = null): Promise<{ debit: number; credit: number }> {
    const agg = await tx.ledgerEntry.aggregate({
      where: { accountType, accountId, ...tenantWhere(companyId) },
      _sum: { debit: true, credit: true },
    });
    return { debit: Number(agg._sum.debit ?? 0), credit: Number(agg._sum.credit ?? 0) };
  }

  /** اجمالي مدين/دائن حساب (بدون ترانزاكشن). */
  async balanceOf(accountType: LedgerAccount, accountId: number, companyId: number | null = null): Promise<{ debit: number; credit: number }> {
    return this.balance(this.prisma as unknown as Tx, accountType, accountId, companyId);
  }

  /** أول حساب خزينة نشط للشركة (أو الحساب المطلوب إن وُجد). */
  async resolveCashAccountId(tx: Tx, companyId: number | null, preferred?: number | null): Promise<number | null> {
    if (preferred != null) {
      const acc = await tx.cashAccount.findFirst({ where: { id: preferred, ...tenantWhere(companyId) } });
      return acc?.id ?? null;
    }
    const acc = await tx.cashAccount.findFirst({
      where: { active: true, ...tenantWhere(companyId) },
      orderBy: { id: 'asc' },
    });
    return acc?.id ?? null;
  }

  /**
   * قيد الجانب النقدي (CASH) — يكمل القيد المزدوج لحركات القبض/الصرف/العهدة (§7.3).
   * يُعيد معرّف حساب الخزينة المستخدم، أو null إذا لم يوجد حساب خزينة.
   */
  async cashEntry(tx: Tx, p: CashEntryInput): Promise<number | null> {
    const accountId = await this.resolveCashAccountId(tx, p.companyId ?? null, p.cashAccountId ?? null);
    if (accountId == null) return null;
    await this.entry(tx, {
      periodId: p.periodId ?? null,
      companyId: p.companyId ?? null,
      accountType: 'CASH',
      accountId,
      debit: p.debit ?? 0,
      credit: p.credit ?? 0,
      refType: p.refType ?? null,
      refId: p.refId ?? null,
      description: p.description ?? null,
    });
    return accountId;
  }
}