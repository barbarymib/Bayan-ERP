import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../common/object-storage.js';
import type { CreateItemDto, QueryItemsDto, UpdateItemDto } from './items.dto.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};
const DATA_URL_RE = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/]+=*)$/;

export type ItemImageSource =
  | { kind: 'redirect'; url: string }
  | { kind: 'buffer'; mime: string; buffer: Buffer };

@Injectable()
export class ItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditLogsService,
    @Optional()
    @Inject(OBJECT_STORAGE)
    private readonly storage?: ObjectStorage,
  ) {}

  /** يحوّل صفوف الوحدات (بأكواد الوحدات) إلى صفوف قابلة للكتابة بـ unitId. */
  private async resolveUnitRows(rows?: UpdateItemDto['itemUnits']) {
    if (!rows?.length) return undefined;
    return Promise.all(
      rows.map(async (u) => {
        const unit = await this.prisma.unit.findUnique({ where: { code: u.unitCode } });
        if (!unit) throw new NotFoundException(`Unit ${u.unitCode} not found`);
        return {
          unitId: unit.id,
          factorToBase: u.factorToBase,
          isSale: u.isSale ?? true,
          isPurchase: u.isPurchase ?? true,
          allowDecimal: u.allowDecimal ?? true,
          barcode: u.barcode,
        };
      }),
    );
  }

  async create(dto: CreateItemDto, companyId: number | null = null, userId?: number) {
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

    if (dto.brandCode && !brand) {
      throw new NotFoundException(`Brand ${dto.brandCode} not found`);
    }

    const unitRows = await this.resolveUnitRows(dto.itemUnits);

    const created = await this.prisma.item.create({
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
        itemUnits: unitRows ? { create: unitRows } : undefined,
      },
      include: { category: true, baseUnit: true, brand: true, itemUnits: { include: { unit: true } }, attributes: true },
    });

    await this.audits.write({
      userId,
      action: 'item.create',
      entity: 'Item',
      entityId: created.id,
      afterJson: { code: created.code, nameAr: created.nameAr, baseUnitId: baseUnit.id, categoryId: category.id },
    });
    return created;
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
          itemUnits: { include: { unit: true } },
          prices: { include: { priceList: true }, orderBy: { priceListId: 'asc' } },
          parent: { select: { id: true, code: true, nameAr: true } },
          images: { orderBy: { sortOrder: 'asc' as const } },
          _count: { select: { variants: true } },
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
        images: { orderBy: { sortOrder: 'asc' as const } },
        variants: { select: { id: true, code: true, nameAr: true, active: true } },
      },
    });
    if (!item || (item.companyId != null && item.companyId !== companyId)) {
      throw new NotFoundException(`Item #${id} not found`);
    }
    return item;
  }

  async update(id: number, dto: UpdateItemDto, companyId: number | null = null, userId?: number) {
    const before = await this.findOne(id, companyId);

    if (dto.parentItemId === id) {
      throw new ConflictException('Item cannot be its own parent variant');
    }

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

    const unitRows = dto.itemUnits ? ((await this.resolveUnitRows(dto.itemUnits)) ?? []) : undefined;
    const attrRows = dto.attributes?.map((a) => ({ key: a.key, value: a.value }));

    const updated = await this.prisma.item.update({
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
        itemUnits: unitRows ? { deleteMany: {}, create: unitRows } : undefined,
        attributes: attrRows ? { deleteMany: {}, create: attrRows } : undefined,
      },
      include: { category: true, baseUnit: true, brand: true, itemUnits: { include: { unit: true } }, attributes: true },
    });

    await this.audits.write({
      userId,
      action: 'item.update',
      entity: 'Item',
      entityId: id,
      beforeJson: { nameAr: before.nameAr, nameEn: before.nameEn, active: before.active, categoryId: before.categoryId },
      afterJson: { nameAr: updated.nameAr, nameEn: updated.nameEn, active: updated.active, categoryId: updated.categoryId },
    });
    return updated;
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

  /** يرفع صورة الصنف (§5.1) ويحفظها في ObjectStorage تحت items/{companyId}/{id}/… */
  async uploadImage(id: number, dataUrl: string, companyId: number | null = null, userId?: number) {
    const item = await this.findOne(id, companyId);
    if (!this.storage) {
      throw new ConflictException('Object storage is not configured');
    }
    const match = DATA_URL_RE.exec(dataUrl);
    if (!match) {
      throw new UnsupportedMediaTypeException('dataUrl must be a base64 image data URL (png/jpeg/webp/gif)');
    }
    const mime = match[1] ?? '';
    const buffer = Buffer.from(match[2] ?? '', 'base64');
    if (buffer.length === 0) throw new UnsupportedMediaTypeException('Image is empty');
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new PayloadTooLargeException(`Image exceeds ${MAX_IMAGE_BYTES} bytes`);
    }
    const ext = (mime.split('/')[1] ?? 'png').replace('jpeg', 'jpg');
    const relPath = `items/${companyId ?? 'global'}/${id}/${Date.now()}.${ext}`;
    const storageId = await this.storage.save(relPath, buffer);
    try {
      const updated = await this.prisma.item.update({
        where: { id },
        data: { imageUrl: storageId },
        include: {
          category: true,
          baseUnit: true,
          brand: true,
          attributes: true,
          itemUnits: { include: { unit: true } },
        },
      });
      await this.audits.write({
        userId,
        action: 'item.image',
        entity: 'Item',
        entityId: id,
        beforeJson: { imageUrl: item.imageUrl },
        afterJson: { imageUrl: storageId },
      });
      return updated;
    } catch (err) {
      await this.storage.remove(storageId).catch(() => undefined);
      throw err;
    }
  }

  /** يزيل صورة الصنف (حذف أفضل الجهد من التخزين + تفريغ imageUrl). */
  async clearImage(id: number, companyId: number | null = null, userId?: number) {
    const item = await this.findOne(id, companyId);
    const previous = item.imageUrl;
    const updated = await this.prisma.item.update({
      where: { id },
      data: { imageUrl: null },
      include: {
        category: true,
        baseUnit: true,
        brand: true,
        attributes: true,
        itemUnits: { include: { unit: true } },
      },
    });
    if (previous && this.storage && !previous.startsWith('data:') && !/^https?:\/\//.test(previous)) {
      await this.storage.remove(previous).catch(() => undefined);
    }
    await this.audits.write({
      userId,
      action: 'item.image',
      entity: 'Item',
      entityId: id,
      beforeJson: { imageUrl: previous },
      afterJson: { imageUrl: null },
    });
    return updated;
  }

  /** مصدر صورة الصنف: data URL→تمرير، http(s)→تحويل، وإلا كائن مخزّن→تحميل. */
  async getImageSource(id: number, companyId: number | null = null): Promise<ItemImageSource> {
    const item = await this.findOne(id, companyId);
    const url = item.imageUrl;
    if (!url) throw new NotFoundException(`Item #${id} has no image`);
    if (url.startsWith('data:')) {
      const match = /^data:([^;,]+);base64,(.*)$/s.exec(url);
      if (!match) throw new NotFoundException(`Item #${id} image data URL is malformed`);
      return { kind: 'buffer', mime: match[1] ?? 'application/octet-stream', buffer: Buffer.from(match[2] ?? '', 'base64') };
    }
    if (/^https?:\/\//.test(url)) return { kind: 'redirect', url };
    if (!this.storage) throw new NotFoundException('Object storage is not configured');
    const buffer = await this.storage.load(url);
    const ext = url.split('.').pop()?.toLowerCase() ?? '';
    return { kind: 'buffer', mime: IMAGE_MIME[ext] ?? 'application/octet-stream', buffer };
  }

  /** يرفع صورة إلى معرض الصنف (§5.1 «صور للصنف» · R4-C2) في التخزين مع ترتيب صاعد. */
  async uploadGalleryImage(id: number, dataUrl: string, companyId: number | null = null, userId?: number) {
    await this.findOne(id, companyId);
    if (!this.storage) {
      throw new ConflictException('Object storage is not configured');
    }
    const match = DATA_URL_RE.exec(dataUrl);
    if (!match) {
      throw new UnsupportedMediaTypeException('dataUrl must be a base64 image data URL (png/jpeg/webp/gif)');
    }
    const mime = match[1] ?? '';
    const buffer = Buffer.from(match[2] ?? '', 'base64');
    if (buffer.length === 0) throw new UnsupportedMediaTypeException('Image is empty');
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new PayloadTooLargeException(`Image exceeds ${MAX_IMAGE_BYTES} bytes`);
    }
    const ext = (mime.split('/')[1] ?? 'png').replace('jpeg', 'jpg');
    const relPath = `items/${companyId ?? 'global'}/${id}/${Date.now()}.${ext}`;
    const storageId = await this.storage.save(relPath, buffer);
    let created: { id: number; sortOrder: number };
    try {
      const sortOrder = await this.prisma.itemImage.count({ where: { itemId: id } });
      created = await this.prisma.itemImage.create({ data: { itemId: id, url: storageId, sortOrder } });
    } catch (err) {
      await this.storage.remove(storageId).catch(() => undefined);
      throw err;
    }
    await this.audits.write({
      userId,
      action: 'item.gallery.add',
      entity: 'ItemImage',
      entityId: created.id,
      afterJson: { itemId: id, url: storageId, sortOrder: created.sortOrder ?? 0 },
    });
    return this.findOne(id, companyId);
  }

  /** يزيل صورة من المعرض (حذف أفضل الجهد للملف من التخزين). */
  async removeGalleryImage(id: number, imageId: number, companyId: number | null = null, userId?: number) {
    await this.findOne(id, companyId);
    const row = await this.prisma.itemImage.findUnique({ where: { id: imageId } });
    if (!row || row.itemId !== id) throw new NotFoundException(`Item #${id} image #${imageId} not found`);
    await this.prisma.itemImage.delete({ where: { id: imageId } });
    if (this.storage && !row.url.startsWith('data:') && !/^https?:\/\//.test(row.url)) {
      await this.storage.remove(row.url).catch(() => undefined);
    }
    await this.audits.write({
      userId,
      action: 'item.gallery.remove',
      entity: 'ItemImage',
      entityId: imageId,
      beforeJson: { itemId: id, url: row.url },
    });
    return this.findOne(id, companyId);
  }

  /** يعيّن صورة معرض كصورة رئيسية (تبديل imageUrl مع صف المعرض؛ بلا غلاف سابق يُحذف الصف). */
  async setCoverFromGallery(id: number, imageId: number, companyId: number | null = null, userId?: number) {
    const item = await this.findOne(id, companyId);
    const row = await this.prisma.itemImage.findUnique({ where: { id: imageId } });
    if (!row || row.itemId !== id) throw new NotFoundException(`Item #${id} image #${imageId} not found`);
    const previousCover = item.imageUrl;
    await this.prisma.item.update({
      where: { id },
      data: { imageUrl: row.url },
      include: { category: true, baseUnit: true, brand: true, itemUnits: { include: { unit: true } }, attributes: true },
    });
    if (previousCover) {
      await this.prisma.itemImage.update({ where: { id: imageId }, data: { url: previousCover } });
    } else {
      await this.prisma.itemImage.delete({ where: { id: imageId } });
    }
    await this.audits.write({
      userId,
      action: 'item.gallery.cover',
      entity: 'Item',
      entityId: id,
      beforeJson: { imageUrl: previousCover },
      afterJson: { imageUrl: row.url },
    });
    return this.findOne(id, companyId);
  }

  /** مصدر صورة معرض (§5.1): data URL→تمرير، http(s)→تحويل، وإلا كائن مخزّن→تحميل. */
  async getGalleryImageSource(id: number, imageId: number, companyId: number | null = null): Promise<ItemImageSource> {
    await this.findOne(id, companyId);
    const row = await this.prisma.itemImage.findUnique({ where: { id: imageId } });
    if (!row || row.itemId !== id) throw new NotFoundException(`Item #${id} image #${imageId} not found`);
    const url = row.url;
    if (url.startsWith('data:')) {
      const match = /^data:([^;,]+);base64,(.*)$/s.exec(url);
      if (!match) throw new NotFoundException(`Item #${id} image #${imageId} data URL is malformed`);
      return { kind: 'buffer', mime: match[1] ?? 'application/octet-stream', buffer: Buffer.from(match[2] ?? '', 'base64') };
    }
    if (/^https?:\/\//.test(url)) return { kind: 'redirect', url };
    if (!this.storage) throw new NotFoundException('Object storage is not configured');
    const buffer = await this.storage.load(url);
    const ext = url.split('.').pop()?.toLowerCase() ?? '';
    return { kind: 'buffer', mime: IMAGE_MIME[ext] ?? 'application/octet-stream', buffer };
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