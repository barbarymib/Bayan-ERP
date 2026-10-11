import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { roundMoney, roundQty } from '@bayan/shared';
import type { AuthUser } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { NumberingService } from '../numbering.service.js';
import { PeriodsService } from '../common/periods.service.js';
import { StockService } from '../common/stock.service.js';
import { LedgerService } from '../common/ledger.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { tenantWhere } from '../common/tenant.js';
import type { CreateSupplierReturnDto, QuerySupplierReturnsDto } from './supplier-returns.dto.js';

@Injectable()
export class SupplierReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly periods: PeriodsService,
    private readonly stock: StockService,
    private readonly ledger: LedgerService,
    private readonly audits: AuditLogsService,
  ) {}

  /** مرتجع مشتريات: صرف من المخزن + تخفيض مديونية المورد. */
  async create(dto: CreateSupplierReturnDto, user: AuthUser) {
    const tenant = user.companyId ?? null;
    const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier || (supplier.companyId != null && supplier.companyId !== tenant)) {
      throw new NotFoundException(`Supplier ${dto.supplierId} not found`);
    }
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse || (warehouse.companyId != null && warehouse.companyId !== tenant)) {
      throw new NotFoundException(`Warehouse ${dto.warehouseId} not found`);
    }
    await this.stock.assertMovable(warehouse.id, tenant);

    const resolved: { itemId: number; unitId: number; factor: number; qty: number; unitPrice: number; qtyBase: number; lineTotal: number }[] = [];
    for (const line of dto.lines) {
      const item = await this.prisma.item.findUnique({ where: { id: line.itemId } });
      if (!item || (item.companyId != null && item.companyId !== tenant)) {
        throw new NotFoundException(`Item ${line.itemId} not found`);
      }
      let unitId = item.baseUnitId;
      let factor = 1;
      if (line.unitId != null && line.unitId !== item.baseUnitId) {
        const iu = await this.prisma.itemUnit.findUnique({ where: { itemId_unitId: { itemId: item.id, unitId: line.unitId } } });
        if (!iu) throw new BadRequestException(`Unit ${line.unitId} is not linked to item ${item.id}`);
        unitId = line.unitId;
        factor = Number(iu.factorToBase);
      }
      const qtyBase = roundQty(line.qty * factor);
      resolved.push({ itemId: item.id, unitId, factor, qty: line.qty, unitPrice: line.unitPrice, qtyBase, lineTotal: roundMoney(line.qty * line.unitPrice) });
    }

    const total = roundMoney(resolved.reduce((s, r) => s + r.lineTotal, 0));
    const number = await this.numbering.issue('SR', user.repCode ?? '', tenant);
    const period = await this.periods.open(tenant);

    const ret = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supplierReturn.create({
        data: {
          number,
          supplierId: supplier.id,
          warehouseId: warehouse.id,
          companyId: tenant,
          date: dto.date ? new Date(dto.date) : new Date(),
          total,
          reason: dto.reason?.trim() || null,
          notes: dto.notes?.trim() || null,
          createdById: user.id,
          periodId: period?.id ?? null,
          lines: {
            create: resolved.map((r) => ({
              itemId: r.itemId,
              unitId: r.unitId,
              qty: r.qty,
              qtyBase: r.qtyBase,
              unitPrice: r.unitPrice,
              lineTotal: r.lineTotal,
            })),
          },
        },
      });

      await this.stock.returnOut(tx, {
        warehouseId: warehouse.id,
        refType: 'supplier_return',
        refId: created.id,
        userId: user.id,
        periodId: period?.id ?? null,
        companyId: tenant,
        lines: resolved.map((r) => ({ itemId: r.itemId, qtyBase: r.qtyBase })),
      });

      await this.ledger.entry(tx, {
        periodId: period?.id ?? null,
        companyId: tenant,
        accountType: 'SUPPLIER',
        accountId: supplier.id,
        debit: total,
        refType: 'supplier_return',
        refId: created.id,
        description: `مرتجع مشتريات ${number}`,
      });

      return created;
    });

    await this.audits.write({
      userId: user.id,
      action: 'supplier_return.create',
      entity: 'SupplierReturn',
      entityId: ret.id,
      afterJson: { number, supplierId: supplier.id, lines: dto.lines.length },
    });
    return this.get(ret.id, tenant);
  }

  async list(query: QuerySupplierReturnsDto, companyId: number | null = null) {
    const where = { ...tenantWhere(companyId), ...(query.supplierId ? { supplierId: query.supplierId } : {}) };
    const [total, rows] = await Promise.all([
      this.prisma.supplierReturn.count({ where }),
      this.prisma.supplierReturn.findMany({
        where,
        include: { supplier: { select: { id: true, code: true, nameAr: true } }, lines: { select: { id: true } } },
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 20,
      }),
    ]);
    return { total, items: rows.map(({ lines, ...rest }) => ({ ...rest, _count: { lines: lines.length } })) };
  }

  async get(id: number, companyId: number | null = null) {
    const ret = await this.prisma.supplierReturn.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: { select: { id: true, code: true, nameAr: true } },
        lines: { include: { item: { select: { id: true, code: true, nameAr: true } }, unit: true } },
      },
    });
    if (!ret || (ret.companyId != null && ret.companyId !== companyId)) {
      throw new NotFoundException(`Supplier return ${id} not found`);
    }
    return ret;
  }
}