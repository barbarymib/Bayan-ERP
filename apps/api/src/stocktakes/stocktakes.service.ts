import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  diffOfStocktakeLine,
  roundQty,
  summarizeStocktake,
  type StocktakeLineCalc,
} from '@bayan/shared';
import type { AuthUser } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { NumberingService } from '../numbering.service.js';
import { PeriodsService } from '../common/periods.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { tenantWhere } from '../common/tenant.js';
import type {
  AbortStocktakeDto,
  OpenStocktakeDto,
  QueryStocktakesDto,
  StocktakeCountsDto,
} from './stocktakes.dto.js';

const ACTIVE_STATUSES = ['OPEN', 'COUNTING', 'REVIEW'] as const;

function freezeMessage(number: string): string {
  return `المخزن مجمّد — توجد جلسة جرد نشطة (${number}). أنهِ أو ألغِ الجلسة قبل تنفيذ حركات المخزون.`;
}

const toLineCalc = (l: { systemQtyBase: unknown; countedQtyBase: unknown; lastCost: unknown }): StocktakeLineCalc => ({
  systemQtyBase: Number(l.systemQtyBase),
  countedQtyBase: l.countedQtyBase != null ? Number(l.countedQtyBase) : null,
  lastCost: l.lastCost != null ? Number(l.lastCost) : null,
});

@Injectable()
export class StocktakesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly periods: PeriodsService,
    private readonly audits: AuditLogsService,
  ) {}

  /** فتح جلسة جرد: تجميد لحظي (Snapshot) لرصيد النظام لكل صنف/تشغيلة بالمخزن. */
  async open(dto: OpenStocktakeDto, user: AuthUser) {
    const tenant = user.companyId ?? null;
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse || (warehouse.companyId != null && warehouse.companyId !== tenant)) {
      throw new NotFoundException(`Warehouse ${dto.warehouseId} not found`);
    }

    const active = await this.prisma.stocktakeSession.findFirst({
      where: { warehouseId: warehouse.id, ...tenantWhere(tenant), status: { in: [...ACTIVE_STATUSES] } },
    });
    if (active) throw new BadRequestException(freezeMessage(active.number));

    const number = await this.numbering.issue('ST', '', tenant);
    const period = await this.periods.open(tenant);

    const where: Record<string, unknown> = { warehouseId: warehouse.id, NOT: { qtyBase: 0 } };
    const scope = dto.scope;
    if (scope?.itemIds?.length) {
      where.itemId = { in: scope.itemIds };
    } else if (scope?.categoryIds?.length || scope?.brandIds?.length) {
      where.item = {
        ...(scope.categoryIds?.length ? { categoryId: { in: scope.categoryIds } } : {}),
        ...(scope.brandIds?.length ? { brandId: { in: scope.brandIds } } : {}),
      };
    }

    const balances = await this.prisma.stockBalance.findMany({
      where,
      select: { itemId: true, batchId: true, qtyBase: true },
    });
    const items = await this.prisma.item.findMany({
      where: { id: { in: [...new Set(balances.map((b) => b.itemId))] } },
      select: { id: true, lastPurchaseCost: true },
    });
    const costOf = new Map<number, number | null>(items.map((i) => [i.id, i.lastPurchaseCost != null ? Number(i.lastPurchaseCost) : null]));

    const session = await this.prisma.stocktakeSession.create({
      data: {
        number,
        warehouseId: warehouse.id,
        companyId: tenant,
        status: 'OPEN',
        scopeJson: scope && (scope.itemIds?.length || scope.categoryIds?.length || scope.brandIds?.length) ? (scope as object) : undefined,
        openedById: user.id,
        periodId: period?.id ?? null,
        lines: {
          create: balances.map((b) => ({
            itemId: b.itemId,
            batchId: b.batchId,
            systemQtyBase: Number(b.qtyBase),
            lastCost: costOf.get(b.itemId) ?? null,
          })),
        },
      },
    });

    return this.get(session.id, tenant);
  }

  async list(query: QueryStocktakesDto, companyId: number | null = null) {
    const limit = query.limit ?? 20;
    const where = {
      ...tenantWhere(companyId),
      ...(query.status ? { status: query.status } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    };
    const rows = await this.prisma.stocktakeSession.findMany({
      where,
      include: {
        warehouse: { select: { id: true, code: true, nameAr: true } },
        openedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        lines: { select: { systemQtyBase: true, countedQtyBase: true, lastCost: true } },
      },
      orderBy: { openedAt: 'desc' },
      take: limit,
    });
    const total = await this.prisma.stocktakeSession.count({ where });
    return {
      total,
      items: rows.map((r) => {
        const { lines, ...rest } = r;
        return { ...rest, _count: { lines: lines.length }, summary: summarizeStocktake(lines.map(toLineCalc)) };
      }),
    };
  }

  async get(id: number, companyId: number | null = null) {
    const session = await this.prisma.stocktakeSession.findUnique({
      where: { id },
      include: {
        warehouse: true,
        openedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        lines: { include: { item: { select: { id: true, code: true, nameAr: true, minStock: true, lastPurchaseCost: true, trackBatch: true } }, countedBy: { select: { id: true, name: true } } } },
      },
    });
    if (!session || (session.companyId != null && session.companyId !== companyId)) {
      throw new NotFoundException(`Stocktake ${id} not found`);
    }
    const { lines, ...rest } = session;
    return { ...rest, _count: { lines: lines.length }, summary: summarizeStocktake(lines.map(toLineCalc)), lines };
  }

  /** إدخال الكميات الفعلية (يدعم أكثر من جولة عد — recount). */
  async counts(id: number, dto: StocktakeCountsDto, user: AuthUser) {
    const session = await this.prisma.stocktakeSession.findUnique({
      where: { id },
      select: { id: true, warehouseId: true, status: true, companyId: true },
    });
    if (!session || (session.companyId != null && session.companyId !== (user.companyId ?? null))) {
      throw new NotFoundException(`Stocktake ${id} not found`);
    }
    if (session.status !== 'OPEN' && session.status !== 'COUNTING') {
      throw new BadRequestException('لا يمكن تعديل العدات إلا في حالة مفتوحة أو قيد العد (OPEN/COUNTING)');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const c of dto.counts) {
        const item = await tx.item.findUnique({ where: { id: c.itemId }, select: { id: true, lastPurchaseCost: true, companyId: true } });
        if (!item || (item.companyId != null && item.companyId !== (user.companyId ?? null))) {
          throw new NotFoundException(`Item ${c.itemId} not found`);
        }
        const batchId = c.batchId ?? '';
        const key = { sessionId: id, itemId: c.itemId, batchId };

        let systemQty = 0;
        const existing = await tx.stocktakeLine.findUnique({ where: { sessionId_itemId_batchId: key } });
        if (existing) {
          systemQty = Number(existing.systemQtyBase);
        } else {
          const balance = await tx.stockBalance.findUnique({
            where: { warehouseId_itemId_batchId: { warehouseId: session.warehouseId, itemId: c.itemId, batchId } },
          });
          systemQty = balance ? Number(balance.qtyBase) : 0;
        }

        const counted = roundQty(c.qty ?? 0);
        if (counted < 0) throw new BadRequestException('qty cannot be negative');
        const lastCost = item.lastPurchaseCost != null ? Number(item.lastPurchaseCost) : null;
        const { diffQty, diffValue } = diffOfStocktakeLine({ systemQtyBase: systemQty, countedQtyBase: counted, lastCost });

        if (existing) {
          const changed = existing.countedQtyBase == null || Number(existing.countedQtyBase) !== counted;
          await tx.stocktakeLine.update({
            where: { id: existing.id },
            data: {
              countedQtyBase: counted,
              diffQty,
              diffValue,
              recountCount: { increment: changed ? 1 : 0 },
              counter: c.counter?.trim() || existing.counter,
              countedById: user.id,
            },
          });
        } else {
          await tx.stocktakeLine.create({
            data: {
              ...key,
              systemQtyBase: systemQty,
              countedQtyBase: counted,
              lastCost,
              diffQty,
              diffValue,
              recountCount: 1,
              counter: c.counter?.trim() || null,
              countedById: user.id,
            },
          });
        }
      }
    });

    await this.audits.write({
      userId: user.id,
      action: 'stocktake.counts',
      entity: 'StocktakeSession',
      entityId: id,
      afterJson: {
        countedLines: dto.counts.length,
        counters: [...new Set(dto.counts.map((c) => c.counter?.trim()).filter((c): c is string => !!c))],
      },
    });
    return { id, applied: dto.counts.length };
  }

  async review(id: number, user: AuthUser) {
    return this.transition(id, ['OPEN', 'COUNTING'], 'REVIEW', user);
  }

  async backToCounting(id: number, user: AuthUser) {
    return this.transition(id, ['REVIEW'], 'COUNTING', user);
  }

  /** اعتماد المالك: حركة تسوية تلقائية لكل فرق ثم إغلاق الجلسة. */
  async approve(id: number, user: AuthUser) {
    const session = await this.prisma.stocktakeSession.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!session || (session.companyId != null && session.companyId !== (user.companyId ?? null))) {
      throw new NotFoundException(`Stocktake ${id} not found`);
    }
    if (session.status === 'APPROVED' || session.status === 'CLOSED') {
      throw new BadRequestException(`الجلسة ${session.status.toLowerCase()} بالفعل`);
    }

    const uncounted = session.lines.filter((l) => l.countedQtyBase == null).length;
    if (uncounted > 0) {
      throw new BadRequestException(`أكمل عدّات جميع الأصناف أولاً (${uncounted} بند غير مُعدّ)`);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const line of session.lines) {
        const { diffQty } = diffOfStocktakeLine(toLineCalc(line));
        if (diffQty === 0) continue;
        await tx.stockMovement.create({
          data: {
            type: 'ADJUSTMENT',
            warehouseId: session.warehouseId,
            itemId: line.itemId,
            batchId: line.batchId,
            qtyBase: diffQty,
            cost: line.lastCost != null ? Number(line.lastCost) : null,
            refType: 'stocktake',
            refId: session.id,
            userId: user.id,
            periodId: session.periodId ?? null,
            companyId: session.companyId ?? null,
          },
        });
        const key = { warehouseId: session.warehouseId, itemId: line.itemId, batchId: line.batchId };
        await tx.stockBalance.upsert({
          where: { warehouseId_itemId_batchId: key },
          create: { ...key, qtyBase: diffQty, ...tenantWhere(session.companyId ?? null) },
          update: { qtyBase: { increment: diffQty } },
        });
      }
      await tx.stocktakeSession.update({
        where: { id },
        data: { status: 'APPROVED', approvedById: user.id, approvedAt: new Date(), closedAt: new Date() },
      });
    });

    await this.audits.write({
      userId: user.id,
      action: 'stocktake.approve',
      entity: 'StocktakeSession',
      entityId: id,
      beforeJson: { status: session.status },
      afterJson: { status: 'APPROVED', adjustedLines: session.lines.filter((l) => diffOfStocktakeLine(toLineCalc(l)).diffQty !== 0).length },
    });
    return this.get(id, user.companyId ?? null);
  }

  /** إلغاء جلسة غير مكتملة (بدون تسوية). */
  async abort(id: number, dto: AbortStocktakeDto, user: AuthUser) {
    const session = await this.prisma.stocktakeSession.findUnique({ where: { id }, select: { id: true, status: true, companyId: true } });
    if (!session || (session.companyId != null && session.companyId !== (user.companyId ?? null))) {
      throw new NotFoundException(`Stocktake ${id} not found`);
    }
    if (session.status !== 'OPEN' && session.status !== 'COUNTING' && session.status !== 'REVIEW') {
      throw new BadRequestException('لا يمكن إلغاء جلسة منتهية');
    }
    if (!dto.reason?.trim()) throw new BadRequestException('سبب الإلغاء إلزامي');

    await this.prisma.stocktakeSession.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date(), notes: dto.reason.trim() },
    });
    await this.audits.write({
      userId: user.id,
      action: 'stocktake.abort',
      entity: 'StocktakeSession',
      entityId: id,
      beforeJson: { status: session.status },
      afterJson: { status: 'CLOSED', reason: dto.reason.trim() },
    });
    return this.get(id, user.companyId ?? null);
  }

  /** تجميد المخزن قبل إنشاء مستندات مباشرة (بيانات/توريد). */
  async assertMovable(warehouseId: number, companyId: number | null = null): Promise<void> {
    const mode = await this.prisma.systemSetting.findUnique({ where: { key: 'stocktake.freeze.mode' } });
    if ((mode?.value ?? 'BLOCK') !== 'BLOCK') return;
    const active = await this.prisma.stocktakeSession.findFirst({
      where: { warehouseId, ...tenantWhere(companyId), status: { in: [...ACTIVE_STATUSES] } },
      select: { number: true },
    });
    if (active) throw new BadRequestException(freezeMessage(active.number));
  }

  private async transition(
    id: number,
    from: ('OPEN' | 'COUNTING' | 'REVIEW')[],
    to: 'REVIEW' | 'COUNTING',
    user: AuthUser,
  ) {
    const session = await this.prisma.stocktakeSession.findUnique({ where: { id }, select: { id: true, status: true, companyId: true } });
    if (!session || (session.companyId != null && session.companyId !== (user.companyId ?? null))) {
      throw new NotFoundException(`Stocktake ${id} not found`);
    }
    if (!(from as string[]).includes(session.status)) {
      throw new BadRequestException(`لا يمكن التحويل من الحالة ${session.status}`);
    }
    await this.prisma.stocktakeSession.update({ where: { id }, data: { status: to } });
    await this.audits.write({
      userId: user.id,
      action: 'stocktake.transition',
      entity: 'StocktakeSession',
      entityId: id,
      beforeJson: { status: session.status },
      afterJson: { status: to },
    });
    return { id, status: to };
  }
}