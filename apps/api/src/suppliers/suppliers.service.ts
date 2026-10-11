import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import type { CreateSupplierDto, QuerySuppliersDto, UpdateSupplierDto } from './suppliers.dto.js';

const isUniqueError = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSupplierDto, companyId: number | null = null) {
    let code = dto.code;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!code) code = await this.nextCode(companyId, attempt);
      try {
        return await this.prisma.supplier.create({
          data: {
            code,
            nameAr: dto.nameAr,
            phone: dto.phone,
            address: dto.address,
            openingBalance: dto.openingBalance ?? 0,
            ...tenantWhere(companyId),
          },
        });
      } catch (e) {
        if (isUniqueError(e) && !dto.code) {
          code = undefined;
          continue;
        }
        throw e;
      }
    }
    throw new ConflictException('Could not generate a unique supplier code');
  }

  async list(query: QuerySuppliersDto, companyId: number | null = null) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where = {
      ...tenantWhere(companyId),
      ...(query.q
        ? {
            OR: [
              { nameAr: { contains: query.q, mode: 'insensitive' as const } },
              { code: { contains: query.q, mode: 'insensitive' as const } },
              { phone: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.active ? { active: query.active === 'true' } : {}),
    };

    const [suppliers, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        include: { _count: { select: { purchases: true, payments: true } } },
        orderBy: { nameAr: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { suppliers, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: number, companyId: number | null = null) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: { _count: { select: { purchases: true, payments: true } } },
    });
    if (!supplier || (supplier.companyId != null && supplier.companyId !== companyId)) {
      throw new NotFoundException(`Supplier #${id} not found`);
    }
    return supplier;
  }

  async update(id: number, dto: UpdateSupplierDto, companyId: number | null = null) {
    await this.findOne(id, companyId);
    return this.prisma.supplier.update({
      where: { id },
      data: {
        nameAr: dto.nameAr,
        phone: dto.phone,
        address: dto.address,
        openingBalance: dto.openingBalance,
        active: dto.active,
      },
    });
  }

  /** إيقاف مورد (soft delete). */
  async remove(id: number, companyId: number | null = null) {
    await this.findOne(id, companyId);
    await this.prisma.supplier.update({ where: { id }, data: { active: false } });
    return { ok: true };
  }

  private async nextCode(companyId: number | null, retryOffset = 0): Promise<string> {
    const last = await this.prisma.supplier.findFirst({ where: tenantWhere(companyId), orderBy: { id: 'desc' } });
    const nextId = (last?.id ?? 0) + retryOffset + 1;
    return `S${String(nextId).padStart(4, '0')}`;
  }
}