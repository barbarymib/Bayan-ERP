import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  calcStatementTotals,
  discountToPercent,
  roundMoney,
  roundQty,
  type Discount,
} from '@bayan/shared';
import type { AuthUser } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import { assertCustomerInScope, repCustomerFilter } from '../common/customer-scope.js';
import { allowsDecimalByMeasurement, assertLineQtyAllowed } from '../common/units.js';
import { NumberingService } from '../numbering.service.js';
import { PeriodsService } from '../common/periods.service.js';
import { LedgerService } from '../common/ledger.service.js';
import { SalesOpsService } from '../common/sales-ops.service.js';
import { CompanyService } from '../company/company.service.js';
import { StockService, freezeWarningMessage } from '../common/stock.service.js';
import { PriceResolverService } from '../common/price-resolver.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { CancelStatementDto, CreateStatementDto, QueryStatementsDto, UpdateStatementDto } from './price-statements.dto.js';

const toDbDiscountType = (t?: 'percent' | 'amount'): 'PERCENT' | 'AMOUNT' | null =>
  t === 'percent' ? 'PERCENT' : t === 'amount' ? 'AMOUNT' : null;

/** الحالات التي تُعدّ «مسودة قديمة» إن طالت إقامتها (§11: تحذير للبيانات المسودة القديمة). */
export const DRAFT_STATEMENT_STATUSES = ['DRAFT', 'PENDING_REVIEW'] as const;

/** الإعداد: عدد الأيام التي بعدها يُعدّ البيان المسودة قديماً (افتراضي 3). */
export const STALE_DRAFT_SETTING_KEY = 'statement.stale_draft_days';
export const STALE_DRAFT_DEFAULT_DAYS = 3;

export function isDraftStatementStatus(status: string): boolean {
  return (DRAFT_STATEMENT_STATUSES as readonly string[]).includes(status);
}

/** عُمر البيان بالأيام (من آخر تعديل) — لا يقلّ عن صفر. */
export function statementAgeDays(updatedAt: Date | string, now: Date = new Date()): number {
  const at = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
  const ms = now.getTime() - at.getTime();
  return ms <= 0 ? 0 : Math.floor(ms / 86_400_000);
}

/** يحسب هل البيان مسودة قديمة بحسب حالته وعُمره وعتبة الأيام. */
export function computeStaleDraft(
  status: string,
  updatedAt: Date | string,
  staleDays: number,
  now: Date = new Date(),
): { ageDays: number; isStaleDraft: boolean } {
  const ageDays = statementAgeDays(updatedAt, now);
  return {
    ageDays,
    isStaleDraft: isDraftStatementStatus(status) && ageDays >= Math.max(0, staleDays),
  };
}

interface ResolvedLine {
  item: { id: number; code: string; baseUnitId: number; lastPurchaseCost: number | null };
  unitId: number;
  factor: number;
  qty: number;
  unitPrice: number;
  discount?: Discount;
  cost: number | null;
  minPrice: number | null;
  weightNote?: string;
}

interface DiscountFlag {
  itemCode: string;
  discount: Discount;
  limitPct: number;
  effectivePercent: number;
}

/** خرق سعر: صنف سُعّر أقل من التكلفة أو أقل من الحد الأدنى (§5.3). */
interface PriceViolation {
  itemCode: string;
  unitPrice: number;
  threshold: number;
}

/** تنبيه سعري يُعرض للمستخدم (§5.3 "تنبيه عند البيع بأقل من ..."). */
interface PricingAlert {
  type: 'below_cost' | 'below_min_price';
  itemCode: string;
  unitPrice: number;
  threshold: number;
}

type ApprovalKind = 'ITEM_DISCOUNT' | 'HEADER_DISCOUNT' | 'BELOW_COST' | 'BELOW_MIN_PRICE';

type StatementTotals = ReturnType<typeof calcStatementTotals>;

interface StatementSnapshotSource {
  number: string;
  customerId: number;
  warehouseId: number;
  repId: number | null;
  date: Date;
  status: string;
  paymentTerm: string;
  subtotal: unknown;
  discountType: string | null;
  discountValue: unknown;
  discountAmount: unknown;
  shipping: unknown;
  taxPercent: unknown;
  taxAmount: unknown;
  net: unknown;
  paid: unknown;
  notes: string | null;
  lines: {
    itemId: number;
    unitId: number;
    factor: unknown;
    qty: unknown;
    qtyBase: unknown;
    unitPrice: unknown;
    lineDiscountType: string | null;
    lineDiscountValue: unknown;
    lineDiscountAmount: unknown;
    allocatedHeaderDiscount: unknown;
    netLine: unknown;
    weightNote: string | null;
  }[];
}

@Injectable()
export class PriceStatementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly periods: PeriodsService,
    private readonly ledger: LedgerService,
    private readonly ops: SalesOpsService,
    private readonly stock: StockService,
    private readonly resolver: PriceResolverService,
    private readonly notifications: NotificationsService,
    private readonly audits: AuditLogsService,
    private readonly company: CompanyService,
  ) {}

  async create(dto: CreateStatementDto, user: AuthUser) {
    const tenant = user.companyId ?? null;
    // الضريبة الافتراضية للشركة عند عدم تحديدها في الطلب (R3-B15)
    const effectiveTaxPercent = dto.taxPercent ?? (await this.company.defaultTaxPercent(tenant)) ?? 0;
    // idempotency
    if (dto.clientUuid) {
      const existing = await this.prisma.priceStatement.findFirst({
        where: { clientUuid: dto.clientUuid, ...tenantWhere(tenant) },
      });
      if (existing) return this.findWithDetail(existing.id);
    }
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer || (customer.companyId != null && customer.companyId !== tenant)) {
      throw new NotFoundException(`Customer ${dto.customerId} not found`);
    }
    // نطاق المندوب (§4.2 «عملاؤه»)
    await assertCustomerInScope(this.prisma, customer.id, user, tenant);

    const warehouse =
      dto.warehouseId != null
        ? await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } })
        : await this.prisma.warehouse.findFirst({ where: { code: 'MAIN', ...tenantWhere(tenant) } });
    if (!warehouse || (warehouse.companyId != null && warehouse.companyId !== tenant)) {
      throw new NotFoundException('Warehouse not found');
    }
    const freeze = await this.stock.assertMovable(warehouse.id, tenant);

    const number = dto.number ?? (await this.numbering.issue('BP', user.repCode ?? '', tenant));
    const { resolved, discountFlags, belowCostLines, belowMinPriceLines } = await this.resolveLines(
      dto,
      tenant,
      customer,
      Number(user.maxItemDiscountPct),
    );

    const totals = calcStatementTotals({
      lines: resolved.map((r) => ({ qty: r.qty, unitPrice: r.unitPrice, discount: r.discount })),
      headerDiscount: dto.discount,
      shipping: dto.shipping,
      taxPercent: effectiveTaxPercent,
    });

    if (dto.paid && dto.paid > totals.net) {
      throw new BadRequestException(`paid (${dto.paid}) cannot exceed net (${totals.net})`);
    }

    const headerExceeds = this.headerDiscountExceeds(dto.discount, totals.subtotal, Number(user.maxInvoiceDiscountPct));
    const requiresApproval =
      discountFlags.length > 0 || headerExceeds || belowCostLines.length > 0 || belowMinPriceLines.length > 0;
    const pricingAlerts = this.buildAlerts(belowCostLines, belowMinPriceLines);

    const period = await this.periods.open(tenant);
    const creditWarning = await this.checkCreditLimit(customer.id, totals.net, tenant);
    // منع تجاوز الحد الائتماني عند الإنشاء حسب الإعداد credit.limit.enforce = BLOCK (§5.4)
    await this.ops.assertCustomerCredit(customer.id, totals.net, tenant);

    // منع تجاوز المتاح (مع احترام حجوزات المسودات) حسب الإعداد stock.sale.enforce = BLOCK
    await this.stock.assertSalePermitted(
      warehouse.id,
      resolved.map((r) => ({ itemId: r.item.id, qtyBase: roundQty(r.qty * r.factor) })),
      tenant,
    );

    // تاريخ الاستحقاق = تاريخ البيان + مدة سداد العميل (creditDays) — أساس تقادم الديون (§5.4).
    const statementDate = dto.date ? new Date(dto.date) : new Date();
    const dueDate = new Date(statementDate);
    dueDate.setDate(dueDate.getDate() + (customer.creditDays ?? 0));

    const statement = await this.prisma.priceStatement.create({
      data: {
        number,
        clientUuid: dto.clientUuid ?? randomUUID(),
        customerId: customer.id,
        repId: user.repCode ? user.id : null,
        warehouseId: warehouse.id,
        companyId: tenant,
        date: statementDate,
        dueDate,
        status: 'DRAFT',
        paymentTerm: dto.paymentTerm ?? 'CREDIT',
        subtotal: totals.subtotal,
        discountType: toDbDiscountType(dto.discount?.type),
        discountValue: dto.discount?.value ?? null,
        discountAmount: totals.headerDiscountAmount,
        shipping: totals.shipping,
        taxPercent: effectiveTaxPercent,
        taxAmount: totals.tax,
        net: totals.net,
        paid: dto.paid ?? 0,
        lat: dto.lat,
        lng: dto.lng,
        notes: dto.notes,
        createdById: user.id,
        periodId: period?.id ?? null,
        lines: { create: this.buildLineRows(resolved, totals, period?.id ?? null) },
      },
      include: { lines: { include: { item: true, unit: true } }, customer: true, warehouse: true },
    });

    if (requiresApproval) {
      // حجز مؤقت للكميات أثناء انتظار الموافقة (اختياري §5.7)
      await this.prisma.$transaction(async (tx) => {
        await this.stock.reserve(
          tx,
          'price_statement',
          statement.id,
          warehouse.id,
          resolved.map((r) => ({ itemId: r.item.id, qtyBase: roundQty(r.qty * r.factor) })),
          tenant,
        );
      });
      const approvals = this.buildApprovals(
        discountFlags,
        headerExceeds,
        dto.discount,
        belowCostLines,
        belowMinPriceLines,
        Number(user.maxInvoiceDiscountPct),
      );

      await this.prisma.approval.createMany({
        data: approvals.map((a) => ({
          type: a.type,
          refType: 'price_statement',
          refId: statement.id,
          refJson: a.refJson as object,
          requestedById: user.id,
          status: 'PENDING',
          companyId: tenant,
        })),
      });
      // إشعار من يملك صلاحية الاعتماد (§5.15)
      const targetIds = await this.notifications.userIdsWithPermission('discount.approve');
      for (let i = 0; i < approvals.length; i++) {
        await this.notifications.notifyMany(targetIds, {
          type: 'discount_approval',
          title: 'طلب موافقة على خصم يتجاوز الحد',
          body: `${statement.number} — ${customer.nameAr}`,
          refType: 'price_statement',
          refId: statement.id,
        });
      }
    } else {
      await this.ops.finalizeStatement(statement.id, user);
    }

    // تدقيق إنشاء البيان مع الخصومات (§5.6/§9)
    await this.audits.write({
      userId: user.id,
      action: 'statement.create',
      entity: 'PriceStatement',
      entityId: statement.id,
      afterJson: {
        number: statement.number,
        customerId: customer.id,
        status: requiresApproval ? 'DRAFT' : 'APPROVED',
        subtotal: totals.subtotal,
        discountType: dto.discount?.type ?? null,
        discountValue: dto.discount?.value ?? null,
        discountAmount: totals.headerDiscountAmount,
        net: totals.net,
        requiresApproval,
      },
    });

    const fresh = await this.findWithDetail(statement.id);
    return {
      ...this.stripCost(fresh, user),
      creditWarning,
      pricingAlerts,
      freezeWarning: freeze.frozen && freeze.mode === 'WARN' ? freezeWarningMessage(freeze.sessionNumber ?? '') : null,
    };
  }

  /**
   * تعديل بيان (in-place versioned edit §5.6).
   * - مسودة/بانتظار المراجعة: بصلاحية statement.edit — يُعاد الحساب ويُستبدل البنود.
   * - معتمد: بصلاحية statement.edit_approved — يُحفظ snapshot في statement_revisions،
   *   ثم يُعكس أثر المخزون/الحساب ويُعاد ترحيله بالبيانات الجديدة (ممنوع إن وُجد مدفوع).
   */
  async update(id: number, dto: UpdateStatementDto, user: AuthUser) {
    const tenant = user.companyId ?? null;
    const existing = await this.findWithDetail(id);
    if (!existing || (existing.companyId != null && existing.companyId !== tenant)) {
      throw new NotFoundException(`Statement ${id} not found`);
    }
    await assertCustomerInScope(this.prisma, existing.customerId, user, tenant, true);
    if (existing.status === 'CANCELLED') throw new BadRequestException('لا يمكن تعديل بيان ملغي');
    if (existing.status === 'ARCHIVED') throw new BadRequestException('لا يمكن تعديل بيان مؤرشف');

    const approved = existing.status === 'APPROVED';
    const perms = user.permissions ?? [];
    if (approved) {
      if (!perms.includes('statement.edit_approved')) {
        throw new ForbiddenException('يلزم منح صلاحية "تعديل بيان بعد الاعتماد" (statement.edit_approved)');
      }
      if (Number(existing.paid) > 0 || (dto.paid ?? 0) > 0) {
        throw new BadRequestException('لا يمكن تعديل بيان معتمد له مدفوعات — استخدم الإلغاء أو أنشئ بياناً جديداً');
      }
    } else if (!perms.includes('statement.edit')) {
      throw new ForbiddenException('يلزم منح صلاحية "تعديل بيان" (statement.edit)');
    }

    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer || (customer.companyId != null && customer.companyId !== tenant)) {
      throw new NotFoundException(`Customer ${dto.customerId} not found`);
    }
    await assertCustomerInScope(this.prisma, customer.id, user, tenant);
    const warehouse =
      dto.warehouseId != null
        ? await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } })
        : await this.prisma.warehouse.findFirst({ where: { code: 'MAIN', ...tenantWhere(tenant) } });
    if (!warehouse || (warehouse.companyId != null && warehouse.companyId !== tenant)) {
      throw new NotFoundException('Warehouse not found');
    }
    const freeze = await this.stock.assertMovable(warehouse.id, tenant);

    const { resolved, discountFlags, belowCostLines, belowMinPriceLines } = await this.resolveLines(
      dto,
      tenant,
      customer,
      Number(user.maxItemDiscountPct),
    );
    // R4-A1: عند غياب taxPercent في التعديل يُستخدم الافتراضي للشركة (كما في الإنشاء) بدل صفر.
    const effectiveTaxPercent = dto.taxPercent ?? (await this.company.defaultTaxPercent(tenant)) ?? 0;
    const totals = calcStatementTotals({
      lines: resolved.map((r) => ({ qty: r.qty, unitPrice: r.unitPrice, discount: r.discount })),
      headerDiscount: dto.discount,
      shipping: dto.shipping,
      taxPercent: effectiveTaxPercent,
    });
    if (dto.paid && dto.paid > totals.net) {
      throw new BadRequestException(`paid (${dto.paid}) cannot exceed net (${totals.net})`);
    }
    const headerExceeds = this.headerDiscountExceeds(dto.discount, totals.subtotal, Number(user.maxInvoiceDiscountPct));
    const requiresApproval =
      discountFlags.length > 0 || headerExceeds || belowCostLines.length > 0 || belowMinPriceLines.length > 0;
    const pricingAlerts = this.buildAlerts(belowCostLines, belowMinPriceLines);
    const approvals = requiresApproval
      ? this.buildApprovals(
          discountFlags,
          headerExceeds,
          dto.discount,
          belowCostLines,
          belowMinPriceLines,
          Number(user.maxInvoiceDiscountPct),
        )
      : [];

    const period = await this.periods.open(tenant);
    const required = resolved.map((r) => ({ itemId: r.item.id, qtyBase: roundQty(r.qty * r.factor) }));
    const lineRows = this.buildLineRows(resolved, totals, period?.id ?? null);
    const headerData = this.buildHeaderData(dto, existing, customer.id, warehouse.id, totals, period?.id ?? null, customer.creditDays ?? 0, effectiveTaxPercent);
    if (approved) {
      // R4-A3: إعادة ترحيل بيان معتمد تعيد الفحوصات نفسها قبل خصم المخزن/الترحيل الدفتري
      // (الحد الائتماني BLOCK + توفر المخزون عند الإعداد).
      await this.ops.assertCustomerCredit(customer.id, totals.net, tenant);
      await this.stock.assertSalePermitted(warehouse.id, required, tenant);
      const snapshot = this.buildSnapshot(existing);
      await this.prisma.$transaction(async (tx) => {
        const agg = await tx.statementRevision.aggregate({
          where: { statementId: id },
          _max: { revisionNo: true },
        });
        const revisionNo = (agg._max.revisionNo ?? 0) + 1;
        await tx.statementRevision.create({
          data: {
            statementId: id,
            revisionNo,
            snapshotJson: snapshot as object,
            changedById: user.id,
            reason: dto.reason ?? null,
          },
        });
        // عكس الأثر السابق
        await this.stock.restock(tx, {
          warehouseId: existing.warehouseId,
          refType: 'price_statement',
          refId: id,
          userId: user.id,
          periodId: period?.id ?? null,
          companyId: tenant,
          lines: existing.lines.map((l) => ({ itemId: l.itemId, qtyBase: Number(l.qtyBase) })),
        });
        await this.ledger.entry(tx, {
          periodId: period?.id ?? null,
          companyId: tenant,
          accountType: 'CUSTOMER',
          accountId: existing.customerId,
          credit: Number(existing.net),
          refType: 'price_statement',
          refId: id,
          description: `تعديل بيان ${existing.number} — عكس القيد السابق`,
        });
        // استبدال البنود + إعادة ترحيل الأثر الجديد
        await tx.priceStatementLine.deleteMany({ where: { statementId: id } });
        await tx.priceStatementLine.createMany({ data: lineRows.map((r) => ({ ...r, statementId: id })) });
        await tx.priceStatement.update({ where: { id }, data: { ...headerData, status: 'APPROVED' } });
        await this.stock.saleOut(tx, {
          warehouseId: warehouse.id,
          refType: 'price_statement',
          refId: id,
          userId: user.id,
          periodId: period?.id ?? null,
          companyId: tenant,
          lines: resolved.map((r) => ({ itemId: r.item.id, qtyBase: roundQty(r.qty * r.factor), cost: r.cost })),
        });
        await this.ledger.entry(tx, {
          periodId: period?.id ?? null,
          companyId: tenant,
          accountType: 'CUSTOMER',
          accountId: customer.id,
          debit: totals.net,
          refType: 'price_statement',
          refId: id,
          description: `تعديل بيان ${existing.number} — القيد الجديد`,
        });
      });
    } else {
      // تحرير حجوزات المسودة قبل فحص الإتاحة، ثم الاستبدال
      await this.prisma.$transaction((tx) => this.stock.releaseReservations(tx, 'price_statement', id));
      await this.stock.assertSalePermitted(warehouse.id, required, tenant);
      await this.prisma.$transaction(async (tx) => {
        await tx.approval.updateMany({
          where: { refType: 'price_statement', refId: id, status: 'PENDING' },
          data: { status: 'REJECTED', decidedById: user.id, decidedAt: new Date(), note: 'أُعيد فتح البيان للتعديل' },
        });
        await tx.priceStatementLine.deleteMany({ where: { statementId: id } });
        await tx.priceStatementLine.createMany({ data: lineRows.map((r) => ({ ...r, statementId: id })) });
        await tx.priceStatement.update({ where: { id }, data: { ...headerData, status: 'DRAFT' } });
        if (requiresApproval) {
          await this.stock.reserve(tx, 'price_statement', id, warehouse.id, required, tenant);
          await tx.approval.createMany({
            data: approvals.map((a) => ({
              type: a.type,
              refType: 'price_statement',
              refId: id,
              refJson: a.refJson as object,
              requestedById: user.id,
              status: 'PENDING',
              companyId: tenant,
            })),
          });
        }
      });
      if (requiresApproval) {
        const targetIds = await this.notifications.userIdsWithPermission('discount.approve');
        for (let i = 0; i < approvals.length; i++) {
          await this.notifications.notifyMany(targetIds, {
            type: 'discount_approval',
            title: 'طلب موافقة على خصم يتجاوز الحد',
            body: `${existing.number} — ${customer.nameAr}`,
            refType: 'price_statement',
            refId: id,
          });
        }
      } else {
        await this.ops.finalizeStatement(id, user);
      }
    }

    await this.audits.write({
      userId: user.id,
      action: approved ? 'statement.edit_approved' : 'statement.edit',
      entity: 'PriceStatement',
      entityId: id,
      beforeJson: {
        status: existing.status,
        net: Number(existing.net),
        subtotal: Number(existing.subtotal),
        discountType: existing.discountType,
        discountValue: existing.discountValue != null ? Number(existing.discountValue) : null,
        discountAmount: Number(existing.discountAmount),
      },
      afterJson: {
        status: approved || !requiresApproval ? 'APPROVED' : 'DRAFT',
        net: totals.net,
        subtotal: totals.subtotal,
        discountType: dto.discount?.type ?? null,
        discountValue: dto.discount?.value ?? null,
        discountAmount: totals.headerDiscountAmount,
        reason: dto.reason ?? null,
      },
    });

    const fresh = await this.findWithDetail(id);
    return {
      ...this.stripCost(fresh, user),
      pricingAlerts,
      freezeWarning: freeze.frozen && freeze.mode === 'WARN' ? freezeWarningMessage(freeze.sessionNumber ?? '') : null,
    };
  }

  async list(query: QueryStatementsDto, user: AuthUser) {
    const companyId = user.companyId ?? null;
    const limit = query.limit ?? 20;
    const customerFilter = await repCustomerFilter(this.prisma, user, companyId, query.customerId);
    const rows = await this.prisma.priceStatement.findMany({
      where: {
        ...tenantWhere(companyId),
        ...customerFilter,
        ...(query.repId ? { repId: query.repId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.from || query.to
          ? {
              date: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      include: {
        customer: { select: { id: true, code: true, nameAr: true } },
        warehouse: { select: { id: true, code: true, nameAr: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });
    const total = await this.prisma.priceStatement.count({
      where: {
        ...tenantWhere(companyId),
        ...customerFilter,
        ...(query.repId ? { repId: query.repId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
    });
    const staleDays = await this.staleDraftDays();
    const items = rows.map((r) => ({
      ...r,
      ...computeStaleDraft(r.status, r.updatedAt, staleDays),
      overdue: this.isOverdue(r.status, r.dueDate, Number(r.net), Number(r.paid)),
    }));
    return { total, items, staleDraftDays: staleDays };
  }

  async get(id: number, user: AuthUser) {
    const st = await this.findWithDetail(id);
    if (!st || (st.companyId != null && st.companyId !== (user.companyId ?? null))) {
      throw new NotFoundException(`Statement ${id} not found`);
    }
        await assertCustomerInScope(this.prisma, st.customerId, user, user.companyId ?? null, true);
    const approvals = await this.prisma.approval.findMany({
      where: { refType: 'price_statement', refId: id, ...tenantWhere(user.companyId ?? null) },
      include: {
        requestedBy: { select: { id: true, name: true } },
        decidedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const revisions = await this.prisma.statementRevision.findMany({
      where: { statementId: id },
      orderBy: { revisionNo: 'desc' },
      select: { id: true, revisionNo: true, reason: true, changedById: true, createdAt: true },
    });
    const staleDays = await this.staleDraftDays();
    return {
      ...this.stripCost(st, user),
      ...computeStaleDraft(st.status, st.updatedAt, staleDays),
      overdue: this.isOverdue(st.status, st.dueDate, Number(st.net), Number(st.paid)),
      staleDraftDays: staleDays,
      approvals,
      revisions,
    };
  }

  /** متأخر: معتمد، ومرور تاريخ الاستحقاق (dueDate = التاريخ + creditDays) مع بقاء رصيد مستحق (§5.4). */
  private isOverdue(status: string, dueDate: Date | null | undefined, net: number, paid: number): boolean {
    if (status !== 'APPROVED' || !dueDate) return false;
    return new Date(dueDate).getTime() < Date.now() && net - paid > 0.005;
  }

  async cancel(id: number, dto: CancelStatementDto, user: AuthUser) {
    const st = await this.prisma.priceStatement.findUnique({
      where: { id },
      select: { status: true, companyId: true, customerId: true },
    });
    if (!st || (st.companyId != null && st.companyId !== (user.companyId ?? null))) {
      throw new NotFoundException(`Statement ${id} not found`);
    }
    await assertCustomerInScope(this.prisma, st.customerId, user, user.companyId ?? null, true);
    if (!dto.reason.trim()) throw new BadRequestException('Cancellation reason is required');
    if (st.status === 'CANCELLED') throw new BadRequestException('Statement already cancelled');

    if (st.status === 'APPROVED') {
      await this.ops.cancelStatement(id, user);
    } else {
      // مسودة: تحرير الحجز + آجال أغلفق الموافقات المعلقة قبل الإلغاء
      await this.prisma.$transaction(async (tx) => {
        await this.stock.releaseReservations(tx, 'price_statement', id);
        await tx.priceStatement.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            notes: [null, dto.reason].filter(Boolean).join(' • ') || dto.reason,
            cancelReason: dto.reason,
            cancelledById: user.id,
            cancelledAt: new Date(),
          },
        });
        await tx.approval.updateMany({
          where: { refType: 'price_statement', refId: id, status: 'PENDING' },
          data: { status: 'REJECTED', decidedById: user.id, decidedAt: new Date(), note: 'أُغلق بسبب إلغاء المستند' },
        });
      });
    }
    await this.audits.write({
      userId: user.id,
      action: 'statement.cancel',
      entity: 'PriceStatement',
      entityId: id,
      beforeJson: { status: st.status },
      afterJson: { status: 'CANCELLED', reason: dto.reason },
    });
    return { id, status: 'CANCELLED' as const };
  }

  /** رصيد العميل الحالي مقابل حدّه الائتماني + تحذير عند الاقتراب من البيان الجديد. */
  private async checkCreditLimit(customerId: number, newNet: number, companyId: number | null = null) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || Number(customer.creditLimit) <= 0) return null;
    const { debit, credit } = await this.ledger.balanceOf('CUSTOMER', customerId, companyId);
    const outstanding = Number(customer.openingBalance) + debit - credit + newNet;
    return {
      creditLimit: Number(customer.creditLimit),
      projectedBalance: roundMoney(outstanding),
      exceeded: outstanding > Number(customer.creditLimit),
    };
  }

  /** حلّ البنود والأسعار والخصومات (مشترك بين الإنشاء والتعديل). */
  private async resolveLines(
    dto: Pick<CreateStatementDto, 'lines'>,
    tenant: number | null,
    customer: { id: number; priceListId: number | null },
    maxItemDiscountPct: number,
  ): Promise<{
    resolved: ResolvedLine[];
    discountFlags: DiscountFlag[];
    belowCostLines: PriceViolation[];
    belowMinPriceLines: PriceViolation[];
  }> {
    const resolved: ResolvedLine[] = [];
    const discountFlags: DiscountFlag[] = [];
    const belowCostLines: PriceViolation[] = [];
    const belowMinPriceLines: PriceViolation[] = [];

    for (const line of dto.lines) {
      const item = await this.prisma.item.findFirst({
        where: { code: line.itemCode, ...tenantWhere(tenant) },
        include: {
          baseUnit: { select: { measurement: true, nameAr: true } },
          category: { select: { code: true } },
        },
      });
      if (!item) throw new NotFoundException(`Item ${line.itemCode} not found`);
      if (!item.active) throw new BadRequestException(`Item ${line.itemCode} is inactive`);

      // ملاحظة الوزن الفعلي (§5.2) — متاحة لأصناف الحديد فقط للتفريق بين النظري والفعلي.
      const weightNote = line.weightNote?.trim() || undefined;
      if (weightNote && item.category?.code !== 'STEEL') {
        throw new BadRequestException(`ملاحظة الوزن الفعلي متاحة لأصناف الحديد فقط (§5.2) — ${item.code}`);
      }

      let unitId = item.baseUnitId;
      let factor = 1;
      let allowDecimal = allowsDecimalByMeasurement(item.baseUnit.measurement);
      let unitName = item.baseUnit.nameAr;
      if (line.unitCode) {
        const unit = await this.prisma.unit.findUnique({ where: { code: line.unitCode } });
        if (!unit) throw new NotFoundException(`Unit ${line.unitCode} not found`);
        if (unit.id !== item.baseUnitId) {
          const iu = await this.prisma.itemUnit.findUnique({
            where: { itemId_unitId: { itemId: item.id, unitId: unit.id } },
          });
          if (!iu) throw new BadRequestException(`Unit ${line.unitCode} is not linked to item ${item.code}`);
          if (!iu.isSale) throw new BadRequestException(`Unit ${line.unitCode} is not a sale unit`);
          unitId = unit.id;
          factor = Number(iu.factorToBase);
          allowDecimal = iu.allowDecimal;
        }
        unitName = unit.nameAr;
      }
      assertLineQtyAllowed(line.qty, allowDecimal, unitName);

      let unitPrice = line.unitPrice;
      if (unitPrice === undefined) {
        // السعر الخاص (§5.16) أولاً ثم قائمة أسعار العميل
        unitPrice = await this.resolver.resolve({
          itemId: item.id,
          unitId,
          customerId: customer.id,
          priceListId: customer.priceListId,
          companyId: tenant,
        });
      }
      if (unitPrice === undefined) {
        throw new BadRequestException(`No price for ${item.code} in the customer's price list — provide unitPrice`);
      }

      // حد أدنى لسعر البيع (§5.3) — يُقاس على وحدة البيع بمعامل التحويل
      const cost = item.lastPurchaseCost != null ? Number(item.lastPurchaseCost) * factor : null;
      if (cost !== null && unitPrice < cost) {
        belowCostLines.push({ itemCode: item.code, unitPrice, threshold: cost });
      }
      const minPrice = item.minSalePrice != null ? Number(item.minSalePrice) * factor : null;
      if (minPrice !== null && unitPrice < minPrice) {
        belowMinPriceLines.push({ itemCode: item.code, unitPrice, threshold: minPrice });
      }

      // تقييد الخصم: يُحوَّل النوعان لبعضهما (§5.3) فيُفحص الخصم بالنسبة المكافئة أيّاً كان نوعه
      if (line.discount && line.discount.value > 0) {
        const gross = roundMoney(line.qty * unitPrice);
        const effectivePercent = discountToPercent(line.discount, gross);
        if (effectivePercent > maxItemDiscountPct) {
          discountFlags.push({ itemCode: item.code, discount: line.discount, limitPct: maxItemDiscountPct, effectivePercent });
        }
      }

      resolved.push({
        item: { id: item.id, code: item.code, baseUnitId: item.baseUnitId, lastPurchaseCost: item.lastPurchaseCost != null ? Number(item.lastPurchaseCost) : null },
        unitId,
        factor,
        qty: line.qty,
        unitPrice,
        discount: line.discount,
        cost,
        minPrice,
        weightNote,
      });
    }
    return { resolved, discountFlags, belowCostLines, belowMinPriceLines };
  }

  /** هل يتجاوز خصم البيان الحد المسموح؟ يُحوَّل بالقيمة/النسبة لبعضهما ثم يُقاس بالنسبة المكافئة (§5.3). */
  private headerDiscountExceeds(discount: Discount | undefined, subtotal: number, maxInvoiceDiscountPct: number): boolean {
    if (!discount || discount.value <= 0) return false;
    return discountToPercent(discount, subtotal) > maxInvoiceDiscountPct;
  }

  /** تنبيهات سعرية (أقل من التكلفة / أقل من الحد الأدنى) تُعاد مع البيان (§5.3). */
  private buildAlerts(belowCostLines: PriceViolation[], belowMinPriceLines: PriceViolation[]): PricingAlert[] {
    return [
      ...belowCostLines.map((v): PricingAlert => ({ type: 'below_cost', ...v })),
      ...belowMinPriceLines.map((v): PricingAlert => ({ type: 'below_min_price', ...v })),
    ];
  }

  /** صفوف بنود البيان الجاهزة للكتابة (مشتركة بين الإنشاء والتعديل). */
  private buildLineRows(resolved: ResolvedLine[], totals: StatementTotals, periodId: number | null) {
    return resolved.map((r, i) => {
      const t = totals.lines[i]!;
      return {
        itemId: r.item.id,
        unitId: r.unitId,
        factor: r.factor,
        qty: r.qty,
        qtyBase: roundQty(r.qty * r.factor),
        unitPrice: r.unitPrice,
        lineDiscountType: toDbDiscountType(r.discount?.type),
        lineDiscountValue: r.discount?.value ?? null,
        lineDiscountAmount: t.lineDiscountAmount,
        allocatedHeaderDiscount: t.allocatedHeaderDiscount,
        netLine: t.netFinal,
        costSnapshot: r.cost,
        weightNote: r.weightNote ?? null,
        periodId,
      };
    });
  }

  private buildApprovals(
    discountFlags: DiscountFlag[],
    headerExceeds: boolean,
    headerDiscount: Discount | undefined,
    belowCostLines: PriceViolation[],
    belowMinPriceLines: PriceViolation[],
    maxInvoiceDiscountPct: number,
  ): { type: ApprovalKind; refJson: object }[] {
    const approvals: { type: ApprovalKind; refJson: object }[] = discountFlags.map((flag) => ({
      type: 'ITEM_DISCOUNT',
      refJson: {
        itemCode: flag.itemCode,
        discount: flag.discount,
        userLimitPct: flag.limitPct,
        effectivePercent: flag.effectivePercent,
      } as object,
    }));
    if (headerExceeds) {
      approvals.push({
        type: 'HEADER_DISCOUNT',
        refJson: { discount: headerDiscount, userLimitPct: maxInvoiceDiscountPct } as object,
      });
    }
    if (belowCostLines.length > 0) {
      approvals.push({ type: 'BELOW_COST', refJson: { lines: belowCostLines } as object });
    }
    if (belowMinPriceLines.length > 0) {
      approvals.push({
        type: 'BELOW_MIN_PRICE',
        refJson: { note: 'Selling below the item minimum sale price', lines: belowMinPriceLines } as object,
      });
    }
    return approvals;
  }

  private buildHeaderData(
    dto: UpdateStatementDto,
    existing: { date: Date; paymentTerm: 'CASH' | 'CREDIT' | 'MIXED' },
    customerId: number,
    warehouseId: number,
    totals: StatementTotals,
    periodId: number | null,
    creditDays: number | null = null,
    taxPercent: number | null = null,
  ) {
    const date = dto.date ? new Date(dto.date) : existing.date;
    const dueDate = new Date(date);
    dueDate.setDate(dueDate.getDate() + (creditDays ?? 0));
    return {
      customerId,
      warehouseId,
      date,
      dueDate,
      paymentTerm: dto.paymentTerm ?? existing.paymentTerm,
      subtotal: totals.subtotal,
      discountType: toDbDiscountType(dto.discount?.type),
      discountValue: dto.discount?.value ?? null,
      discountAmount: totals.headerDiscountAmount,
      shipping: totals.shipping,
      taxPercent: taxPercent ?? dto.taxPercent ?? 0,
      taxAmount: totals.tax,
      net: totals.net,
      paid: dto.paid ?? 0,
      lat: dto.lat ?? null,
      lng: dto.lng ?? null,
      notes: dto.notes ?? null,
      periodId,
    };
  }

  /** لقطة كاملة لحالة البيان قبل التعديل تُحفظ في statement_revisions. */
  private buildSnapshot(existing: StatementSnapshotSource) {
    return {
      capturedAt: new Date().toISOString(),
      header: {
        number: existing.number,
        customerId: existing.customerId,
        warehouseId: existing.warehouseId,
        repId: existing.repId,
        date: existing.date,
        status: existing.status,
        paymentTerm: existing.paymentTerm,
        subtotal: Number(existing.subtotal),
        discountType: existing.discountType,
        discountValue: existing.discountValue != null ? Number(existing.discountValue) : null,
        discountAmount: Number(existing.discountAmount),
        shipping: Number(existing.shipping),
        taxPercent: Number(existing.taxPercent),
        taxAmount: Number(existing.taxAmount),
        net: Number(existing.net),
        paid: Number(existing.paid),
        notes: existing.notes,
      },
      lines: existing.lines.map((l) => ({
        itemId: l.itemId,
        unitId: l.unitId,
        factor: Number(l.factor),
        qty: Number(l.qty),
        qtyBase: Number(l.qtyBase),
        unitPrice: Number(l.unitPrice),
        lineDiscountType: l.lineDiscountType,
        lineDiscountValue: l.lineDiscountValue != null ? Number(l.lineDiscountValue) : null,
        lineDiscountAmount: Number(l.lineDiscountAmount),
        allocatedHeaderDiscount: Number(l.allocatedHeaderDiscount),
        netLine: Number(l.netLine),
        weightNote: l.weightNote,
      })),
    };
  }

  /**
   * إخفاء سعر التكلفة (costSnapshot / lastPurchaseCost) عمن لا يملك cost.view (§4.2).
   */
  private stripCost<T>(detail: T, user: AuthUser): T {
    if (user.permissions?.includes('cost.view') || detail == null) return detail;
    const d = detail as { lines?: Array<Record<string, unknown>> };
    if (!Array.isArray(d.lines)) return detail;
    for (const line of d.lines) {
      line.costSnapshot = null;
      const item = line.item as Record<string, unknown> | undefined;
      if (item && 'lastPurchaseCost' in item) item.lastPurchaseCost = null;
    }
    return detail;
  }

  private async findWithDetail(id: number) {
    const detail = await this.prisma.priceStatement.findUnique({
      where: { id },
      include: {
        lines: { include: { item: true, unit: true } },
        customer: true,
        warehouse: true,
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });
    if (detail) this.addDiscountConversion(detail);
    return detail;
  }

  /** يضيف التمثيل المكافئ للخصم (النسبة المكافئة) على الرأس والبنود — تحويل آلي (§5.3). */
  private addDiscountConversion<T>(detail: T): T {
    const d = detail as { subtotal: unknown; discountType: string | null; discountValue: unknown; lines?: Array<Record<string, unknown>> } & Record<string, unknown>;
    d.discountPercent = this.effectivePercent(d.discountType, d.discountValue, Number(d.subtotal));
    for (const line of d.lines ?? []) {
      const gross = roundMoney(Number(line.qty) * Number(line.unitPrice));
      line.lineDiscountPercent = this.effectivePercent((line.lineDiscountType as string | null) ?? null, line.lineDiscountValue, gross);
    }
    return detail;
  }

  /** النسبة المكافئة لخصم مخزَّن (نوع + قيمة) على أساس معطى (§5.3). */
  private effectivePercent(dbType: string | null, value: unknown, base: number): number {
    if (value == null) return 0;
    const discount: Discount =
      dbType === 'PERCENT' ? { type: 'percent', value: Number(value) } : { type: 'amount', value: Number(value) };
    return discountToPercent(discount, base);
  }

  /** عتبة «المسودة القديمة» بالأيام من الإعدادات (افتراضي 3) (§11). */
  private async staleDraftDays(): Promise<number> {
    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: STALE_DRAFT_SETTING_KEY },
      });
      if (!setting) return STALE_DRAFT_DEFAULT_DAYS;
      const n = Number(String(setting.value).trim());
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : STALE_DRAFT_DEFAULT_DAYS;
    } catch {
      return STALE_DRAFT_DEFAULT_DAYS;
    }
  }
}