import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import type { CreateBrandDto, QueryBrandsDto, UpdateBrandDto } from './brands.dto.js';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBrandDto, companyId: number | null = null) {
    const existing = await this.prisma.brand.findFirst({ where: { code: dto.code, ...tenantWhere(companyId) } });
    if (existing) throw new ConflictException(`Brand code ${dto.code} already exists`);

    return this.prisma.brand.create({
      data: { code: dto.code, nameAr: dto.nameAr, ...tenantWhere(companyId) },
    });
  }

  async list(query: QueryBrandsDto, companyId: number | null = null) {
    const where = {
      ...tenantWhere(companyId),
      ...(query.q
        ? {
            OR: [
              { code: { contains: query.q, mode: 'insensitive' as const } },
              { nameAr: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [brands, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        include: { _count: { select: { items: true } } },
        orderBy: { code: 'asc' },
      }),
      this.prisma.brand.count({ where }),
    ]);
    return { brands, total };
  }

  async findOne(id: number, companyId: number | null = null) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });
    if (!brand || (brand.companyId != null && brand.companyId !== companyId)) {
      throw new NotFoundException(`Brand #${id} not found`);
    }
    return brand;
  }

  async update(id: number, dto: UpdateBrandDto, companyId: number | null = null) {
    await this.findOne(id, companyId);
    return this.prisma.brand.update({ where: { id }, data: { nameAr: dto.nameAr } });
  }

  async remove(id: number, companyId: number | null = null) {
    const used = await this.prisma.item.count({ where: { brandId: id, ...tenantWhere(companyId) } });
    if (used > 0) throw new ConflictException('Brand has items');
    await this.findOne(id, companyId);
    await this.prisma.brand.delete({ where: { id } });
    return { ok: true };
  }
}
