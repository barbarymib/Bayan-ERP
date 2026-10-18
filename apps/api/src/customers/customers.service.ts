import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { CreateCustomerDto, QueryCustomersDto, UpdateCustomerDto, UpdateCustomerRatingDto } from './customers.dto.js';

const isUniqueError = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditLogsService,
  ) {}

  async create(dto: CreateCustomerDto, companyId: number | null = null, userId?: number) {
    const priceList = await this.resolvePriceList(dto.priceListCode ?? 'RETAIL', companyId);
    const rep = dto.repCode ? await this.resolveRep(dto.repCode) : null;

    let code = dto.code;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!code) code = await this.nextCode(companyId, attempt);
      const customerCode = code;
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const customer = await tx.customer.create({
            data: {
              code: customerCode,
              nameAr: dto.nameAr,
              nameEn: dto.nameEn,
              activity: dto.activity,
              address: dto.address,
              lat: dto.lat,
              lng: dto.lng,
              phone: dto.phone,
              phone2: dto.phone2,
              taxNumber: dto.taxNumber,
              priceListId: priceList.id,
              creditLimit: dto.creditLimit ?? 0,
              creditDays: dto.creditDays ?? 0,
              repId: rep?.id,
              openingBalance: dto.openingBalance ?? 0,
              classification: dto.classification ?? 'C',
              paymentRating: dto.paymentRating ?? null,
              paymentNotes: dto.paymentNotes ?? null,
              ...tenantWhere(companyId),
            },
            include: { priceList: { select: { id: true, code: true, nameAr: true } }, rep: { select: { id: true, name: true, repCode: true } } },
          });
          await this.syncAssignment(tx, customer.id, customer.repId, companyId);
          return customer;
        });
        await this.audits.write({
          userId,
          action: 'customer.create',
          entity: 'Customer',
          entityId: created.id,
          afterJson: {
            code: created.code,
            nameAr: created.nameAr,
            repId: created.repId,
            creditLimit: Number(created.creditLimit),
          },
        });
        return created;
      } catch (e) {
        if (isUniqueError(e) && !dto.code) {
          code = undefined;
          continue;
        }
        throw e;
      }
    }
    throw new ConflictException('Could not generate a unique customer code');
  }

  async list(query: QueryCustomersDto, companyId: number | null = null) {
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
              { phone: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.repCode ? { rep: { repCode: query.repCode } } : {}),
      ...(query.priceListCode ? { priceList: { code: query.priceListCode } } : {}),
      ...(query.classification ? { classification: query.classification } : {}),
      ...(query.active ? { active: query.active === 'true' } : {}),
    };

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: {
          priceList: { select: { id: true, code: true, nameAr: true } },
          rep: { select: { id: true, name: true, repCode: true } },
        },
        orderBy: { nameAr: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { customers, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: number, companyId: number | null = null) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        priceList: { select: { id: true, code: true, nameAr: true } },
        rep: { select: { id: true, name: true, repCode: true } },
        assignments: { orderBy: { fromDate: 'desc' }, take: 50 },
        _count: { select: { statements: true, returns: true, receipts: true } },
      },
    });
    if (!customer || (customer.companyId != null && customer.companyId !== companyId)) {
      throw new NotFoundException(`Customer #${id} not found`);
    }
    // حلّ أسماء المناديب في سجل النقل (لا يوجد علاقة رسمية بين التعيين والمستخدم).
    const repIds = [...new Set(customer.assignments.map((a) => a.repId))];
    const reps = repIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: repIds } }, select: { id: true, name: true, repCode: true } })
      : [];
    const repById = new Map(reps.map((r) => [r.id, r]));
    const assignments = customer.assignments.map((a) => ({ ...a, rep: repById.get(a.repId) ?? null }));
    return { ...customer, assignments };
  }

  async update(id: number, dto: UpdateCustomerDto, companyId: number | null = null, userId?: number) {
    const before = await this.findOne(id, companyId);

    const priceList = dto.priceListCode ? await this.resolvePriceList(dto.priceListCode, companyId) : null;
    const rep = dto.repCode ? await this.resolveRep(dto.repCode) : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({
        where: { id },
        data: {
          nameAr: dto.nameAr,
          nameEn: dto.nameEn,
          activity: dto.activity,
          address: dto.address,
          lat: dto.lat,
          lng: dto.lng,
          phone: dto.phone,
          phone2: dto.phone2,
          taxNumber: dto.taxNumber,
          priceListId: priceList?.id,
          creditLimit: dto.creditLimit,
          creditDays: dto.creditDays,
          repId: rep?.id,
          openingBalance: dto.openingBalance,
          classification: dto.classification,
          active: dto.active,
          ...(dto.paymentRating !== undefined ? { paymentRating: dto.paymentRating } : {}),
          ...(dto.paymentNotes !== undefined ? { paymentNotes: dto.paymentNotes } : {}),
        },
        include: { priceList: { select: { id: true, code: true, nameAr: true } }, rep: { select: { id: true, name: true, repCode: true } } },
      });
      if (dto.repCode !== undefined) {
        await this.syncAssignment(tx, id, customer.repId, companyId);
      }
      return customer;
    });

    await this.audits.write({
      userId,
      action: 'customer.update',
      entity: 'Customer',
      entityId: id,
      beforeJson: {
        nameAr: before.nameAr,
        repId: before.repId,
        creditLimit: Number(before.creditLimit),
        active: before.active,
      },
      afterJson: {
        nameAr: updated.nameAr,
        repId: updated.repId,
        creditLimit: Number(updated.creditLimit),
        active: updated.active,
      },
    });
    return updated;
  }

  /** تقييم سداد العميل (يُقيَّد بصلاحية customer.rating). */
  async rate(id: number, dto: UpdateCustomerRatingDto, companyId: number | null = null, userId?: number) {
    const before = await this.findOne(id, companyId);
    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.paymentRating !== undefined ? { paymentRating: dto.paymentRating } : {}),
        ...(dto.paymentNotes !== undefined ? { paymentNotes: dto.paymentNotes } : {}),
      },
    });
    await this.audits.write({
      userId,
      action: 'customer.rate',
      entity: 'Customer',
      entityId: id,
      beforeJson: { paymentRating: before.paymentRating, paymentNotes: before.paymentNotes },
      afterJson: { paymentRating: updated.paymentRating, paymentNotes: updated.paymentNotes },
    });
    return updated;
  }

  /** إيقاف عميل (soft delete). */
  async remove(id: number, companyId: number | null = null, userId?: number) {
    await this.findOne(id, companyId);
    await this.prisma.customer.update({ where: { id }, data: { active: false } });
    await this.audits.write({
      userId,
      action: 'customer.delete',
      entity: 'Customer',
      entityId: id,
      afterJson: { active: false },
    });
    return { ok: true };
  }

  /**
   * يزامن جدول `CustomerRepAssignment` (مصدر تغذية المندوب في /sync/delta والمسارح)
   * مع `Customer.repId`: يفتح تعييناً جديداً للمندوب الحالي ويغلق التعيينات المفتوحة الأخرى.
   */
  private async syncAssignment(
    tx: Prisma.TransactionClient,
    customerId: number,
    repId: number | null,
    companyId: number | null,
  ) {
    const open = await tx.customerRepAssignment.findMany({
      where: { customerId, toDate: null },
      select: { id: true, repId: true },
    });
    if (repId != null && !open.some((a) => a.repId === repId)) {
      await tx.customerRepAssignment.create({
        data: { customerId, repId, ...tenantWhere(companyId) },
      });
    }
    const stale = open.filter((a) => a.repId !== repId).map((a) => a.id);
    if (stale.length > 0) {
      await tx.customerRepAssignment.updateMany({
        where: { id: { in: stale } },
        data: { toDate: new Date() },
      });
    }
  }

  private async resolvePriceList(code: string, companyId: number | null) {
    const priceList = await this.prisma.priceList.findFirst({ where: { code, ...tenantWhere(companyId) } });
    if (!priceList) throw new NotFoundException(`Price list ${code} not found`);
    return priceList;
  }

  private async resolveRep(repCode: string) {
    const rep = await this.prisma.user.findUnique({ where: { repCode } });
    if (!rep) throw new NotFoundException(`Rep ${repCode} not found`);
    return rep;
  }

  private async nextCode(companyId: number | null, retryOffset = 0): Promise<string> {
    const last = await this.prisma.customer.findFirst({ where: tenantWhere(companyId), orderBy: { id: 'desc' } });
    const nextId = (last?.id ?? 0) + retryOffset + 1;
    return `C${String(nextId).padStart(4, '0')}`;
  }
}