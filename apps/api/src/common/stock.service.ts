import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from './tenant.js';

/** عميل ترانزاكشن من Prisma — يمرر بين الخدمات للحفاظ على الذرية. */
export type Tx = Prisma.TransactionClient;

export interface StockLineInput {
  itemId: number;
  qtyBase: number;
  cost?: number | null;
  batchId?: string;
}

export interface StockOpInput {
  warehouseId: number;
  refType: string;
  refId: number;
  userId?: number | null;
  periodId?: number | null;
  companyId?: number | null;
  lines: StockLineInput[];
}

const ACTIVE_STOCKTAKE = ['OPEN', 'COUNTING', 'REVIEW'] as const;

/** استثناء حجز مستند بعينه من حساب المتاح (مثلاً حجز البيان نفسه عند الاعتماد). */
export interface ReservationExclude {
  refType: string;
  refId: number;
}

function freezeMessage(number: string): string {
  return `المخزن مجمّد — توجد جلسة جرد نشطة (${number}). أنهِ أو ألغِ الجلسة قبل تنفيذ حركات المخزون.`;
}

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  /** صرف من المخزن (بيان بيع) — سالب. */
  async saleOut(tx: Tx, p: StockOpInput): Promise<void> {
    await this.apply(tx, 'SALE_OUT', -1, p);
  }

  /** استلام للمخزن (توريد) — موجب. */
  async purchaseIn(tx: Tx, p: StockOpInput): Promise<void> {
    await this.apply(tx, 'PURCHASE_IN', 1, p);
  }

  /** إدخال مخزني يدوي (رصيد افتتاحي/تسوية) — موجب. */
  async openingIn(tx: Tx, p: StockOpInput): Promise<void> {
    await this.apply(tx, 'OPENING', 1, p);
  }

  /** صرف تحويل مخزني من المخزن المصدر — سالب. */
  async transferOut(tx: Tx, p: StockOpInput): Promise<void> {
    await this.apply(tx, 'TRANSFER_OUT', -1, p);
  }

  /** استلام تحويل مخزني في المخزن الوجهة — موجب. */
  async transferIn(tx: Tx, p: StockOpInput): Promise<void> {
    await this.apply(tx, 'TRANSFER_IN', 1, p);
  }

  /** صرف مرتجع مشتريات من المخزن — سالب. */
  async returnOut(tx: Tx, p: StockOpInput): Promise<void> {
    await this.apply(tx, 'RETURN_OUT', -1, p);
  }

  /** إعادة مرتجع للمخزن — موجب. */
  async returnIn(tx: Tx, warehouses: { warehouseId: number; lines: StockLineInput[] }[], p: Omit<StockOpInput, 'warehouseId' | 'lines'>): Promise<void> {
    for (const group of warehouses) {
      await this.apply(tx, 'RETURN_IN', 1, { ...p, warehouseId: group.warehouseId, lines: group.lines });
    }
  }

  /** تراجع عن حركة (إلغاء بيان) — عكس الإشارة. */
  async restock(tx: Tx, p: StockOpInput): Promise<void> {
    await this.apply(tx, 'ADJUSTMENT', 1, p);
  }

  /** فحص تجميد المخزن قبل إنشاء المستند مباشرة (بيانات/توريد). */
  async assertMovable(warehouseId: number, companyId: number | null = null): Promise<void> {
    const mode = await this.prisma.systemSetting.findUnique({ where: { key: 'stocktake.freeze.mode' } });
    if ((mode?.value ?? 'BLOCK') !== 'BLOCK') return;
    const active = await this.prisma.stocktakeSession.findFirst({
      where: { warehouseId, ...tenantWhere(companyId), status: { in: [...ACTIVE_STOCKTAKE] } },
      select: { number: true },
    });
    if (active) throw new BadRequestException(freezeMessage(active.number));
  }

  /** حجز مؤقت لكميات مسودة بيان. */
  async reserve(
    tx: Tx,
    refType: string,
    refId: number,
    warehouseId: number,
    lines: { itemId: number; qtyBase: number }[],
    companyId: number | null = null,
  ): Promise<void> {
    if (!lines.length) return;
    await tx.stockReservation.createMany({
      data: lines.map((l) => ({
        refType,
        refId,
        warehouseId,
        itemId: l.itemId,
        qtyBase: l.qtyBase,
        status: 'ACTIVE',
        ...tenantWhere(companyId),
      })),
    });
  }

  /** تحرير حجوزات مستند (اعتماد أو إلغاء مسودة). */
  async releaseReservations(tx: Tx, refType: string, refId: number): Promise<void> {
    await tx.stockReservation.updateMany({
      where: { refType, refId, status: 'ACTIVE' },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
  }

  /** الكمية المتاحة = الرصيد − الحجوزات النشطة (يمكن استثناء حجز مستند بعينه). */
  async availableQty(
    warehouseId: number,
    itemId: number,
    batchId = '',
    companyId: number | null = null,
    exclude?: ReservationExclude,
  ): Promise<number> {
    const reservedWhere: Prisma.StockReservationWhereInput = {
      warehouseId,
      itemId,
      batchId,
      status: 'ACTIVE',
      ...tenantWhere(companyId),
    };
    if (exclude) reservedWhere.NOT = { refType: exclude.refType, refId: exclude.refId };
    const [balance, reserved] = await Promise.all([
      this.prisma.stockBalance.findUnique({
        where: { warehouseId_itemId_batchId: { warehouseId, itemId, batchId } },
        select: { qtyBase: true },
      }),
      this.prisma.stockReservation.aggregate({
        where: reservedWhere,
        _sum: { qtyBase: true },
      }),
    ]);
    const b = balance ? Number(balance.qtyBase) : 0;
    const r = reserved._sum.qtyBase ? Number(reserved._sum.qtyBase) : 0;
    return b - r;
  }

  /** فحص وضع البيع مع الرصيد السالب (ALLOW | BLOCK عند تجاوز المتاح باحترام الحجوزات). */
  async assertSalePermitted(
    warehouseId: number,
    required: { itemId: number; qtyBase: number }[],
    companyId: number | null = null,
    exclude?: ReservationExclude,
  ): Promise<void> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'stock.sale.enforce' } });
    if ((setting?.value ?? 'ALLOW') !== 'BLOCK') return;
    for (const line of required) {
      const available = await this.availableQty(warehouseId, line.itemId, '', companyId, exclude);
      if (line.qtyBase > available) {
        throw new BadRequestException(
          `الكمية المطلوبة (${line.qtyBase}) تتجاوز المتاح (${available}).`,
        );
      }
    }
  }

  private async apply(
    tx: Tx,
    type: 'SALE_OUT' | 'PURCHASE_IN' | 'RETURN_IN' | 'RETURN_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT' | 'OPENING',
    sign: 1 | -1,
    p: StockOpInput,
  ): Promise<void> {
    // تجميد المخزن أثناء الجرد (الإعداد: stocktake.freeze.mode = BLOCK)
    if (p.refType !== 'stocktake') {
      const mode = await tx.systemSetting.findUnique({ where: { key: 'stocktake.freeze.mode' } });
      if ((mode?.value ?? 'BLOCK') === 'BLOCK') {
        const active = await tx.stocktakeSession.findFirst({
          where: { warehouseId: p.warehouseId, ...tenantWhere(p.companyId ?? null), status: { in: [...ACTIVE_STOCKTAKE] } },
          select: { number: true },
        });
        if (active) throw new BadRequestException(freezeMessage(active.number));
      }
    }
    for (const line of p.lines) {
      const qty = sign * line.qtyBase;
      const batchId = line.batchId ?? '';
      await tx.stockMovement.create({
        data: {
          type,
          warehouseId: p.warehouseId,
          itemId: line.itemId,
          batchId,
          qtyBase: qty,
          cost: line.cost ?? null,
          refType: p.refType,
          refId: p.refId,
          userId: p.userId ?? null,
          periodId: p.periodId ?? null,
          companyId: p.companyId ?? null,
        },
      });
      await tx.stockBalance.upsert({
        where: { warehouseId_itemId_batchId: { warehouseId: p.warehouseId, itemId: line.itemId, batchId } },
        create: { warehouseId: p.warehouseId, itemId: line.itemId, batchId, qtyBase: qty, companyId: p.companyId ?? null },
        update: { qtyBase: { increment: qty } },
      });
    }
  }
}