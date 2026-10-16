import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import type { CreateCategoryDto, QueryCategoriesDto, UpdateCategoryDto } from './categories.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto, companyId: number | null = null) {
    const existing = await this.prisma.category.findFirst({ where: { code: dto.code, ...tenantWhere(companyId) } });
    if (existing) throw new ConflictException(`Category code ${dto.code} already exists`);

    const parent = dto.parentCode
      ? await this.prisma.category.findFirst({ where: { code: dto.parentCode, ...tenantWhere(companyId) } })
      : null;
    if (dto.parentCode && !parent) {
      throw new NotFoundException(`Parent category ${dto.parentCode} not found`);
    }

    return this.prisma.category.create({
      data: {
        code: dto.code,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        parentId: parent?.id,
        ...tenantWhere(companyId),
      },
      include: { parent: true },
    });
  }

  async list(query: QueryCategoriesDto, companyId: number | null = null) {
    const where = {
      ...tenantWhere(companyId),
      ...(query.parentCode ? { parent: { code: query.parentCode } } : {}),
      ...(query.q
        ? {
            OR: [
              { code: { contains: query.q, mode: 'insensitive' as const } },
              { nameAr: { contains: query.q, mode: 'insensitive' as const } },
              { nameEn: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include: {
          parent: { select: { id: true, code: true, nameAr: true } },
          _count: { select: { items: true, children: true } },
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.category.count({ where }),
    ]);
    return { categories, total };
  }

  async findOne(id: number, companyId: number | null = null) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, code: true, nameAr: true } },
        children: { select: { id: true, code: true, nameAr: true } },
        _count: { select: { items: true } },
      },
    });
    if (!category || (category.companyId != null && category.companyId !== companyId)) {
      throw new NotFoundException(`Category #${id} not found`);
    }
    return category;
  }

  async update(id: number, dto: UpdateCategoryDto, companyId: number | null = null) {
    await this.findOne(id, companyId);

    const parent = dto.parentCode
      ? await this.prisma.category.findFirst({ where: { code: dto.parentCode, ...tenantWhere(companyId) } })
      : null;
    if (dto.parentCode && !parent) {
      throw new NotFoundException(`Parent category ${dto.parentCode} not found`);
    }
    if (parent && parent.id === id) {
      throw new ConflictException('A category cannot be its own parent');
    }

    return this.prisma.category.update({
      where: { id },
      data: { nameAr: dto.nameAr, nameEn: dto.nameEn, parentId: parent?.id },
      include: { parent: true },
    });
  }

  async remove(id: number, companyId: number | null = null) {
    const [itemCount, childCount] = await this.prisma.$transaction(async (tx) => [
      await tx.item.count({ where: { categoryId: id, ...tenantWhere(companyId) } }),
      await tx.category.count({ where: { parentId: id, ...tenantWhere(companyId) } }),
    ]);
    if (itemCount > 0 || childCount > 0) {
      throw new ConflictException('Category has items or child categories');
    }
    await this.findOne(id, companyId);
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }
}