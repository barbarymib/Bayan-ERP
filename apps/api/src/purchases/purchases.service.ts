import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  apportionLandedCost,
  calcStatementTotals,
  roundMoney,
  roundQty,
  type Discount,
} from '@bayan/shared';
import type { AuthUser } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import { allowsDecimalByMeasurement, assertLineQtyAllowed } from '../common/units.js';
import { NumberingService } from '../numbering.service.js';
import { PeriodsService } from '../common/periods.service.js';
import { StockService, type Tx } from '../common/stock.service.js';
import { LedgerService } from '../common/ledger.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { CreatePurchaseDto, QueryPurchasesDto } from './purchases.dto.js';

const toDbDiscountType = (t?: 'percent' | 'amount'): 'PERCENT' | 'AMOUNT' | null =>
  t === 'percent' ? 'PERCENT' : t === 'amount' ? 'AMOUNT' : null;

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly periods: PeriodsService,
    private readonly stock: StockService,
    private readonly ledger: LedgerService,
    private readonly audits: AuditLogsService,
  ) {}

  async create(dto: CreatePurchaseDto, user: AuthUser) {
    const tenant = user.companyId ?? null;
    const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier || (supplier.companyId != null && supplier.companyId !== tenant)) {
      throw new NotFoundException(`Supplier ${dto.supplierId} not found`);
    }

    const warehouse =
      dto.warehouseId != null
        ? await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } })
        : await this.prisma.warehouse.findFirst({ where: { code: 'MAIN', ...tenantWhere(tenant) } });
    if (!warehouse || (warehouse.companyId != null && warehouse.companyId !== tenant)) {
      throw new NotFoundException('Warehouse not found');
    }
    await this.stock.assertMovable(warehouse.id, tenant);

    const number = await this.numbering.issue('PR', user.repCode ?? '', tenant);

    const resolved: {
      itemId: number;
      unitId: number;
      factor: number;
      qty: number;
      unitPrice: number;
      discount?: Discount;
      batchId?: string;
      expiry?: string;
    }[] = [];

    for (const line of dto.lines) {
      const item = await this.prisma.item.findFirst({
        where: { code: line.itemCode, ...tenantWhere(tenant) },
        include: { baseUnit: { select: { measurement: true, nameAr: true } } },
      });
      if (!item) throw new NotFoundException(`Item ${line.itemCode} not found`);

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
          if (!iu.isPurchase) throw new BadRequestException(`Unit ${line.unitCode} is not a purchase unit`);
          unitId = unit.id;
          factor = Number(iu.factorToBase);
          allowDecimal = iu.allowDecimal;
        }
        unitName = unit.nameAr;
      }
      assertLineQtyAllowed(line.qty, allowDecimal, unitName);

      // دفعات الأصناف §5.1 — الدفعة مسموحة فقط لأصناف تتتبعها، والصلاحية تتطلب كود دفعة
      const batchId = line.batchId?.trim() ?? '';
      if (batchId && !item.trackBatch) {
        throw new BadRequestException(`الصنف ${item.code} لا يتتبع الدفعات — لا يمكن ربط دفعة به.`);
      }
      if (line.expiry && !batchId) {
        throw new BadRequestException('تاريخ الصلاحية يتطلب كود دفعة (batchId).');
      }

      resolved.push({
        itemId: item.id,
        unitId,
        factor,
        qty: line.qty,
        unitPrice: line.unitPrice,
        discount: line.discount,
        batchId,
        expiry: line.expiry,
      });
    }

    const totals = calcStatementTotals({
      lines: resolved.map((r) => ({ qty: r.qty, unitPrice: r.unitPrice, discount: r.discount })),
      headerDiscount: dto.discount,
      shipping: dto.shipping,
      taxPercent: dto.taxPercent,
    });

    // توزيع مصاريف النقل/الإضافية على البنود (Landed Cost §5.5)
    const qtyBases = resolved.map((r) => roundQty(r.qty * r.factor));
    const shippingShares = apportionLandedCost(
      resolved.map((r, i) => ({ net: totals.lines[i]!.netFinal, qtyBase: qtyBases[i]! })),
      totals.shipping,
      dto.landedCostBasis ?? 'VALUE',
    );
    const landedUnitCost = (i: number): number =>
      qtyBases[i]! > 0 ? roundMoney((totals.lines[i]!.netFinal + shippingShares[i]!) / qtyBases[i]!) : 0;

    if (dto.paid && dto.paid > totals.net) {
      throw new BadRequestException(`paid (${dto.paid}) cannot exceed net (${totals.net})`);
    }

    const period = await this.periods.open(tenant);
    const pvNumber = dto.paid ? await this.numbering.issue('PV', user.repCode ?? '', tenant) : null;

    const purchase = await this.prisma.$transaction(async (tx) => {
      const p = await tx.purchaseStatement.create({
        data: {
          number,
          supplierId: supplier.id,
          warehouseId: warehouse.id,
          companyId: tenant,
          date: dto.date ? new Date(dto.date) : new Date(),
          status: 'APPROVED',
          subtotal: totals.subtotal,
          discountType: toDbDiscountType(dto.discount?.type),
          discountValue: dto.discount?.value ?? null,
          discountAmount: totals.headerDiscountAmount,
          shipping: totals.shipping,
          net: totals.net,
          landedCostTotal: totals.shipping > 0 ? totals.shipping : null,
          paid: dto.paid ?? 0,
          notes: dto.notes,
          periodId: period?.id ?? null,
          lines: {
            create: resolved.map((r, i) => {
              const qtyBase = qtyBases[i]!;
              const t = totals.lines[i]!;
              return {
                itemId: r.itemId,
                unitId: r.unitId,
                factor: r.factor,
                qty: r.qty,
                qtyBase,
                unitPrice: r.unitPrice,
                lineDiscountType: toDbDiscountType(r.discount?.type),
                lineDiscountValue: r.discount?.value ?? null,
                lineDiscountAmount: t.lineDiscountAmount,
                netLine: t.netFinal,
                landedCost: landedUnitCost(i),
                batchId: r.batchId ?? '',
                periodId: period?.id ?? null,
              };
            }),
          },
        },
      });

      for (const line of resolved) {
        const i = resolved.indexOf(line);
        const qtyBase = qtyBases[i]!;
        const cost = landedUnitCost(i);
        if (line.batchId) {
          await this.upsertBatch(tx, tenant, line.itemId, line.batchId, line.expiry ?? null);
        }
        await this.stock.purchaseIn(tx, {
          warehouseId: warehouse.id,
          refType: 'purchase_statement',
          refId: p.id,
          userId: user.id,
          periodId: period?.id ?? null,
          companyId: tenant,
          lines: [{ itemId: line.itemId, qtyBase, cost, batchId: line.batchId || undefined }],
        });
        await tx.item.update({
          where: { id: line.itemId },
          data: { lastPurchaseCost: cost },
        });
      }

      await this.ledger.entry(tx, {
        periodId: period?.id ?? null,
        companyId: tenant,
        accountType: 'SUPPLIER',
        accountId: supplier.id,
        credit: totals.net,
        refType: 'purchase_statement',
        refId: p.id,
        description: `بيان توريد ${number}`,
      });

      if (dto.paid) {
        const cashAccountId = await this.ledger.resolveCashAccountId(tx, tenant);
        const payment = await tx.payment.create({
          data: {
            number: pvNumber!,
            supplierId: supplier.id,
            amount: dto.paid,
            method: dto.paymentMethod ?? 'CASH',
            paidAt: new Date(),
            cashAccountId,
            periodId: period?.id ?? null,
            companyId: tenant,
          },
        });
        await this.ledger.entry(tx, {
          periodId: period?.id ?? null,
          companyId: tenant,
          accountType: 'SUPPLIER',
          accountId: supplier.id,
          debit: dto.paid,
          refType: 'payment',
          refId: payment.id,
          description: `سند صرف ${payment.number}`,
        });
        await this.ledger.cashEntry(tx, {
          periodId: period?.id ?? null,
          companyId: tenant,
          cashAccountId,
          credit: dto.paid,
          refType: 'payment',
          refId: payment.id,
          description: `سند صرف ${payment.number}`,
        });
      }
      return p;
    });

    // تدقيق إنشاء بيان التوريد (§9)
    await this.audits.write({
      userId: user.id,
      action: 'purchase.create',
      entity: 'PurchaseStatement',
      entityId: purchase.id,
      afterJson: {
        number,
        supplierId: supplier.id,
        warehouseId: warehouse.id,
        subtotal: totals.subtotal,
        discountAmount: totals.headerDiscountAmount,
        shipping: totals.shipping,
        net: totals.net,
        paid: dto.paid ?? 0,
      },
    });

    const fresh = await this.prisma.purchaseStatement.findUnique({
      where: { id: purchase.id },
      include: { lines: { include: { item: true, unit: true } }, supplier: true, warehouse: true },
    });
    return fresh;
  }

  /** تسجيل/تحديث دفعة الصنف (كود + صلاحية) عند توريدها §5.1. */
  private async upsertBatch(
    tx: Tx,
    companyId: number | null,
    itemId: number,
    code: string,
    expiryIso: string | null,
  ) {
    const expiry = expiryIso ? new Date(expiryIso) : undefined;
    const existing = await tx.batch.findFirst({ where: { itemId, code, ...tenantWhere(companyId) } });
    if (existing) {
      if (expiry !== undefined) {
        await tx.batch.update({ where: { id: existing.id }, data: { expiry } });
      }
      return;
    }
    await tx.batch.create({
      data: {
        itemId,
        code,
        ...tenantWhere(companyId),
        ...(expiry ? { expiry } : {}),
      },
    });
  }

  async list(query: QueryPurchasesDto, companyId: number | null = null) {
    const limit = query.limit ?? 20;
    const rows = await this.prisma.purchaseStatement.findMany({
      where: {
        ...tenantWhere(companyId),
        ...(query.supplierId ? { supplierId: query.supplierId } : {}),
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
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
        supplier: { select: { id: true, code: true, nameAr: true } },
        warehouse: { select: { id: true, code: true, nameAr: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });
    return { items: rows };
  }

  async get(id: number, companyId: number | null = null) {
    const p = await this.prisma.purchaseStatement.findUnique({
      where: { id },
      include: {
        lines: { include: { item: true, unit: true } },
        supplier: true,
        warehouse: true,
      },
    });
    if (!p || (p.companyId != null && p.companyId !== companyId)) {
      throw new NotFoundException(`Purchase ${id} not found`);
    }
    return p;
  }
}