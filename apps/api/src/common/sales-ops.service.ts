import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import type { AuthUser } from '../auth/auth.decorators.js';
import { NumberingService } from '../numbering.service.js';
import { PeriodsService } from './periods.service.js';
import { StockService, Tx } from './stock.service.js';
import { LedgerService } from './ledger.service.js';
import { tenantWhere } from './tenant.js';

interface MoveLine {
  itemId: number;
  qtyBase: number;
  cost?: number | null;
}

/** إنهاء الحركات المالية/المخزنية عند اعتماد بيان أو مرتجع. */
@Injectable()
export class SalesOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly ledger: LedgerService,
    private readonly numbering: NumberingService,
    private readonly periods: PeriodsService,
  ) {}

  /** اعتماد بيان أسعار: صرف من المخزن + قيد على حساب العميل + سند قبض للمدفوع. */
  async finalizeStatement(statementId: number, by: AuthUser): Promise<boolean> {
    const st = await this.prisma.priceStatement.findUnique({
      where: { id: statementId },
      include: { lines: true },
    });
    if (!st || (st.companyId != null && st.companyId !== (by.companyId ?? null))) {
      throw new NotFoundException(`Statement ${statementId} not found`);
    }
    if (st.status === 'APPROVED') return false;
    if (st.status === 'CANCELLED') throw new BadRequestException('Statement is cancelled — cannot finalize');

    const tenant = by.companyId ?? null;
    // منع تجاوز الحد الائتماني عند الاعتماد حسب الإعداد (§5.4)
    await this.assertCustomerCredit(st.customerId, Number(st.net), tenant);
    const period = await this.periods.open(tenant);
    const rcNumber = Number(st.paid) > 0 ? await this.numbering.issue('RC', by.repCode ?? '', tenant) : null;

    await this.prisma.$transaction(async (tx) => {
      const lines: MoveLine[] = st.lines.map((l) => ({
        itemId: l.itemId,
        qtyBase: Number(l.qtyBase),
        cost: l.costSnapshot ? Number(l.costSnapshot) : null,
      }));
      await this.stock.saleOut(tx, {
        warehouseId: st.warehouseId,
        refType: 'price_statement',
        refId: st.id,
        userId: by.id,
        periodId: period?.id ?? null,
        companyId: tenant,
        lines,
      });
      // تحرير أي حجز مسودة عند الاعتماد
      await this.stock.releaseReservations(tx, 'price_statement', st.id);
      await this.ledger.entry(tx, {
        periodId: period?.id ?? null,
        companyId: tenant,
        accountType: 'CUSTOMER',
        accountId: st.customerId,
        debit: Number(st.net),
        refType: 'price_statement',
        refId: st.id,
        description: `بيان أسعار ${st.number}`,
      });
      if (rcNumber) {
        const cashAccountId = await this.ledger.resolveCashAccountId(tx, tenant);
        const receipt = await tx.receipt.create({
          data: {
            number: rcNumber,
            customerId: st.customerId,
            amount: Number(st.paid),
            method: 'CASH',
            receivedAt: new Date(),
            cashAccountId,
            periodId: period?.id ?? null,
            companyId: tenant,
          },
        });
        await tx.receiptAllocation.create({
          data: { receiptId: receipt.id, statementId: st.id, amount: Number(st.paid) },
        });
        await this.ledger.entry(tx, {
          periodId: period?.id ?? null,
          companyId: tenant,
          accountType: 'CUSTOMER',
          accountId: st.customerId,
          credit: Number(st.paid),
          refType: 'receipt',
          refId: receipt.id,
          description: `سند قبض ${receipt.number}`,
        });
        await this.ledger.cashEntry(tx, {
          periodId: period?.id ?? null,
          companyId: tenant,
          cashAccountId,
          debit: Number(st.paid),
          refType: 'receipt',
          refId: receipt.id,
          description: `سند قبض ${receipt.number}`,
        });
      }
      await tx.priceStatement.update({
        where: { id: st.id },
        data: {
          status: 'APPROVED',
          approvedById: st.approvedById ?? by.id,
          approvedAt: st.approvedAt ?? new Date(),
        },
      });
    });
    return true;
  }

  /**
   * منع تجاوز الحد الائتماني عند الاعتماد/التعديل حسب الإعداد `credit.limit.enforce` = BLOCK (§5.4).
   * WARN (الافتراضي): لا يمنع؛ التحذير يظهر عبر `checkCreditLimit` في إنشاء بيان الأسعار.
   * يُطبَّق على مسار الاعتماد (assertDecidable) وعلى الترحيل المباشر (finalizeStatement).
   * يُتجاوز إن لم يكن للعميل حد ائتماني أو كان الإعداد WARN.
   */
  async assertCustomerCredit(customerId: number, newNet: number, companyId: number | null): Promise<void> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'credit.limit.enforce' } });
    if ((setting?.value ?? 'WARN') !== 'BLOCK') return;
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || Number(customer.creditLimit) <= 0) return;
    const { debit, credit } = await this.ledger.balanceOf('CUSTOMER', customerId, companyId);
    const limit = Number(customer.creditLimit);
    const projected = Number(customer.openingBalance) + debit - credit + newNet;
    if (projected > limit) {
      throw new BadRequestException(
        `تجاوز الحد الائتماني: الرصيد المتوقع ${projected.toFixed(2)} يتجاوز الحد ${limit.toFixed(2)}`,
      );
    }
  }

  /** اعتماد مرتجع: إعادة للمخزن (صالح) أو التالف + قيد دائن على العميل. */
  async finalizeReturn(returnId: number, by: AuthUser): Promise<boolean> {
    const rt = await this.prisma.returnStatement.findUnique({
      where: { id: returnId },
      include: {
        lines: { include: { sourceLine: { include: { statement: { select: { warehouseId: true } } } } } },
      },
    });
    if (!rt || (rt.companyId != null && rt.companyId !== (by.companyId ?? null))) {
      throw new NotFoundException(`Return ${returnId} not found`);
    }
    if (rt.status === 'APPROVED') return false;
    if (rt.status === 'CANCELLED') throw new BadRequestException('Return is cancelled — cannot finalize');
    if (!rt.customerId) throw new NotFoundException('Return has no customer to credit');
    // رد النقدية من الخزينة يتطلب صلاحية صريحة (§5.9 / §4.2)
    if (rt.settlement === 'CASH' && !by.permissions.includes('return.cash_refund')) {
      throw new ForbiddenException('Missing permission: return.cash_refund');
    }

    const tenant = by.companyId ?? null;
    const period = await this.periods.open(tenant);
    const warehouses = await this.prisma.warehouse.findMany({
      where: tenantWhere(tenant),
      select: { id: true, type: true, code: true },
    });
    const damaged = warehouses.find((w) => w.type === 'DAMAGED') ?? warehouses.find((w) => w.code === 'MAIN');

    await this.prisma.$transaction(async (tx) => {
      // تجميع بنود العودة حسب المخزن (المصدر للصالح، التالف للتالف)
      const groups = new Map<number, MoveLine[]>();
      for (const line of rt.lines) {
        const srcWarehouseId =
          line.sourceLine?.statement.warehouseId ?? warehouses.find((w) => w.code === 'MAIN')?.id ?? warehouses[0]?.id;
        if (srcWarehouseId == null) throw new BadRequestException('No warehouse available to receive return');
        const whId =
          line.condition === 'GOOD'
            ? srcWarehouseId
            : damaged?.id ?? srcWarehouseId;
        const arr = groups.get(whId) ?? [];
        arr.push({ itemId: line.itemId, qtyBase: Number(line.qtyBase), cost: null });
        groups.set(whId, arr);
      }
      for (const [warehouseId, lines] of groups) {
        await this.stock.returnIn(tx, [{ warehouseId, lines }], {
          refType: 'return_statement',
          refId: rt.id,
          userId: by.id,
          periodId: period?.id ?? null,
          companyId: tenant,
        });
      }
      await this.ledger.entry(tx, {
        periodId: period?.id ?? null,
        companyId: tenant,
        accountType: 'CUSTOMER',
        accountId: rt.customerId!,
        credit: Number(rt.total),
        refType: 'return_statement',
        refId: rt.id,
        description: `بيان مرتجع ${rt.number}`,
      });
      // رد نقدية: يعادل أثر العميل ويُخرج النقدية من الخزينة
      if (rt.settlement === 'CASH') {
        const cashAccountId = await this.ledger.resolveCashAccountId(tx, tenant);
        if (cashAccountId != null) {
          await this.ledger.entry(tx, {
            periodId: period?.id ?? null,
            companyId: tenant,
            accountType: 'CUSTOMER',
            accountId: rt.customerId!,
            debit: Number(rt.total),
            refType: 'return_refund',
            refId: rt.id,
            description: `رد نقدية مرتجع ${rt.number}`,
          });
          await this.ledger.cashEntry(tx, {
            periodId: period?.id ?? null,
            companyId: tenant,
            cashAccountId,
            credit: Number(rt.total),
            refType: 'return_refund',
            refId: rt.id,
            description: `رد نقدية مرتجع ${rt.number}`,
          });
        }
      }
      await tx.returnStatement.update({
        where: { id: rt.id },
        data: { status: 'APPROVED', approvedById: by.id, approvedAt: new Date() },
      });
    });
    return true;
  }

  /**
   * حجز بيان بانتظار المراجعة (PENDING_REVIEW) مع الاحتفاظ بالكميات (§5.7).
   * - إن كان معتمداً: يُعكس الصرف والقيد ثم تُحتجز الكميات (لم يُعد مباعاً).
   * - إن كان مسودة: يُضمن وجود حجز نشط (البيانات المطلوبة للموافقة محجوزة أصلاً).
   * البيان المدفوع لا يُحجز (يتعذّر عكس سند القبض) — يُرفض كالإلغاء.
   */
  async holdForReview(statementId: number, by: AuthUser): Promise<boolean> {
    const st = await this.prisma.priceStatement.findUnique({ where: { id: statementId }, include: { lines: true } });
    if (!st || (st.companyId != null && st.companyId !== (by.companyId ?? null))) {
      throw new NotFoundException(`Statement ${statementId} not found`);
    }
    if (st.status === 'CANCELLED') throw new BadRequestException('Statement is cancelled — cannot hold');
    if (st.status === 'PENDING_REVIEW') return false;
    if (st.status === 'APPROVED' && Number(st.paid) > 0) {
      throw new BadRequestException(`Statement ${statementId} has payments — cannot hold for review`);
    }

    const tenant = by.companyId ?? null;
    const lines = st.lines.map((l) => ({ itemId: l.itemId, qtyBase: Number(l.qtyBase) }));
    const period = await this.periods.open(tenant);
    await this.prisma.$transaction(async (tx) => {
      if (st.status === 'APPROVED') {
        await this.stock.restock(tx, {
          warehouseId: st.warehouseId,
          refType: 'price_statement',
          refId: st.id,
          userId: by.id,
          periodId: period?.id ?? null,
          companyId: tenant,
          lines,
        });
        await this.ledger.entry(tx, {
          periodId: period?.id ?? null,
          companyId: tenant,
          accountType: 'CUSTOMER',
          accountId: st.customerId,
          credit: Number(st.net),
          refType: 'price_statement',
          refId: st.id,
          description: `حجز بيان للمراجعة ${st.number}`,
        });
      }
      if (st.status !== 'DRAFT') {
        await this.stock.reserve(tx, 'price_statement', st.id, st.warehouseId, lines, tenant);
      } else {
        const active = await tx.stockReservation.findFirst({
          where: { refType: 'price_statement', refId: st.id, status: 'ACTIVE', ...tenantWhere(tenant) },
          select: { id: true },
        });
        if (!active) await this.stock.reserve(tx, 'price_statement', st.id, st.warehouseId, lines, tenant);
      }
      await tx.priceStatement.update({ where: { id: st.id }, data: { status: 'PENDING_REVIEW' } });
    });
    return true;
  }

  /** تراجع عن بيان معتمد (إلغاء): عكس الصرف + قيد عكسي. */
  async cancelStatement(statementId: number, by: AuthUser): Promise<boolean> {
    const st = await this.prisma.priceStatement.findUnique({ where: { id: statementId }, include: { lines: true } });
    if (!st || (st.companyId != null && st.companyId !== (by.companyId ?? null))) {
      throw new NotFoundException(`Statement ${statementId} not found`);
    }
    if (st.status !== 'APPROVED') throw new NotFoundException(`Statement ${statementId} is not approved`);
    if (Number(st.paid) > 0) throw new NotFoundException(`Statement ${statementId} has payments — cannot cancel`);

    const tenant = by.companyId ?? null;
    const period = await this.periods.open(tenant);
    await this.prisma.$transaction(async (tx) => {
      await this.stock.restock(tx, {
        warehouseId: st.warehouseId,
        refType: 'price_statement',
        refId: st.id,
        userId: by.id,
        periodId: period?.id ?? null,
        companyId: tenant,
        lines: st.lines.map((l) => ({ itemId: l.itemId, qtyBase: Number(l.qtyBase) })),
      });
      await this.ledger.entry(tx, {
        periodId: period?.id ?? null,
        companyId: tenant,
        accountType: 'CUSTOMER',
        accountId: st.customerId,
        credit: Number(st.net),
        refType: 'price_statement',
        refId: st.id,
        description: `إلغاء بيان أسعار ${st.number}`,
      });
      await tx.priceStatement.update({ where: { id: st.id }, data: { status: 'CANCELLED' } });
    });
    return true;
  }
}

export type { Tx };