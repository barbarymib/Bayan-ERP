import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { tenantWhere } from '../common/tenant.js';
import type { BulkPriceDto, QueryPriceDto, SetPriceDto } from './prices.dto.js';

export interface PriceResult {
  itemCode: string;
  itemName?: string;
  unitCode: string;
  priceListCode: string;
  oldPrice: number | null;
  newPrice: number;
}

const round4 = (n: number): number => Math.round(n * 10000) / 10000;

@Injectable()
export class PricesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditLogsService,
  ) {}

  /** السعر الحالي لصنف + وحدة + قائمة (مع سريان فعال). */
  async resolve(query: QueryPriceDto, companyId: number | null = null) {
    const item = await this.prisma.item.findFirst({ where: { code: query.itemCode, ...tenantWhere(companyId) } });
    if (!item) throw new NotFoundException(`Item ${query.itemCode} not found`);

    const unit = query.unitCode
      ? await this.prisma.unit.findUnique({ where: { code: query.unitCode } })
      : null;
    if (query.unitCode && !unit) throw new NotFoundException(`Unit ${query.unitCode} not found`);
    const unitId = unit?.id ?? item.baseUnitId;

    const priceListCode = query.priceListCode ?? 'RETAIL';
    const priceList = await this.prisma.priceList.findFirst({ where: { code: priceListCode, ...tenantWhere(companyId) } });
    if (!priceList) throw new NotFoundException(`Price list ${priceListCode} not found`);

    const asOf = query.asOf ? new Date(query.asOf) : new Date();
    const price = await this.prisma.itemPrice.findFirst({
      where: {
        ...tenantWhere(companyId),
        itemId: item.id,
        unitId,
        priceListId: priceList.id,
        validFrom: { lte: asOf },
        OR: [{ validTo: null }, { validTo: { gte: asOf } }],
      },
      orderBy: { validFrom: 'desc' },
    });

    return {
      item: { id: item.id, code: item.code, nameAr: item.nameAr },
      unit: unitId === item.baseUnitId ? { code: (await this.prisma.unit.findUnique({ where: { id: unitId } }))!.code } : { code: unit!.code },
      priceList: { id: priceList.id, code: priceList.code, nameAr: priceList.nameAr },
      price: price?.price ?? null,
      validFrom: price?.validFrom ?? null,
      validTo: price?.validTo ?? null,
    };
  }

  /** تعيين سعر واحد (إنشاء/تحديث) مع تسجيل التغيير. */
  async set(dto: SetPriceDto, userId: number, companyId: number | null = null): Promise<PriceResult> {
    const result = await this.applySetItem(dto.itemCode, dto.priceListCode, dto.unitCode, dto.price, userId, {
      validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
      validTo: dto.validTo ? new Date(dto.validTo) : undefined,
    }, companyId);
    if (!result) {
      throw new NotFoundException(`Item ${dto.itemCode} not found`);
    }
    return result;
  }

  /** تسعير يومي جماعي (نسبة / قيمة / set) مع سجل كامل. */
  async bulk(dto: BulkPriceDto, userId: number, companyId: number | null = null) {
    const priceList = await this.prisma.priceList.findFirst({ where: { code: dto.priceListCode, ...tenantWhere(companyId) } });
    if (!priceList) throw new NotFoundException(`Price list ${dto.priceListCode} not found`);

    const validFrom = dto.validFrom ? new Date(dto.validFrom) : undefined;
    const validTo = dto.validTo ? new Date(dto.validTo) : undefined;

    // وضع التسعير المباشر (set)
    if (dto.set?.length) {
      if (
        dto.changeByPercent !== undefined ||
        dto.changeByAmount !== undefined ||
        dto.categoryCode ||
        dto.supplierId ||
        dto.itemCodes
      ) {
        throw new BadRequestException('Use either set or adjustment fields, not both');
      }
      const details: PriceResult[] = [];
      const skipped: { itemCode: string; reason: string }[] = [];
      for (const s of dto.set) {
        const r = await this.applySetItem(s.itemCode, dto.priceListCode, dto.unitCode, s.price, userId, { validFrom, validTo }, companyId);
        if (r) details.push(r);
        else skipped.push({ itemCode: s.itemCode, reason: 'Item not found' });
      }
      return { mode: 'set', applied: details.length, skipped, details };
    }

    // وضع التعديل (percent / amount) فوق سعر حالي
    const mode = dto.changeByPercent !== undefined ? 'percent' : dto.changeByAmount !== undefined ? 'amount' : null;
    if (!mode) {
      throw new BadRequestException('Provide set items, or changeByPercent/changeByAmount');
    }
    if (!dto.categoryCode && !dto.itemCodes?.length && !dto.supplierId) {
      throw new BadRequestException('Adjustment requires categoryCode, supplierId or itemCodes');
    }

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
      if (!supplier || (supplier.companyId != null && supplier.companyId !== companyId)) {
        throw new NotFoundException(`Supplier ${dto.supplierId} not found`);
      }
    }

    const itemWhere = {
      ...tenantWhere(companyId),
      ...(dto.categoryCode ? { category: { code: dto.categoryCode } } : {}),
      ...(dto.itemCodes?.length ? { code: { in: dto.itemCodes } } : {}),
      ...(dto.supplierId
        ? { purchaseLines: { some: { statement: { supplierId: dto.supplierId } } } }
        : {}),
    };
    const items = await this.prisma.item.findMany({
      where: itemWhere,
      include: { baseUnit: true },
      orderBy: { code: 'asc' },
    });

    let unitIdCache: number | null = null;
    if (dto.unitCode) {
      const u = await this.prisma.unit.findUnique({ where: { code: dto.unitCode } });
      if (!u) throw new NotFoundException(`Unit ${dto.unitCode} not found`);
      unitIdCache = u.id;
    }

    const details: PriceResult[] = [];
    const skipped: { itemCode: string; reason: string }[] = [];
    for (const item of items) {
      const unitId = unitIdCache ?? item.baseUnitId;
      const existing = await this.currentPrice(item.id, unitId, priceList.id, companyId);
      const base = existing ? Number(existing.price) : null;
      if (base === null) {
        skipped.push({ itemCode: item.code, reason: 'No current price to adjust' });
        continue;
      }
      const newPrice =
        mode === 'percent'
          ? round4(base * (1 + (dto.changeByPercent ?? 0) / 100))
          : round4(base + (dto.changeByAmount ?? 0));

      const r = await this.setPrice(item.id, unitId, priceList.id, newPrice, base, userId, { validFrom, validTo }, companyId);
      details.push(r);
    }

    return { mode, applied: details.length, skipped, details };
  }

  async history(itemCode: string, priceListCode: string | undefined, limit: number, companyId: number | null = null) {
    const item = await this.prisma.item.findFirst({ where: { code: itemCode, ...tenantWhere(companyId) } });
    if (!item) throw new NotFoundException(`Item ${itemCode} not found`);
    const where = {
      ...tenantWhere(companyId),
      itemId: item.id,
      ...(priceListCode ? { priceList: { code: priceListCode } } : {}),
    };
    const rows = await this.prisma.priceHistory.findMany({
      where,
      include: {
        changedBy: { select: { id: true, name: true } },
        unit: { select: { code: true, nameAr: true } },
        priceList: { select: { code: true, nameAr: true } },
      },
      orderBy: { changedAt: 'desc' },
      take: Math.min(limit, 100),
    });
    return { item: { id: item.id, code: item.code, nameAr: item.nameAr }, history: rows };
  }

  private async applySetItem(
    itemCode: string,
    priceListCode: string,
    unitCode: string | undefined,
    price: number,
    userId: number,
    validity: { validFrom?: Date; validTo?: Date },
    companyId: number | null = null,
  ): Promise<PriceResult | null> {
    const item = await this.prisma.item.findFirst({ where: { code: itemCode, ...tenantWhere(companyId) } });
    if (!item) return null;

    const priceList = await this.prisma.priceList.findFirst({ where: { code: priceListCode, ...tenantWhere(companyId) } });
    if (!priceList) throw new NotFoundException(`Price list ${priceListCode} not found`);

    const unit = unitCode ? await this.prisma.unit.findUnique({ where: { code: unitCode } }) : null;
    if (unitCode && !unit) throw new NotFoundException(`Unit ${unitCode} not found`);
    const unitId = unit?.id ?? item.baseUnitId;

    const existing = await this.currentPrice(item.id, unitId, priceList.id, companyId);
    const oldPrice = existing ? Number(existing.price) : null;
    const newPrice = round4(price);

    const r = await this.setPrice(item.id, unitId, priceList.id, newPrice, oldPrice, userId, validity, companyId);
    return r;
  }

  /** السعر السارٍ فعلياً الآن (نافذة صلاحية تغطي لحظة الحالية) لثلاثي فريد. */
  private async currentPrice(itemId: number, unitId: number, priceListId: number, companyId: number | null) {
    const now = new Date();
    return this.prisma.itemPrice.findFirst({
      where: {
        ...tenantWhere(companyId),
        itemId,
        unitId,
        priceListId,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
      },
      orderBy: { validFrom: 'desc' },
    });
  }

  /**
   * يعرّف سعراً داخل نافذة صلاحية (§5.3 التسعير المجدول).
   *
   * بدل أن يُعيد upsert السطر الحالي إلى السعر الجديد، يُغلق النوافذ
   * السابقة التي ما زالت مغطّية وقت البدء ثم يُنشئ سطراً جديداً — بهذا
   * يستطيع سعرٌ مجدول بـ `validFrom` مستقبلي أن يتعاون مع السعر الفعلي
   * دون إزالته.
   */
  private async setPrice(
    itemId: number,
    unitId: number,
    priceListId: number,
    newPrice: number,
    oldPrice: number | null,
    userId: number,
    validity: { validFrom?: Date; validTo?: Date },
    companyId: number | null = null,
  ): Promise<PriceResult> {
    const itemCode = (await this.prisma.item.findUnique({
      where: { id: itemId },
      select: { code: true, nameAr: true },
    }))!;
    const unitCode = (await this.prisma.unit.findUnique({ where: { id: unitId } }))!.code;
    const priceListCode = (await this.prisma.priceList.findUnique({ where: { id: priceListId } }))!.code;

    const validFrom = validity.validFrom ?? new Date();
    const validTo = validity.validTo ?? null;
    const scope = { ...tenantWhere(companyId), itemId, unitId, priceListId };

    await this.prisma.$transaction(async (tx) => {
      // كل نافذة سابقة كانت مفتوحة عبر وقت البدء الجديد تنتهي عنده
      await tx.itemPrice.updateMany({
        where: {
          ...scope,
          validFrom: { lt: validFrom },
          OR: [{ validTo: null }, { validTo: { gte: validFrom } }],
        },
        data: { validTo: validFrom },
      });

      // سطر يبدأ تماماً عند نفس اللحظة يُحدَّث بدل تكراره
      const sameStart = await tx.itemPrice.findFirst({
        where: { ...scope, validFrom },
        orderBy: { id: 'desc' },
      });
      if (sameStart) {
        await tx.itemPrice.update({ where: { id: sameStart.id }, data: { price: newPrice, validTo } });
      } else {
        await tx.itemPrice.create({
          data: { companyId, itemId, unitId, priceListId, price: newPrice, validFrom, validTo },
        });
      }
    });

    await this.prisma.priceHistory.create({
      data: {
        itemId,
        unitId,
        priceListId,
        oldPrice,
        newPrice,
        changedById: userId,
        companyId,
      },
    });

    await this.audits.write({
      userId,
      action: 'price.change',
      entity: 'ItemPrice',
      entityId: itemId,
      beforeJson: { priceListId, unitId, price: oldPrice },
      afterJson: { priceListId, unitId, price: newPrice },
    });

    return {
      itemCode: itemCode.code,
      itemName: itemCode.nameAr,
      unitCode,
      priceListCode,
      oldPrice,
      newPrice,
    };
  }
}