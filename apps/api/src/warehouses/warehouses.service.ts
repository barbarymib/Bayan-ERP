import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import type { CreateWarehouseDto, QueryWarehousesDto, UpdateWarehouseDto } from './warehouses.dto.js';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWarehouseDto, companyId: number | null = null) {
    const existing = await this.prisma.warehouse.findFirst({ where: { code: dto.code, ...tenantWhere(companyId) } });
    if (existing) throw new ConflictException(`Warehouse code ${dto.code} already exists`);

    const keeper = dto.keeperId
      ? await this.prisma.user.findUnique({ where: { id: dto.keeperId } })
      : null;
    if (dto.keeperId && !keeper) throw new NotFoundException(`User #${dto.keeperId} not found`);
    const branchId = await this.resolveBranch(dto.branchId, companyId);

    return this.prisma.warehouse.create({
      data: {
        code: dto.code,
        nameAr: dto.nameAr,
        type: dto.type ?? 'MAIN',
        keeperId: keeper?.id,
        branchId,
        ...tenantWhere(companyId),
      },
      include: { keeper: { select: { id: true, name: true, repCode: true } } },
    });
  }

  async list(query: QueryWarehousesDto, companyId: number | null = null) {
    const where = {
      ...tenantWhere(companyId),
      ...(query.type ? { type: query.type } : {}),
      ...(query.active ? { active: query.active === 'true' } : {}),
    };
    const [warehouses, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where,
        include: {
          keeper: { select: { id: true, name: true, repCode: true } },
          _count: { select: { balances: true, movements: true } },
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.warehouse.count({ where }),
    ]);
    return { warehouses, total };
  }

  async findOne(id: number, companyId: number | null = null) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        keeper: { select: { id: true, name: true, repCode: true } },
        _count: { select: { balances: true, movements: true, stocktakes: true } },
      },
    });
    if (!warehouse || (warehouse.companyId != null && warehouse.companyId !== companyId)) {
      throw new NotFoundException(`Warehouse #${id} not found`);
    }
    return warehouse;
  }

  async update(id: number, dto: UpdateWarehouseDto, companyId: number | null = null) {
    await this.findOne(id, companyId);
    const keeper = dto.keeperId
      ? await this.prisma.user.findUnique({ where: { id: dto.keeperId } })
      : null;
    if (dto.keeperId && !keeper) throw new NotFoundException(`User #${dto.keeperId} not found`);

    const data: Record<string, unknown> = {
      nameAr: dto.nameAr,
      type: dto.type,
      keeperId: keeper?.id,
      active: dto.active,
    };
    if (dto.branchId !== undefined) data.branchId = await this.resolveBranch(dto.branchId, companyId);

    return this.prisma.warehouse.update({
      where: { id },
      data,
      include: { keeper: { select: { id: true, name: true, repCode: true } } },
    });
  }

  /** إيقاف مخزن (soft delete) — متاح فقط إن لم تكن له حركات. */
  async remove(id: number, companyId: number | null = null) {
    const usage = await this.prisma.$transaction([
      this.prisma.stockBalance.count({ where: { warehouseId: id, ...tenantWhere(companyId) } }),
      this.prisma.stockMovement.count({ where: { warehouseId: id, ...tenantWhere(companyId) } }),
    ]);
    if (usage[0] > 0 || usage[1] > 0) {
      throw new ConflictException('Warehouse has stock balances or movements');
    }
    await this.findOne(id, companyId);
    await this.prisma.warehouse.update({ where: { id }, data: { active: false } });
    return { ok: true };
  }

  private async resolveBranch(branchId: number | null | undefined, companyId: number | null) {
    if (branchId == null) return null;
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, ...tenantWhere(companyId) },
    });
    if (!branch) throw new NotFoundException(`Branch #${branchId} not found`);
    return branch.id;
  }
}