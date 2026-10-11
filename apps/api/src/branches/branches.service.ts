import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import type {
  CreateBranchDto,
  QueryBranchesDto,
  UpdateBranchDto,
} from './branches.dto.js';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBranchDto, companyId: number | null = null) {
    const existing = await this.prisma.branch.findFirst({ where: { code: dto.code, ...tenantWhere(companyId) } });
    if (existing) throw new ConflictException(`Branch code ${dto.code} already exists`);

    return this.prisma.branch.create({
      data: {
        code: dto.code,
        nameAr: dto.nameAr,
        address: dto.address,
        phone: dto.phone,
        active: dto.active ?? true,
        ...tenantWhere(companyId),
      },
    });
  }

  async list(query: QueryBranchesDto, companyId: number | null = null) {
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
    const [branches, total] = await Promise.all([
      this.prisma.branch.findMany({
        where,
        include: { _count: { select: { users: true, warehouses: true } } },
        orderBy: { code: 'asc' },
      }),
      this.prisma.branch.count({ where }),
    ]);
    return { branches, total };
  }

  async findOne(id: number, companyId: number | null = null) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, warehouses: true } },
        users: { select: { id: true, name: true, role: { select: { code: true } } } },
        warehouses: { select: { id: true, code: true, nameAr: true } },
      },
    });
    if (!branch || (branch.companyId != null && branch.companyId !== companyId)) {
      throw new NotFoundException(`Branch #${id} not found`);
    }
    return branch;
  }

  async update(id: number, dto: UpdateBranchDto, companyId: number | null = null) {
    await this.findOne(id, companyId);
    if (dto.code) {
      const clash = await this.prisma.branch.findFirst({ where: { code: dto.code, ...tenantWhere(companyId) } });
      if (clash && clash.id !== id) {
        throw new ConflictException(`Branch code ${dto.code} already exists`);
      }
    }
    return this.prisma.branch.update({ where: { id }, data: { ...dto } });
  }

  async remove(id: number, companyId: number | null = null) {
    const usage = await this.prisma.$transaction([
      this.prisma.user.count({ where: { branchId: id, ...tenantWhere(companyId) } }),
      this.prisma.warehouse.count({ where: { branchId: id, ...tenantWhere(companyId) } }),
    ]);
    if (usage[0] > 0 || usage[1] > 0) {
      throw new ConflictException('Branch has users or warehouses');
    }
    await this.findOne(id, companyId);
    await this.prisma.branch.delete({ where: { id } });
    return { ok: true };
  }
}