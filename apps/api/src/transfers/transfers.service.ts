import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { NumberingService } from '../numbering.service.js';
import { PeriodsService } from '../common/periods.service.js';
import { StockService, freezeWarningMessage } from '../common/stock.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { tenantWhere } from '../common/tenant.js';
import type { CreateTransferDto, QueryTransfersDto } from './transfers.dto.js';

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly periods: PeriodsService,
    private readonly stock: StockService,
    private readonly audits: AuditLogsService,
  ) {}

  /** إنشاء تحويل مخزني: يخصم من المصدر ويضيف للوجهة ذرّياً. */
  async create(dto: CreateTransferDto, user: AuthUser) {
    const tenant = user.companyId ?? null;
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('لا يمكن التحويل إلى نفس المخزن');
    }
    const [from, to] = await Promise.all([
      this.prisma.warehouse.findUnique({ where: { id: dto.fromWarehouseId } }),
      this.prisma.warehouse.findUnique({ where: { id: dto.toWarehouseId } }),
    ]);
    if (!from || (from.companyId != null && from.companyId !== tenant)) {
      throw new NotFoundException(`Warehouse ${dto.fromWarehouseId} not found`);
    }
    if (!to || (to.companyId != null && to.companyId !== tenant)) {
      throw new NotFoundException(`Warehouse ${dto.toWarehouseId} not found`);
    }

    const [fromFreeze, toFreeze] = [
      await this.stock.assertMovable(from.id, tenant),
      await this.stock.assertMovable(to.id, tenant),
    ];
    const frozen = fromFreeze.frozen && fromFreeze.mode === 'WARN' ? fromFreeze : toFreeze.frozen && toFreeze.mode === 'WARN' ? toFreeze : null;
    const freezeWarning = frozen ? freezeWarningMessage(frozen.sessionNumber ?? '') : null;

    const number = await this.numbering.issue('TR', '', tenant);
    const period = await this.periods.open(tenant);

    const id = await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.create({
        data: {
          number,
          fromWarehouseId: from.id,
          toWarehouseId: to.id,
          companyId: tenant,
          status: 'COMPLETED',
          notes: dto.notes?.trim() || null,
          createdById: user.id,
          periodId: period?.id ?? null,
          lines: {
            create: dto.lines.map((l) => ({
              itemId: l.itemId,
              batchId: l.batchId ?? '',
              qtyBase: l.qtyBase,
              cost: l.cost ?? null,
            })),
          },
        },
      });

      await this.stock.transferOut(tx, {
        warehouseId: from.id,
        refType: 'transfer',
        refId: transfer.id,
        userId: user.id,
        periodId: period?.id ?? null,
        companyId: tenant,
        lines: dto.lines.map((l) => ({ itemId: l.itemId, batchId: l.batchId ?? '', qtyBase: l.qtyBase, cost: l.cost ?? null })),
      });
      await this.stock.transferIn(tx, {
        warehouseId: to.id,
        refType: 'transfer',
        refId: transfer.id,
        userId: user.id,
        periodId: period?.id ?? null,
        companyId: tenant,
        lines: dto.lines.map((l) => ({ itemId: l.itemId, batchId: l.batchId ?? '', qtyBase: l.qtyBase, cost: l.cost ?? null })),
      });

      return transfer.id;
    });

    await this.audits.write({
      userId: user.id,
      action: 'transfer.execute',
      entity: 'StockTransfer',
      entityId: id,
      afterJson: {
        number,
        fromWarehouseId: from.id,
        toWarehouseId: to.id,
        lines: dto.lines.length,
      },
    });

    return { ...(await this.get(id, tenant)), freezeWarning };
  }

  async list(query: QueryTransfersDto, companyId: number | null = null) {
    const where = {
      ...tenantWhere(companyId),
      ...(query.status ? { status: query.status } : {}),
      ...(query.warehouseId
        ? { OR: [{ fromWarehouseId: query.warehouseId }, { toWarehouseId: query.warehouseId }] }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.stockTransfer.count({ where }),
      this.prisma.stockTransfer.findMany({
        where,
        include: {
          fromWarehouse: { select: { id: true, code: true, nameAr: true } },
          toWarehouse: { select: { id: true, code: true, nameAr: true } },
          lines: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 20,
      }),
    ]);
    return {
      total,
      items: rows.map(({ lines, ...rest }) => ({ ...rest, _count: { lines: lines.length } })),
    };
  }

  async get(id: number, companyId: number | null = null) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        fromWarehouse: { select: { id: true, code: true, nameAr: true } },
        toWarehouse: { select: { id: true, code: true, nameAr: true } },
        lines: { include: { item: { select: { id: true, code: true, nameAr: true, baseUnit: { select: { code: true, nameAr: true } } } } } },
      },
    });
    if (!transfer || (transfer.companyId != null && transfer.companyId !== companyId)) {
      throw new NotFoundException(`Transfer ${id} not found`);
    }
    return transfer;
  }
}