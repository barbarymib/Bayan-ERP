import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { roundMoney } from '@bayan/shared';
import type { AuthUser } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { NumberingService } from '../numbering.service.js';
import { LedgerService } from '../common/ledger.service.js';
import { PeriodsService } from '../common/periods.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { tenantWhere } from '../common/tenant.js';
import type { QueryStatementOfAccountDto } from '../collections/collections.dto.js';
import type {
  CreateCashAccountDto,
  CreateHandoverDto,
  DailyCloseDto,
  QueryHandoversDto,
  UpdateCashAccountDto,
} from './treasury.dto.js';

function dayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

@Injectable()
export class TreasuryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly ledger: LedgerService,
    private readonly periods: PeriodsService,
    private readonly audits: AuditLogsService,
  ) {}

  async createAccount(dto: CreateCashAccountDto, user?: AuthUser) {
    const companyId = user?.companyId ?? null;
    const existing = await this.prisma.cashAccount.findFirst({ where: { code: dto.code, ...tenantWhere(companyId) } });
    if (existing) throw new BadRequestException(`Cash account ${dto.code} already exists`);
    const account = await this.prisma.cashAccount.create({
      data: {
        code: dto.code,
        nameAr: dto.nameAr,
        type: dto.type ?? 'CASH',
        openingBalance: dto.openingBalance ?? 0,
        companyId,
      },
    });
    await this.audits.write({
      userId: user?.id,
      action: 'cash_account.create',
      entity: 'CashAccount',
      entityId: account.id,
      afterJson: { code: account.code, nameAr: account.nameAr, type: account.type, openingBalance: Number(account.openingBalance) },
    });
    return account;
  }

  async listAccounts(companyId: number | null = null) {
    const items = await this.prisma.cashAccount.findMany({ where: tenantWhere(companyId), orderBy: { id: 'asc' } });
    return { items };
  }

  async updateAccount(id: number, dto: UpdateCashAccountDto, user?: AuthUser) {
    const companyId = user?.companyId ?? null;
    const account = await this.prisma.cashAccount.findUnique({ where: { id } });
    if (!account || (account.companyId != null && account.companyId !== companyId)) {
      throw new NotFoundException(`CashAccount ${id} not found`);
    }
    const updated = await this.prisma.cashAccount.update({ where: { id }, data: dto });
    await this.audits.write({
      userId: user?.id,
      action: 'cash_account.update',
      entity: 'CashAccount',
      entityId: id,
      beforeJson: { code: account.code, nameAr: account.nameAr, type: account.type, active: account.active },
      afterJson: { code: updated.code, nameAr: updated.nameAr, type: updated.type, active: updated.active },
    });
    return updated;
  }

  /** تسليم عهدة نقدية من مندوب للخزينة. */
  async createHandover(dto: CreateHandoverDto, user: AuthUser) {
    const tenant = user.companyId ?? null;
    const rep = await this.prisma.user.findUnique({ where: { id: dto.repId } });
    if (!rep || (rep.companyId != null && rep.companyId !== tenant)) {
      throw new NotFoundException(`User ${dto.repId} not found`);
    }
    if (dto.cashAccountId != null) {
      const acc = await this.prisma.cashAccount.findUnique({ where: { id: dto.cashAccountId } });
      if (!acc || (acc.companyId != null && acc.companyId !== tenant)) {
        throw new NotFoundException(`Cash account ${dto.cashAccountId} not found`);
      }
    }
    const number = await this.numbering.issue('CH', '', tenant);
    const period = await this.periods.open(tenant);
    const handover = await this.prisma.$transaction(async (tx) => {
      const h = await tx.custodyHandover.create({
        data: {
          number,
          repId: dto.repId,
          amount: roundMoney(dto.amount),
          date: dto.date ? new Date(dto.date) : new Date(),
          receivedById: user.id,
          cashAccountId: dto.cashAccountId ?? null,
          companyId: tenant,
          notes: dto.notes?.trim() || null,
        },
      });
      await this.ledger.cashEntry(tx, {
        periodId: period?.id ?? null,
        companyId: tenant,
        cashAccountId: dto.cashAccountId ?? null,
        debit: roundMoney(dto.amount),
        refType: 'custody_handover',
        refId: h.id,
        description: `تسليم عهدة ${h.number}`,
      });
      return h;
    });
    await this.audits.write({
      userId: user.id,
      action: 'handover.create',
      entity: 'CustodyHandover',
      entityId: handover.id,
      afterJson: {
        number: handover.number,
        repId: handover.repId,
        amount: Number(handover.amount),
        cashAccountId: handover.cashAccountId,
      },
    });
    return handover;
  }

  async listHandovers(query: QueryHandoversDto, companyId: number | null = null) {
    const where = { ...tenantWhere(companyId), ...(query.repId ? { repId: query.repId } : {}) };
    const [total, items] = await Promise.all([
      this.prisma.custodyHandover.count({ where }),
      this.prisma.custodyHandover.findMany({
        where,
        orderBy: { date: 'desc' },
        take: query.limit ?? 20,
      }),
    ]);
    return { total, items };
  }

  /** إقفال يومي: يجمّع القبض والصرف والتسليمات ويحسب الرصيد الختامي. */
  async dailyClose(dto: DailyCloseDto, user: AuthUser) {
    const tenant = user.companyId ?? null;
    const { start, end } = dayRange(new Date(dto.date));

    const [receipts, payments, handovers, prevClose] = await Promise.all([
      this.prisma.receipt.aggregate({ where: { receivedAt: { gte: start, lt: end }, ...tenantWhere(tenant) }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { paidAt: { gte: start, lt: end }, ...tenantWhere(tenant) }, _sum: { amount: true } }),
      this.prisma.custodyHandover.aggregate({ where: { date: { gte: start, lt: end }, ...tenantWhere(tenant) }, _sum: { amount: true } }),
      this.prisma.dailyClose.findFirst({ where: { date: { lt: start }, ...tenantWhere(tenant) }, orderBy: { date: 'desc' } }),
    ]);

    const receiptsTotal = roundMoney(Number(receipts._sum.amount ?? 0));
    const paymentsTotal = roundMoney(Number(payments._sum.amount ?? 0));
    const handoversTotal = roundMoney(Number(handovers._sum.amount ?? 0));
    const openingBalance = roundMoney(Number(prevClose?.closingBalance ?? 0));
    const closingBalance = roundMoney(openingBalance + receiptsTotal + handoversTotal - paymentsTotal);
    const countedBalance = dto.countedBalance != null ? roundMoney(dto.countedBalance) : null;
    const difference = countedBalance != null ? roundMoney(countedBalance - closingBalance) : null;

    const existing = await this.prisma.dailyClose.findFirst({ where: { date: start, ...tenantWhere(tenant) } });
    const data = {
      openingBalance,
      receiptsTotal,
      paymentsTotal,
      handoversTotal,
      closingBalance,
      countedBalance,
      difference,
      notes: dto.notes?.trim() || null,
      closedById: user.id,
    };
    const closeDate = start;
    const result = existing
      ? await this.prisma.dailyClose.update({ where: { id: existing.id }, data })
      : await this.prisma.dailyClose.create({ data: { date: closeDate, companyId: tenant, ...data } });
    await this.audits.write({
      userId: user.id,
      action: 'daily_close.run',
      entity: 'DailyClose',
      entityId: result.id,
      beforeJson: existing
        ? { closingBalance: Number(existing.closingBalance), countedBalance: Number(existing.countedBalance ?? 0) }
        : undefined,
      afterJson: {
        reclose: Boolean(existing),
        openingBalance,
        receiptsTotal,
        paymentsTotal,
        handoversTotal,
        closingBalance,
        countedBalance,
        difference,
      },
    });
    return result;
  }

  async listDailyCloses(limit = 30, companyId: number | null = null) {
    return this.prisma.dailyClose.findMany({ where: tenantWhere(companyId), orderBy: { date: 'desc' }, take: limit });
  }

  async cashSummary(companyId: number | null = null) {
    const [accounts, receipts, payments, handovers] = await Promise.all([
      this.prisma.cashAccount.findMany({ where: { active: true, ...tenantWhere(companyId) }, orderBy: { code: 'asc' } }),
      this.prisma.receipt.aggregate({ where: tenantWhere(companyId), _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: tenantWhere(companyId), _sum: { amount: true } }),
      this.prisma.custodyHandover.aggregate({ where: tenantWhere(companyId), _sum: { amount: true } }),
    ]);
    const opening = accounts.reduce((s, a) => s + Number(a.openingBalance), 0);
    const receiptsTotal = roundMoney(Number(receipts._sum.amount ?? 0));
    const paymentsTotal = roundMoney(Number(payments._sum.amount ?? 0));
    const handoversTotal = roundMoney(Number(handovers._sum.amount ?? 0));
    return {
      accounts,
      opening: roundMoney(opening),
      receiptsTotal,
      paymentsTotal,
      handoversTotal,
      balance: roundMoney(opening + receiptsTotal + handoversTotal - paymentsTotal),
    };
  }

  /** كشف حساب خزينة: رصيد افتتاحي + حركات مدين/دائن (القيد النقدي المزدوج §7.3). */
  async accountStatement(id: number, query: QueryStatementOfAccountDto, companyId: number | null = null) {
    const acc = await this.prisma.cashAccount.findUnique({ where: { id } });
    if (!acc || (acc.companyId != null && acc.companyId !== companyId)) {
      throw new NotFoundException(`CashAccount ${id} not found`);
    }

    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        accountType: 'CASH',
        accountId: id,
        ...tenantWhere(companyId),
        ...(query.from || query.to
          ? {
              entryDate: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ entryDate: 'asc' }, { id: 'asc' }],
    });

    const opening = Number(acc.openingBalance);
    let running = roundMoney(opening);
    const movements = entries.map((e) => {
      const debit = Number(e.debit);
      const credit = Number(e.credit);
      running = roundMoney(running + debit - credit);
      return {
        id: e.id,
        date: e.entryDate,
        description: e.description,
        debit,
        credit,
        balance: running,
        refType: e.refType,
        refId: e.refId,
      };
    });

    return {
      account: { id: acc.id, code: acc.code, nameAr: acc.nameAr, type: acc.type },
      openingBalance: opening,
      closingBalance: running,
      movements,
    };
  }
}