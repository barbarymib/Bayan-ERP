import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import type { CreateBatchDto, QueryBatchesDto, UpdateBatchDto } from './batches.dto.js';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class BatchesService {
  constructor(private readonly prisma: PrismaService) {}

  /** قائمة الدفعات (اختياري: صنف/كود/الدفعات القريبة من الانتهاء). §5.1 */
  async list(query: QueryBatchesDto, companyId: number | null = null) {
    const where: Prisma.BatchWhereInput = {
      ...tenantWhere(companyId),
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(query.code ? { code: { contains: query.code, mode: 'insensitive' as const } } : {}),
      ...(query.includeInactive ? {} : { active: true }),
    };
    if (query.expiringBefore) {
      const deadline = new Date(query.expiringBefore);
      where.expiry = query.includeExpired
        ? { lte: deadline }
        : { gte: startOfToday(), lte: deadline };
    } else if (!query.includeExpired) {
      // افتراضياً لا نُظهر الدفعات المنتهية فعلاً إلا بطلب صريح
      where.OR = [{ expiry: null }, { expiry: { gte: startOfToday() } }];
    }

    const rows = await this.prisma.batch.findMany({
      where,
      include: { item: { select: { id: true, code: true, nameAr: true, trackBatch: true } } },
      orderBy: [{ expiry: 'asc' }, { code: 'asc' }],
    });
    return { batches: rows, total: rows.length };
  }

  async findOne(id: number, companyId: number | null = null) {
    const batch = await this.prisma.batch.findUnique({
      where: { id },
      include: { item: { select: { id: true, code: true, nameAr: true, trackBatch: true } } },
    });
    if (!batch || (batch.companyId != null && batch.companyId !== companyId)) {
      throw new NotFoundException(`Batch #${id} not found`);
    }
    return batch;
  }

  /** إنشاء/تحديث دفعة (المفتاح: الشركة + الصنف + الكود). */
  async create(dto: CreateBatchDto, companyId: number | null = null) {
    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, ...tenantWhere(companyId) },
      select: { id: true, trackBatch: true },
    });
    if (!item) throw new NotFoundException(`Item ${dto.itemId} not found`);
    if (!item.trackBatch) {
      throw new BadRequestException('الصنف لا يتتبع الدفعات — فعّل تتبع الدفعات أولاً.');
    }

    const data = this.buildDates(dto);
    const existing = await this.prisma.batch.findFirst({
      where: { itemId: item.id, code: dto.code, ...tenantWhere(companyId) },
    });
    if (existing) {
      return this.prisma.batch.update({
        where: { id: existing.id },
        data,
        include: { item: { select: { id: true, code: true, nameAr: true, trackBatch: true } } },
      });
    }
    return this.prisma.batch.create({
      data: { itemId: item.id, code: dto.code, ...tenantWhere(companyId), ...data },
      include: { item: { select: { id: true, code: true, nameAr: true, trackBatch: true } } },
    });
  }

  async update(id: number, dto: UpdateBatchDto, companyId: number | null = null) {
    await this.findOne(id, companyId);
    return this.prisma.batch.update({
      where: { id },
      data: {
        ...(dto.productionDate !== undefined
          ? { productionDate: dto.productionDate ? new Date(dto.productionDate) : null }
          : {}),
        ...(dto.expiry !== undefined ? { expiry: dto.expiry ? new Date(dto.expiry) : null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      include: { item: { select: { id: true, code: true, nameAr: true, trackBatch: true } } },
    });
  }

  async remove(id: number, companyId: number | null = null) {
    const batch = await this.findOne(id, companyId);
    const [balances, movements] = await this.prisma.$transaction(async (tx) => [
      await tx.stockBalance.count({ where: { itemId: batch.itemId, batchId: batch.code, ...tenantWhere(companyId) } }),
      await tx.stockMovement.count({ where: { itemId: batch.itemId, batchId: batch.code, ...tenantWhere(companyId) } }),
    ]);
    if (balances > 0 || movements > 0) {
      throw new ConflictException('لا يمكن حذف دفعة لها رصيد أو حركات مخزنية');
    }
    await this.prisma.batch.delete({ where: { id } });
    return { ok: true };
  }

  private buildDates(dto: CreateBatchDto) {
    return {
      ...(dto.productionDate !== undefined ? { productionDate: new Date(dto.productionDate) } : {}),
      ...(dto.expiry !== undefined ? { expiry: new Date(dto.expiry) } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    };
  }
}
