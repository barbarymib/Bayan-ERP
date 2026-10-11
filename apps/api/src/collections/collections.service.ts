import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { roundMoney } from '@bayan/shared';
import type { AuthUser } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { NumberingService } from '../numbering.service.js';
import { PeriodsService } from '../common/periods.service.js';
import { LedgerService } from '../common/ledger.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { tenantWhere } from '../common/tenant.js';
import type {
  CreatePaymentDto,
  CreateReceiptDto,
  QueryReceiptsDto,
  QueryStatementOfAccountDto,
  UpdateChequeStatusDto,
} from './collections.dto.js';

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly periods: PeriodsService,
    private readonly ledger: LedgerService,
    private readonly audits: AuditLogsService,
  ) {}

  async createReceipt(dto: CreateReceiptDto, user: AuthUser) {
    const tenant = user.companyId ?? null;
    // idempotency: if clientUuid already uploaded → return existing
    if (dto.clientUuid) {
      const existing = await this.prisma.receipt.findFirst({ where: { clientUuid: dto.clientUuid, ...tenantWhere(tenant) } });
      if (existing) return this.getReceipt(existing.id, tenant);
    }
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer || (customer.companyId != null && customer.companyId !== tenant)) {
      throw new NotFoundException(`Customer ${dto.customerId} not found`);
    }
    if (dto.amount <= 0) throw new BadRequestException('Receipt amount must be positive');

    const period = await this.periods.open(tenant);
    let allocationAmount: number | null = null;
    if (dto.statementId) {
      const outstanding = await this.statementOutstanding(dto.statementId, tenant);
      if (outstanding === null) throw new NotFoundException(`Statement ${dto.statementId} not found`);
      const st = await this.prisma.priceStatement.findUnique({ where: { id: dto.statementId } });
      if (st!.customerId !== customer.id) {
        throw new BadRequestException(`Statement ${dto.statementId} does not belong to this customer`);
      }
      if (dto.amount > outstanding) {
        throw new BadRequestException(`Amount exceeds statement outstanding (${outstanding})`);
      }
      allocationAmount = dto.amount;
    }

    const rcNumber = dto.number ?? (await this.numbering.issue('RC', user.repCode ?? '', tenant));
    const receipt = await this.prisma.$transaction(async (tx) => {
      let chequeId: number | null = null;
      if (dto.method === 'CHEQUE' && dto.chequeNumber) {
        const cheque = await tx.cheque.create({
          data: {
            number: dto.chequeNumber,
            bankName: dto.bankName ?? '',
            dueDate: dto.chequeDueDate ? new Date(dto.chequeDueDate) : new Date(),
            amount: dto.amount,
            status: 'UNDER_COLLECTION',
            customerId: customer.id,
            receivedAt: new Date(),
            companyId: tenant,
          },
        });
        chequeId = cheque.id;
      }

      const cashAccountId = await this.ledger.resolveCashAccountId(tx, tenant, dto.cashAccountId ?? null);

      const r = await tx.receipt.create({
        data: {
          number: rcNumber,
          clientUuid: dto.clientUuid ?? null,
          customerId: customer.id,
          amount: dto.amount,
          method: dto.method ?? 'CASH',
          receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
          notes: dto.notes,
          chequeId,
          cashAccountId,
          periodId: period?.id ?? null,
          companyId: tenant,
        },
      });

      if (allocationAmount !== null) {
        await tx.receiptAllocation.create({
          data: { receiptId: r.id, statementId: dto.statementId!, amount: allocationAmount },
        });
      }

      await this.ledger.entry(tx, {
        periodId: period?.id ?? null,
        companyId: tenant,
        accountType: 'CUSTOMER',
        accountId: customer.id,
        credit: dto.amount,
        refType: 'receipt',
        refId: r.id,
        description: `سند قبض ${r.number}`,
      });
      await this.ledger.cashEntry(tx, {
        periodId: period?.id ?? null,
        companyId: tenant,
        cashAccountId,
        debit: dto.amount,
        refType: 'receipt',
        refId: r.id,
        description: `سند قبض ${r.number}`,
      });
      return r;
    });

    await this.audits.write({
      userId: user.id,
      action: 'collection.receipt',
      entity: 'Receipt',
      entityId: receipt.id,
      afterJson: {
        number: receipt.number,
        customerId: customer.id,
        amount: dto.amount,
        method: dto.method,
        statementId: dto.statementId ?? null,
      },
    });
    return this.getReceipt(receipt.id, tenant);
  }

  async listReceipts(query: QueryReceiptsDto, companyId: number | null = null) {
    const limit = query.limit ?? 20;
    const rows = await this.prisma.receipt.findMany({
      where: {
        ...tenantWhere(companyId),
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.method ? { method: query.method } : {}),
      },
      include: {
        customer: { select: { id: true, code: true, nameAr: true } },
        allocations: true,
        cheque: true,
      },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });
    return { items: rows };
  }

  async getReceipt(id: number, companyId: number | null = null) {
    const r = await this.prisma.receipt.findUnique({
      where: { id },
      include: {
        customer: true,
        allocations: { include: { statement: { select: { id: true, number: true, net: true } } } },
        cheque: true,
      },
    });
    if (!r || (r.companyId != null && r.companyId !== companyId)) {
      throw new NotFoundException(`Receipt ${id} not found`);
    }
    return r;
  }

  async createPayment(dto: CreatePaymentDto, user: AuthUser) {
    const tenant = user.companyId ?? null;
    const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier || (supplier.companyId != null && supplier.companyId !== tenant)) {
      throw new NotFoundException(`Supplier ${dto.supplierId} not found`);
    }
    if (dto.amount <= 0) throw new BadRequestException('Payment amount must be positive');

    let allocationAmount: number | null = null;
    if (dto.statementId) {
      const outstanding = await this.purchaseStatementOutstanding(dto.statementId, tenant);
      if (outstanding === null) throw new NotFoundException(`Purchase statement ${dto.statementId} not found`);
      const st = await this.prisma.purchaseStatement.findUnique({ where: { id: dto.statementId } });
      if (st!.supplierId !== supplier.id) {
        throw new BadRequestException(`Purchase statement ${dto.statementId} does not belong to this supplier`);
      }
      if (dto.amount > outstanding) {
        throw new BadRequestException(`Amount exceeds purchase statement outstanding (${outstanding})`);
      }
      allocationAmount = dto.amount;
    }

    const period = await this.periods.open(tenant);
    const pvNumber = await this.numbering.issue('PV', user.repCode ?? '', tenant);

    const payment = await this.prisma.$transaction(async (tx) => {
      const cashAccountId = await this.ledger.resolveCashAccountId(tx, tenant, dto.cashAccountId ?? null);
      const p = await tx.payment.create({
        data: {
          number: pvNumber,
          supplierId: supplier.id,
          amount: dto.amount,
          method: dto.method ?? 'CASH',
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          notes: dto.notes,
          cashAccountId,
          periodId: period?.id ?? null,
          companyId: tenant,
        },
      });
      if (allocationAmount !== null) {
        await tx.paymentAllocation.create({
          data: { paymentId: p.id, purchaseStatementId: dto.statementId!, amount: allocationAmount },
        });
      }
      await this.ledger.entry(tx, {
        periodId: period?.id ?? null,
        companyId: tenant,
        accountType: 'SUPPLIER',
        accountId: supplier.id,
        debit: dto.amount,
        refType: 'payment',
        refId: p.id,
        description: `سند صرف ${p.number}`,
      });
      await this.ledger.cashEntry(tx, {
        periodId: period?.id ?? null,
        companyId: tenant,
        cashAccountId,
        credit: dto.amount,
        refType: 'payment',
        refId: p.id,
        description: `سند صرف ${p.number}`,
      });
      return p;
    });

    await this.audits.write({
      userId: user.id,
      action: 'collection.payment',
      entity: 'Payment',
      entityId: payment.id,
      afterJson: {
        number: payment.number,
        supplierId: supplier.id,
        amount: dto.amount,
        method: dto.method ?? 'CASH',
        statementId: dto.statementId ?? null,
      },
    });
    return this.prisma.payment.findUnique({
      where: { id: payment.id },
      include: { supplier: true },
    });
  }

  async listPayments(query: { supplierId?: number; limit?: number }, companyId: number | null = null) {
    const rows = await this.prisma.payment.findMany({
      where: { ...tenantWhere(companyId), ...(query.supplierId ? { supplierId: query.supplierId } : {}) },
      include: { supplier: { select: { id: true, code: true, nameAr: true } } },
      orderBy: { paidAt: 'desc' },
      take: Math.min(query.limit ?? 20, 100),
    });
    return { items: rows };
  }

  async updateChequeStatus(id: number, dto: UpdateChequeStatusDto, companyId: number | null = null, userId?: number) {
    const cheque = await this.prisma.cheque.findUnique({ where: { id } });
    if (!cheque || (cheque.companyId != null && cheque.companyId !== companyId)) {
      throw new NotFoundException(`Cheque ${id} not found`);
    }
    if (cheque.status === 'RETURNED') throw new BadRequestException('Cheque already returned');
    const updated = await this.prisma.cheque.update({
      where: { id },
      data: {
        status: dto.status,
        collectedAt: dto.status === 'COLLECTED' ? new Date() : null,
      },
    });
    await this.audits.write({
      userId,
      action: 'cheque.status',
      entity: 'Cheque',
      entityId: id,
      beforeJson: { status: cheque.status },
      afterJson: { status: updated.status },
    });
    return updated;
  }

  async listCheques(query: { status?: 'UNDER_COLLECTION' | 'COLLECTED' | 'RETURNED'; limit?: number }, companyId: number | null = null) {
    const rows = await this.prisma.cheque.findMany({
      where: { ...tenantWhere(companyId), ...(query.status ? { status: query.status } : {}) },
      include: { customer: { select: { id: true, code: true, nameAr: true } } },
      orderBy: { dueDate: 'asc' },
      take: Math.min(query.limit ?? 20, 100),
    });
    return { items: rows };
  }

  /** كشف حساب عميل: افتتاحي + الحركات + الرصيد + كشف المستحقات لكل بيان. */
  async customerStatement(customerId: number, query: QueryStatementOfAccountDto, companyId: number | null = null) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || (customer.companyId != null && customer.companyId !== companyId)) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        accountType: 'CUSTOMER',
        accountId: customerId,
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

    const opening = Number(customer.openingBalance);
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

    const statements = await this.prisma.priceStatement.findMany({
      where: { customerId, status: 'APPROVED', ...tenantWhere(companyId) },
      include: { receiptAllocs: true },
      orderBy: { date: 'asc' },
    });
    const outstandingRows = [];
    for (const s of statements) {
      const retAgg = await this.prisma.returnLine.aggregate({
        where: { sourceLine: { statementId: s.id }, return: { status: 'APPROVED' } },
        _sum: { lineTotal: true },
      });
      const alloc = s.receiptAllocs.reduce((sum, a) => sum + Number(a.amount), 0);
      const outstanding = roundMoney(Number(s.net) - Number(s.paid) - alloc - Number(retAgg._sum.lineTotal ?? 0));
      outstandingRows.push({
        statementId: s.id,
        number: s.number,
        date: s.date,
        net: Number(s.net),
        paid: Number(s.paid),
        allocated: alloc,
        returned: Number(retAgg._sum.lineTotal ?? 0),
        outstanding,
      });
    }

    return {
      customer: { id: customer.id, code: customer.code, nameAr: customer.nameAr },
      openingBalance: opening,
      closingBalance: running,
      movements,
      outstandingStatements: outstandingRows,
      totalOutstanding: roundMoney(outstandingRows.reduce((s, r) => s + r.outstanding, 0)),
    };
  }

  /** المستحق المتبقي على بيان (صافي − مدفوع − تحصيلات − مرتجعات). */
  private async statementOutstanding(statementId: number, companyId: number | null): Promise<number | null> {
    const s = await this.prisma.priceStatement.findUnique({
      where: { id: statementId },
      include: { receiptAllocs: true },
    });
    if (!s || (s.companyId != null && s.companyId !== companyId)) return null;
    const alloc = s.receiptAllocs.reduce((sum, a) => sum + Number(a.amount), 0);
    const retAgg = await this.prisma.returnLine.aggregate({
      where: { sourceLine: { statementId: s.id }, return: { status: 'APPROVED' } },
      _sum: { lineTotal: true },
    });
    return roundMoney(Number(s.net) - Number(s.paid) - alloc - Number(retAgg._sum.lineTotal ?? 0));
  }

  /** المستحق المتبقي على بيان توريد (صافي − مدفوع عند الإنشاء − سندات الصرف المخصّصة). */
  private async purchaseStatementOutstanding(statementId: number, companyId: number | null): Promise<number | null> {
    const s = await this.prisma.purchaseStatement.findUnique({
      where: { id: statementId },
      include: { paymentAllocs: true },
    });
    if (!s || (s.companyId != null && s.companyId !== companyId)) return null;
    const alloc = s.paymentAllocs.reduce((sum, a) => sum + Number(a.amount), 0);
    return roundMoney(Number(s.net) - Number(s.paid) - alloc);
  }

  /** كشف حساب مورد: افتتاحي + الحركات + الرصيد + مستحقات بيانات التوريد. */
  async supplierStatement(supplierId: number, query: QueryStatementOfAccountDto, companyId: number | null = null) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier || (supplier.companyId != null && supplier.companyId !== companyId)) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }

    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        accountType: 'SUPPLIER',
        accountId: supplierId,
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

    const opening = Number(supplier.openingBalance);
    let running = roundMoney(opening);
    const movements = entries.map((e) => {
      const debit = Number(e.debit);
      const credit = Number(e.credit);
      running = roundMoney(running + credit - debit);
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

    const statements = await this.prisma.purchaseStatement.findMany({
      where: { supplierId, status: { not: 'CANCELLED' }, ...tenantWhere(companyId) },
      include: { paymentAllocs: true },
      orderBy: { date: 'asc' },
    });
    const outstandingRows = statements.map((s) => {
      const alloc = s.paymentAllocs.reduce((sum, a) => sum + Number(a.amount), 0);
      const outstanding = roundMoney(Number(s.net) - Number(s.paid) - alloc);
      return {
        statementId: s.id,
        number: s.number,
        date: s.date,
        net: Number(s.net),
        paid: Number(s.paid),
        allocated: alloc,
        outstanding,
      };
    });

    return {
      supplier: { id: supplier.id, code: supplier.code, nameAr: supplier.nameAr },
      openingBalance: opening,
      closingBalance: running,
      movements,
      outstandingStatements: outstandingRows,
      totalOutstanding: roundMoney(outstandingRows.reduce((s, r) => s + r.outstanding, 0)),
    };
  }
}