import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import type {
  CreateCustomerGroupDto,
  CreateSpecialPriceDto,
  QueryCustomerGroupsDto,
  QuerySpecialPricesDto,
  UpdateCustomerGroupDto,
  UpdateSpecialPriceDto,
} from './special-prices.dto.js';

@Injectable()
export class SpecialPricesService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== مجموعات العملاء ====================

  async createGroup(dto: CreateCustomerGroupDto, companyId: number | null = null) {
    const existing = await this.prisma.customerGroup.findFirst({ where: { code: dto.code, ...tenantWhere(companyId) } });
    if (existing) throw new ConflictException(`Customer group ${dto.code} already exists`);
    return this.prisma.customerGroup.create({
      data: { code: dto.code, nameAr: dto.nameAr, active: dto.active ?? true, companyId },
    });
  }

  async listGroups(query: QueryCustomerGroupsDto, companyId: number | null = null) {
    const where = {
      ...tenantWhere(companyId),
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(query.q
        ? {
            OR: [
              { code: { contains: query.q, mode: 'insensitive' as const } },
              { nameAr: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [groups, total] = await Promise.all([
      this.prisma.customerGroup.findMany({
        where,
        include: { _count: { select: { customers: true, specialPrices: true } } },
        orderBy: { code: 'asc' },
      }),
      this.prisma.customerGroup.count({ where }),
    ]);
    return { groups, total };
  }

  async updateGroup(id: number, dto: UpdateCustomerGroupDto, companyId: number | null = null) {
    const group = await this.prisma.customerGroup.findUnique({ where: { id } });
    if (!group || (group.companyId != null && group.companyId !== companyId)) {
      throw new NotFoundException(`Customer group #${id} not found`);
    }
    if (dto.code && dto.code !== group.code) {
      const clash = await this.prisma.customerGroup.findFirst({ where: { code: dto.code, ...tenantWhere(companyId) } });
      if (clash) throw new ConflictException(`Customer group ${dto.code} already exists`);
    }
    return this.prisma.customerGroup.update({ where: { id }, data: { ...dto } });
  }

  async removeGroup(id: number, companyId: number | null = null) {
    const group = await this.prisma.customerGroup.findUnique({ where: { id } });
    if (!group || (group.companyId != null && group.companyId !== companyId)) {
      throw new NotFoundException(`Customer group #${id} not found`);
    }
    const [customerCount, specialPriceCount] = await this.prisma.$transaction(async (tx) => [
      await tx.customer.count({ where: { customerGroupId: id, ...tenantWhere(companyId) } }),
      await tx.specialPrice.count({ where: { customerGroupId: id, ...tenantWhere(companyId) } }),
    ]);
    if (customerCount > 0 || specialPriceCount > 0) {
      throw new ConflictException('Customer group has customers or special prices');
    }
    await this.prisma.customerGroup.delete({ where: { id } });
    return { ok: true };
  }

  // ==================== الأسعار الخاصة (§5.16) ====================

  async createSpecial(dto: CreateSpecialPriceDto, companyId: number | null = null) {
    await this.assertSingleScope(dto);

    const item = await this.prisma.item.findFirst({ where: { code: dto.itemCode, ...tenantWhere(companyId) } });
    if (!item) throw new NotFoundException(`Item ${dto.itemCode} not found`);

    const unitId = await this.resolveUnitId(item.id, item.baseUnitId, dto.unitCode);
    const scope = await this.resolveScope(dto, companyId);

    const clash = await this.prisma.specialPrice.findFirst({
      where: {
        ...tenantWhere(companyId),
        itemId: item.id,
        unitId,
        priceListId: scope.priceListId,
        customerId: scope.customerId,
        customerGroupId: scope.customerGroupId,
      },
    });
    if (clash) {
      throw new ConflictException(
        `A special price for this item/unit/scope already exists (id ${clash.id})`,
      );
    }

    return this.prisma.specialPrice.create({
      data: {
        itemId: item.id,
        unitId,
        priceListId: scope.priceListId,
        customerId: scope.customerId,
        customerGroupId: scope.customerGroupId,
        price: dto.price,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : new Date(),
        validTo: dto.validTo ? new Date(dto.validTo) : null,
        active: dto.active ?? true,
        companyId,
      },
      include: { item: { select: { code: true, nameAr: true } }, unit: { select: { code: true } } },
    });
  }

  async listSpecial(query: QuerySpecialPricesDto, companyId: number | null = null) {
    const now = new Date();
    const state = query.state ?? 'ACTIVE';
    const where = {
      ...tenantWhere(companyId),
      ...(query.itemCode ? { item: { code: query.itemCode } } : {}),
      ...(query.customerCode ? { customer: { code: query.customerCode } } : {}),
      ...(query.customerGroupCode ? { customerGroup: { code: query.customerGroupCode } } : {}),
      ...(state === 'ACTIVE'
        ? { active: true, validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gte: now } }] }
        : state === 'INACTIVE'
          ? { OR: [{ active: false }, { validTo: { lt: now } }] }
          : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.specialPrice.findMany({
        where,
        include: {
          item: { select: { id: true, code: true, nameAr: true } },
          unit: { select: { code: true } },
          customer: { select: { id: true, code: true, nameAr: true } },
          customerGroup: { select: { id: true, code: true, nameAr: true } },
          priceList: { select: { id: true, code: true, nameAr: true } },
        },
        orderBy: { validFrom: 'desc' },
        take: 100,
      }),
      this.prisma.specialPrice.count({ where }),
    ]);
    return { items: rows, total };
  }

  async updateSpecial(id: number, dto: UpdateSpecialPriceDto, companyId: number | null = null) {
    const existing = await this.prisma.specialPrice.findUnique({ where: { id } });
    if (!existing || (existing.companyId != null && existing.companyId !== companyId)) {
      throw new NotFoundException(`Special price #${id} not found`);
    }

    return this.prisma.specialPrice.update({
      where: { id },
      data: {
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.validFrom !== undefined ? { validFrom: new Date(dto.validFrom) } : {}),
        ...(dto.validTo !== undefined ? { validTo: dto.validTo ? new Date(dto.validTo) : null } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      include: { item: { select: { code: true, nameAr: true } }, unit: { select: { code: true } } },
    });
  }

  async removeSpecial(id: number, companyId: number | null = null) {
    const existing = await this.prisma.specialPrice.findUnique({ where: { id } });
    if (!existing || (existing.companyId != null && existing.companyId !== companyId)) {
      throw new NotFoundException(`Special price #${id} not found`);
    }
    await this.prisma.specialPrice.delete({ where: { id } });
    return { ok: true };
  }

  // ==================== helpers ====================

  /** السعر الخاص يُوجَّه لعميل أو مجموعة أو قائمة أسعار — ولا يجتمع أكثر من هدف. */
  private async assertSingleScope(dto: CreateSpecialPriceDto) {
    const provided = [dto.customerCode, dto.customerGroupCode, dto.priceListCode].filter(
      Boolean,
    ).length;
    if (provided > 1) {
      throw new BadRequestException(
        'A special price must target a customer, a customer group, or a price list — not more than one',
      );
    }
  }

  private async resolveUnitId(itemId: number, baseUnitId: number, unitCode?: string) {
    if (!unitCode) return baseUnitId;
    const unit = await this.prisma.unit.findUnique({ where: { code: unitCode } });
    if (!unit) throw new NotFoundException(`Unit ${unitCode} not found`);
    if (unit.id === baseUnitId) return unit.id;
    const iu = await this.prisma.itemUnit.findUnique({
      where: { itemId_unitId: { itemId, unitId: unit.id } },
    });
    if (!iu) throw new BadRequestException(`Unit ${unitCode} is not linked to this item`);
    return unit.id;
  }

  private async resolveScope(dto: CreateSpecialPriceDto, companyId: number | null = null) {
    let priceListId: number | null = null;
    let customerId: number | null = null;
    let customerGroupId: number | null = null;

    if (dto.priceListCode) {
      const pl = await this.prisma.priceList.findFirst({ where: { code: dto.priceListCode, ...tenantWhere(companyId) } });
      if (!pl) throw new NotFoundException(`Price list ${dto.priceListCode} not found`);
      priceListId = pl.id;
    }
    if (dto.customerCode) {
      const customer = await this.prisma.customer.findFirst({ where: { code: dto.customerCode, ...tenantWhere(companyId) } });
      if (!customer) throw new NotFoundException(`Customer ${dto.customerCode} not found`);
      customerId = customer.id;
    }
    if (dto.customerGroupCode) {
      const group = await this.prisma.customerGroup.findFirst({
        where: { code: dto.customerGroupCode, ...tenantWhere(companyId) },
      });
      if (!group) throw new NotFoundException(`Customer group ${dto.customerGroupCode} not found`);
      customerGroupId = group.id;
    }
    return { priceListId, customerId, customerGroupId };
  }
}
