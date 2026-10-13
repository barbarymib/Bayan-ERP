import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import type { CreateItemDto, QueryItemsDto, UpdateItemDto } from './items.dto.js';

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateItemDto, companyId: number | null = null) {
    const existing = await this.prisma.item.findFirst({ where: { code: dto.code, ...tenantWhere(companyId) } });
    if (existing) throw new ConflictException(`Item code ${dto.code} already exists`);

    const category = await this.prisma.category.findFirst({
      where: { code: dto.categoryCode, ...tenantWhere(companyId) },
    });
    if (!category) throw new NotFoundException(`Category ${dto.categoryCode} not found`);

    const baseUnit = await this.prisma.unit.findUnique({
      where: { code: dto.baseUnitCode },
    });
    if (!baseUnit) throw new NotFoundException(`Unit ${dto.baseUnitCode} not found`);

    const brand = dto.brandCode
      ? await this.prisma.brand.findFirst({ where: { code: dto.brandCode, ...tenantWhere(companyId) } })
      : null;
    if (dto.brandCode && !brand) {
      throw new NotFoundException(`Brand ${dto.brandCode} not found`);
    }

    return this.prisma.item.create({
      data: {
        code: dto.code,
        barcode: dto.barcode,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        categoryId: category.id,
        brandId: brand?.id,
        origin: dto.origin,
        baseUnitId: baseUnit.id,
        trackBatch: dto.trackBatch ?? false,
        minStock: dto.minStock ?? 0,
        minSalePrice: dto.minSalePrice,
        imageUrl: dto.imageUrl,
        parentItemId: dto.parentItemId,
        ...tenantWhere(companyId),
        attributes: dto.attributes?.length
          ? { create: dto.attributes.map((a) => ({ key: a.key, value: a.value })) }
          : undefined,
        itemUnits: dto.itemUnits?.length
          ? {
              create: await Promise.all(
                dto.itemUnits.map(async (u) => {
                  const unit = await this.prisma.unit.findUnique({
                    where: { code: u.unitCode },
                  });
                  if (!unit) {
                    throw new NotFoundException(`Unit ${u.unitCode} not found`);
                  }
                  return {
                    unitId: unit.id,
                    factorToBase: u.factorToBase,
                    isSale: u.isSale ?? true,
                    isPurchase: u.isPurchase ?? true,
                    allowDecimal: u.allowDecimal ?? true,
                    barcode: u.barcode,
                  };
                }),
              ),
            }
          : undefined,
      },
      include: { category: true, baseUnit: true, brand: true, itemUnits: true, attributes: true },
    });
  }

  async list(query: QueryItemsDto, companyId: number | null = null) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where = {
      ...tenantWhere(companyId),
      ...(query.q
        ? {
            OR: [
              { nameAr: { contains: query.q, mode: 'insensitive' as const } },
              { nameEn: { contains: query.q, mode: 'insensitive' as const } },
              { code: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.categoryCode ? { category: { code: query.categoryCode } } : {}),
      ...(typeof query.active === 'boolean' ? { active: query.active } : {}),
      ...(query.parentItemId ? { parentItemId: query.parentItemId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        include: {
          category: true,
          baseUnit: true,
          brand: true,
          attributes: true,
          prices: { include: { priceList: true }, orderBy: { priceListId: 'asc' } },
        },
        orderBy: { nameAr: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.item.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: number, companyId: number | null = null) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: {
        category: true,
        baseUnit: true,
        brand: true,
        attributes: true,
        itemUnits: { include: { unit: true } },
        prices: { include: { priceList: true } },
        variants: { select: { id: true, code: true, nameAr: true, active: true } },
      },
    });
    if (!item || (item.companyId != null && item.companyId !== companyId)) {
      throw new NotFoundException(`Item #${id} not found`);
    }
    return item;
  }

  async update(id: number, dto: UpdateItemDto, companyId: number | null = null) {
    await this.findOne(id, companyId);

    const category = dto.categoryCode
      ? await this.prisma.category.findFirst({ where: { code: dto.categoryCode, ...tenantWhere(companyId) } })
      : null;
    if (dto.categoryCode && !category) {
      throw new NotFoundException(`Category ${dto.categoryCode} not found`);
    }

    const brand = dto.brandCode
      ? await this.prisma.brand.findFirst({ where: { code: dto.brandCode, ...tenantWhere(companyId) } })
      : null;
    if (dto.brandCode && !brand) {
      throw new NotFoundException(`Brand ${dto.brandCode} not found`);
    }

    return this.prisma.item.update({
      where: { id },
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        categoryId: category?.id,
        brandId: brand?.id,
        origin: dto.origin,
        trackBatch: dto.trackBatch,
        minStock: dto.minStock,
        minSalePrice: dto.minSalePrice,
        barcode: dto.barcode,
        imageUrl: dto.imageUrl,
        parentItemId: dto.parentItemId,
        active: dto.active,
      },
      include: { category: true, baseUnit: true, brand: true },
    });
  }

  /** تنويعات صنف أساسي (الألوان/العبوات المرتبطة). */
  async variants(id: number, companyId: number | null = null) {
    await this.findOne(id, companyId);
    return this.prisma.item.findMany({
      where: { parentItemId: id, ...tenantWhere(companyId) },
      include: { baseUnit: true, attributes: true },
      orderBy: { nameAr: 'asc' },
    });
  }

  /** تحويل كمية بين وحدات صنف عبر معاملات الوحدة الأساسية — قبول المرحلة 1. */
  async convert(id: number, fromCode: string, toCode: string, qty: number, companyId: number | null = null) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: {
        baseUnit: true,
        itemUnits: { include: { unit: true } },
      },
    });
    if (!item || (item.companyId != null && item.companyId !== companyId)) {
      throw new NotFoundException(`Item #${id} not found`);
    }

    const table = new Map<string, number>();
    table.set(item.baseUnit.code, 1);
    for (const iu of item.itemUnits) {
      table.set(iu.unit.code, Number(iu.factorToBase));
      if (iu.unit.code === item.baseUnit.code) {
        throw new ConflictException('ItemUnit cannot use the base unit');
      }
    }

    const factorFrom = table.get(fromCode);
    const factorTo = table.get(toCode);
    if (factorFrom === undefined) throw new NotFoundException(`Unit ${fromCode} not defined for item`);
    if (factorTo === undefined) throw new NotFoundException(`Unit ${toCode} not defined for item`);
    if (factorTo <= 0) throw new ConflictException(`Invalid factor for unit ${toCode}`);

    const qtyBase = qty * factorFrom;
    const converted = qtyBase / factorTo;

    return {
      item: { id: item.id, code: item.code, nameAr: item.nameAr },
      baseUnit: item.baseUnit.code,
      from: { code: fromCode, factorToBase: factorFrom },
      to: { code: toCode, factorToBase: factorTo },
      qty,
      qtyBase: Math.round(qtyBase * 1000) / 1000,
      converted: Math.round(converted * 1000) / 1000,
    };
  }
}