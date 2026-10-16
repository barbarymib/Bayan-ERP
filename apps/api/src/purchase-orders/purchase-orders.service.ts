import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { calcStatementTotals, roundMoney, roundQty, type Discount } from '@bayan/shared';
import type { AuthUser } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { NumberingService } from '../numbering.service.js';
import { PeriodsService } from '../common/periods.service.js';
import { PurchasesService } from '../purchases/purchases.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { tenantWhere } from '../common/tenant.js';
import { allowsDecimalByMeasurement, assertLineQtyAllowed } from '../common/units.js';
import type {
  CancelPurchaseOrderDto,
  CreatePurchaseOrderDto,
  QueryPurchaseOrdersDto,
  ReceivePurchaseOrderDto,
} from './purchase-orders.dto.js';

const toDbDiscountType = (t?: 'percent' | 'amount'): 'PERCENT' | 'AMOUNT' | null =>
  t === 'percent' ? 'PERCENT' : t === 'amount' ? 'AMOUNT' : null;

const fromDbDiscountType = (t: 'PERCENT' | 'AMOUNT' | null): 'percent' | 'amount' | undefined =>
  t === 'PERCENT' ? 'percent' : t === 'AMOUNT' ? 'amount' : undefined;

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly periods: PeriodsService,
    private readonly purchases: PurchasesService,
    private readonly audits: AuditLogsService,
  ) {}

  async create(dto: CreatePurchaseOrderDto, user: AuthUser) {
    const tenant = user.companyId ?? null;
    const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier || (supplier.companyId != null && supplier.companyId !== tenant)) {
      throw new NotFoundException(`Supplier ${dto.supplierId} not found`);
    }

    const warehouse = dto.warehouseId
      ? await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } })
      : await this.prisma.warehouse.findFirst({ where: { code: 'MAIN', ...tenantWhere(tenant) } });
    const warehouseId = warehouse?.id;
    if (!warehouseId || (warehouse.companyId != null && warehouse.companyId !== tenant)) {
      throw new NotFoundException('Warehouse not found');
    }

    const resolved: { itemId: number; unitId: number; factor: number; qty: number; unitPrice: number; discount?: Discount }[] = [];
    for (const line of dto.lines) {
      const item = await this.prisma.item.findUnique({
        where: { id: line.itemId },
        include: { baseUnit: { select: { measurement: true, nameAr: true } } },
      });
      if (!item || (item.companyId != null && item.companyId !== tenant)) {
        throw new NotFoundException(`Item ${line.itemId} not found`);
      }
      let unitId = item.baseUnitId;
      let factor = 1;
      let allowDecimal = allowsDecimalByMeasurement(item.baseUnit.measurement);
      let unitName = item.baseUnit.nameAr;
      if (line.unitId != null && line.unitId !== item.baseUnitId) {
        const iu = await this.prisma.itemUnit.findUnique({
          where: { itemId_unitId: { itemId: item.id, unitId: line.unitId } },
          include: { unit: { select: { nameAr: true } } },
        });
        if (!iu) throw new BadRequestException(`Unit ${line.unitId} is not linked to item ${item.id}`);
        unitId = line.unitId;
        factor = Number(iu.factorToBase);
        allowDecimal = iu.allowDecimal;
        unitName = iu.unit.nameAr;
      }
      assertLineQtyAllowed(line.qty, allowDecimal, unitName);
      resolved.push({ itemId: item.id, unitId, factor, qty: line.qty, unitPrice: line.unitPrice, discount: line.discount });
    }

    const totals = calcStatementTotals({
      lines: resolved.map((r) => ({ qty: r.qty, unitPrice: r.unitPrice, discount: r.discount })),
    });

    const number = await this.numbering.issue('PO', user.repCode ?? '', tenant);
    const period = await this.periods.open(tenant);

    const order = await this.prisma.purchaseOrder.create({
      data: {
        number,
        supplierId: supplier.id,
        warehouseId,
        companyId: tenant,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        status: 'DRAFT',
        subtotal: totals.subtotal,
        discountAmount: totals.headerDiscountAmount,
        net: totals.net,
        notes: dto.notes?.trim() || null,
        createdById: user.id,
        periodId: period?.id ?? null,
        lines: {
          create: resolved.map((r, i) => {
            const t = totals.lines[i]!;
            return {
              itemId: r.itemId,
              unitId: r.unitId,
              factor: r.factor,
              qty: r.qty,
              qtyBase: roundQty(r.qty * r.factor),
              unitPrice: r.unitPrice,
              lineDiscountType: toDbDiscountType(r.discount?.type),
              lineDiscountValue: r.discount?.value ?? null,
              lineDiscountAmount: t.lineDiscountAmount,
              netLine: t.netFinal,
            };
          }),
        },
      },
    });
    await this.audits.write({
      userId: user.id,
      action: 'purchase_order.create',
      entity: 'PurchaseOrder',
      entityId: order.id,
      afterJson: { supplierId: order.supplierId },
    });
    return this.get(order.id, tenant);
  }

  async list(query: QueryPurchaseOrdersDto, companyId: number | null = null) {
    const where = {
      ...tenantWhere(companyId),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        include: { supplier: { select: { id: true, code: true, nameAr: true } }, lines: { select: { id: true } } },
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 20,
      }),
    ]);
    return { total, items: rows.map(({ lines, ...rest }) => ({ ...rest, _count: { lines: lines.length } })) };
  }

  async get(id: number, companyId: number | null = null) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: { select: { id: true, code: true, nameAr: true } },
        lines: { include: { item: { select: { id: true, code: true, nameAr: true } }, unit: true } },
      },
    });
    if (!order || (order.companyId != null && order.companyId !== companyId)) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
    return order;
  }

  async approve(id: number, user: AuthUser) {
    const order = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order || (order.companyId != null && order.companyId !== (user.companyId ?? null))) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
    if (order.status !== 'DRAFT') throw new BadRequestException('يمكن اعتماد أوامر الشراء في حالة مسودة فقط');
    await this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'APPROVED', approvedById: user.id, approvedAt: new Date() } });
    await this.audits.write({
      userId: user.id,
      action: 'purchase_order.approve',
      entity: 'PurchaseOrder',
      entityId: id,
      beforeJson: { status: order.status },
      afterJson: { status: 'APPROVED' },
    });
    return this.get(id, user.companyId ?? null);
  }

  async cancel(id: number, dto: CancelPurchaseOrderDto, user: AuthUser) {
    const order = await this.prisma.purchaseOrder.findUnique({ where: { id }, select: { id: true, status: true, companyId: true } });
    if (!order || (order.companyId != null && order.companyId !== (user.companyId ?? null))) {
      throw new NotFoundException(`PurchaseOrder ${id} not found`);
    }
    if (order.status === 'RECEIVED' || order.status === 'CLOSED') throw new BadRequestException('لا يمكن إلغاء أمر مستلم');
    if (!dto.reason?.trim()) throw new BadRequestException('سبب الإلغاء إلزامي');
    await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED', notes: dto.reason.trim() },
    });
    await this.audits.write({
      userId: user.id,
      action: 'purchase_order.cancel',
      entity: 'PurchaseOrder',
      entityId: id,
      beforeJson: { status: order.status },
      afterJson: { status: 'CANCELLED', reason: dto.reason.trim() },
    });
    return this.get(id, user.companyId ?? null);
  }

  /** استلام أمر شراء: يُنشئ بيان توريد مرتبطاً ويُرحّل للمخزون. */
  async receive(id: number, dto: ReceivePurchaseOrderDto, user: AuthUser) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: { include: { item: true, unit: true } } },
    });
    if (!order || (order.companyId != null && order.companyId !== (user.companyId ?? null))) {
      throw new NotFoundException(`PurchaseOrder ${id} not found`);
    }
    if (order.status !== 'APPROVED') throw new BadRequestException('يجب اعتماد أمر الشراء قبل الاستلام');

    const purchase = await this.purchases.create(
      {
        supplierId: order.supplierId,
        warehouseId: dto.warehouseId ?? order.warehouseId ?? undefined,
        date: dto.date,
        lines: order.lines.map((l) => ({
          itemCode: l.item.code,
          unitCode: l.unit.code,
          qty: Number(l.qty),
          unitPrice: Number(l.unitPrice),
          discount: l.lineDiscountType
            ? { type: fromDbDiscountType(l.lineDiscountType)!, value: Number(l.lineDiscountValue ?? 0) }
            : undefined,
        })),
        shipping: dto.shipping,
        landedCostBasis: dto.landedCostBasis,
        taxPercent: dto.taxPercent,
        paid: dto.paid,
        paymentMethod: dto.paymentMethod,
      },
      user,
    );

    if (!purchase) throw new BadRequestException('تعذّر إنشاء بيان التوريد');

    await this.prisma.$transaction(async (tx) => {
      await tx.purchaseStatement.update({
        where: { id: purchase.id },
        data: { orderId: order.id, landedCostTotal: roundMoney(dto.shipping ?? 0) },
      });
      for (const l of order.lines) {
        await tx.purchaseOrderLine.update({
          where: { id: l.id },
          data: { receivedQtyBase: roundQty(Number(l.qtyBase)) },
        });
      }
      await tx.purchaseOrder.update({ where: { id: order.id }, data: { status: 'RECEIVED' } });
    });

    await this.audits.write({
      userId: user.id,
      action: 'purchase_order.receive',
      entity: 'PurchaseOrder',
      entityId: order.id,
      beforeJson: { status: order.status },
      afterJson: { status: 'RECEIVED', purchaseStatementId: purchase.id, purchaseStatementNumber: purchase.number },
    });

    return this.get(order.id, user.companyId ?? null);
  }
}