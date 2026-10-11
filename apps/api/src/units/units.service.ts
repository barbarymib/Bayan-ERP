import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import type { CreateUnitDto, QueryUnitsDto, UpdateUnitDto } from './units.dto.js';

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUnitDto) {
    const existing = await this.prisma.unit.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Unit code ${dto.code} already exists`);
    return this.prisma.unit.create({
      data: { code: dto.code, nameAr: dto.nameAr, nameEn: dto.nameEn, measurement: dto.measurement },
    });
  }

  async list(query: QueryUnitsDto) {
    const where = {
      ...(query.measurement ? { measurement: query.measurement } : {}),
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
    const [units, total] = await Promise.all([
      this.prisma.unit.findMany({
        where,
        include: { _count: { select: { itemUnits: true, baseItems: true } } },
        orderBy: { code: 'asc' },
      }),
      this.prisma.unit.count({ where }),
    ]);
    return { units, total };
  }

  async findOne(id: number) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: { _count: { select: { itemUnits: true, baseItems: true } } },
    });
    if (!unit) throw new NotFoundException(`Unit #${id} not found`);
    return unit;
  }

  async update(id: number, dto: UpdateUnitDto) {
    await this.findOne(id);
    return this.prisma.unit.update({
      where: { id },
      data: { nameAr: dto.nameAr, nameEn: dto.nameEn, measurement: dto.measurement },
    });
  }

  async remove(id: number) {
    const usage = await this.prisma.$transaction([
      this.prisma.itemUnit.count({ where: { unitId: id } }),
      this.prisma.item.count({ where: { baseUnitId: id } }),
    ]);
    if (usage[0] > 0 || usage[1] > 0) {
      throw new ConflictException('Unit is in use by items (item_units or as base unit)');
    }
    await this.prisma.unit.delete({ where: { id } });
    return { ok: true };
  }
}