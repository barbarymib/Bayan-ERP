import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import type { CreatePriceListDto, QueryPriceListsDto, UpdatePriceListDto } from './price-lists.dto.js';

@Injectable()
export class PriceListsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePriceListDto, companyId: number | null = null) {
    const existing = await this.prisma.priceList.findFirst({ where: { code: dto.code, ...tenantWhere(companyId) } });
    if (existing) throw new ConflictException(`Price list ${dto.code} already exists`);
    return this.prisma.priceList.create({
      data: { code: dto.code, nameAr: dto.nameAr, active: dto.active ?? true, ...tenantWhere(companyId) },
    });
  }

  async list(query: QueryPriceListsDto, companyId: number | null = null) {
    const where = {
      ...tenantWhere(companyId),
      ...(typeof query.active === 'boolean' ? { active: query.active } : {}),
      ...(query.q
        ? {
            OR: [
              { code: { contains: query.q, mode: 'insensitive' as const } },
              { nameAr: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [priceLists, total] = await Promise.all([
      this.prisma.priceList.findMany({
        where,
        include: { _count: { select: { prices: true, customers: true } } },
        orderBy: { code: 'asc' },
      }),
      this.prisma.priceList.count({ where }),
    ]);
    return { priceLists, total };
  }

  async findOne(id: number, companyId: number | null = null) {
    const priceList = await this.prisma.priceList.findUnique({
      where: { id },
      include: {
        _count: { select: { prices: true, customers: true } },
        prices: { select: { id: true, itemId: true, unitId: true, price: true, validFrom: true } },
      },
    });
    if (!priceList || (priceList.companyId != null && priceList.companyId !== companyId)) {
      throw new NotFoundException(`Price list #${id} not found`);
    }
    return priceList;
  }

  async update(id: number, dto: UpdatePriceListDto, companyId: number | null = null) {
    await this.findOne(id, companyId);
    return this.prisma.priceList.update({
      where: { id },
      data: { nameAr: dto.nameAr, active: dto.active },
    });
  }

  async remove(id: number, companyId: number | null = null) {
    const usage = await this.prisma.$transaction([
      this.prisma.itemPrice.count({ where: { priceListId: id, ...tenantWhere(companyId) } }),
      this.prisma.customer.count({ where: { priceListId: id, ...tenantWhere(companyId) } }),
    ]);
    if (usage[0] > 0 || usage[1] > 0) {
      throw new ConflictException('Price list has prices or linked customers');
    }
    await this.findOne(id, companyId);
    await this.prisma.priceList.delete({ where: { id } });
    return { ok: true };
  }
}