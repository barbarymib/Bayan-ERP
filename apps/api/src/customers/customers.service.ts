import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import type { CreateCustomerDto, QueryCustomersDto, UpdateCustomerDto } from './customers.dto.js';

const isUniqueError = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCustomerDto, companyId: number | null = null) {
    const priceList = await this.resolvePriceList(dto.priceListCode ?? 'RETAIL', companyId);
    const rep = dto.repCode ? await this.resolveRep(dto.repCode) : null;

    let code = dto.code;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!code) code = await this.nextCode(companyId, attempt);
      try {
        return await this.prisma.customer.create({
          data: {
            code,
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
            ...tenantWhere(companyId),
          },
          include: { priceList: { select: { id: true, code: true, nameAr: true } }, rep: { select: { id: true, name: true, repCode: true } } },
        });
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
        assignments: { orderBy: { fromDate: 'desc' }, take: 5 },
        _count: { select: { statements: true, returns: true, receipts: true } },
      },
    });
    if (!customer || (customer.companyId != null && customer.companyId !== companyId)) {
      throw new NotFoundException(`Customer #${id} not found`);
    }
    return customer;
  }

  async update(id: number, dto: UpdateCustomerDto, companyId: number | null = null) {
    await this.findOne(id, companyId);

    const priceList = dto.priceListCode ? await this.resolvePriceList(dto.priceListCode, companyId) : null;
    const rep = dto.repCode ? await this.resolveRep(dto.repCode) : null;

    return this.prisma.customer.update({
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
      },
      include: { priceList: { select: { id: true, code: true, nameAr: true } }, rep: { select: { id: true, name: true, repCode: true } } },
    });
  }

  /** إيقاف عميل (soft delete). */
  async remove(id: number, companyId: number | null = null) {
    await this.findOne(id, companyId);
    await this.prisma.customer.update({ where: { id }, data: { active: false } });
    return { ok: true };
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