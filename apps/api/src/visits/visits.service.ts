import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import type { CreateVisitPlanDto, QueryVisitPlansDto, UpdateVisitPlanLineDto } from './visits.dto.js';

function dateOnly(d: string | Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

@Injectable()
export class VisitsService {
  constructor(private readonly prisma: PrismaService) {}

  /** إنشاء/تحديث خطة زيارات ليوم معيّن لمندوب. */
  async create(dto: CreateVisitPlanDto, user: AuthUser) {
    const tenant = user.companyId ?? null;
    const repId = dto.repId ?? user.id;
    const rep = await this.prisma.user.findUnique({ where: { id: repId } });
    if (!rep || (rep.companyId != null && rep.companyId !== tenant)) {
      throw new NotFoundException(`User ${repId} not found`);
    }
    const date = dateOnly(dto.date);

    const existing = await this.prisma.visitPlan.findFirst({ where: { repId, date, ...tenantWhere(tenant) } });
    if (existing) await this.prisma.visitPlanLine.deleteMany({ where: { planId: existing.id } });

    const plan = existing
      ? await this.prisma.visitPlan.update({ where: { id: existing.id }, data: { notes: dto.notes?.trim() || null } })
      : await this.prisma.visitPlan.create({ data: { repId, date, companyId: tenant, notes: dto.notes?.trim() || null } });

    await this.prisma.visitPlanLine.createMany({
      data: dto.lines.map((l, i) => ({
        planId: plan.id,
        customerId: l.customerId,
        sequence: l.sequence ?? i + 1,
        status: 'MISSED' as const,
        notes: l.notes?.trim() || null,
      })),
    });
    return this.get(plan.id, tenant);
  }

  async list(query: QueryVisitPlansDto, companyId: number | null = null) {
    const where = {
      ...tenantWhere(companyId),
      ...(query.repId ? { repId: query.repId } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: dateOnly(query.from) } : {}),
              ...(query.to ? { lte: dateOnly(query.to) } : {}),
            },
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.visitPlan.count({ where }),
      this.prisma.visitPlan.findMany({
        where,
        include: { lines: { select: { id: true, status: true } } },
        orderBy: { date: 'desc' },
        take: query.limit ?? 30,
      }),
    ]);
    return {
      total,
      items: rows.map(({ lines, ...rest }) => ({
        ...rest,
        _count: { lines: lines.length, done: lines.filter((l) => l.status === 'DONE').length },
      })),
    };
  }

  async get(id: number, companyId: number | null = null) {
    const plan = await this.prisma.visitPlan.findUnique({
      where: { id },
      include: {
        lines: {
          include: { customer: { select: { id: true, code: true, nameAr: true, phone: true, lat: true, lng: true } } },
          orderBy: { sequence: 'asc' },
        },
      },
    });
    if (!plan || (plan.companyId != null && plan.companyId !== companyId)) {
      throw new NotFoundException(`VisitPlan ${id} not found`);
    }
    return plan;
  }

  async setLineStatus(planId: number, lineId: number, dto: UpdateVisitPlanLineDto, user: AuthUser) {
    const companyId = user.companyId ?? null;
    const plan = await this.prisma.visitPlan.findUnique({
      where: { id: planId },
      select: { companyId: true, repId: true },
    });
    if (!plan || (plan.companyId != null && plan.companyId !== companyId)) {
      throw new NotFoundException(`VisitPlan ${planId} not found`);
    }
    // المندوب يمكنه تحديث بنود خطته الشخصية فقط؛ من يملك صلاحية الإدارة يتجاوز ذلك.
    const canManage = user.permissions?.includes('visit.plan.manage') ?? false;
    if (!canManage && plan.repId !== user.id) {
      throw new ForbiddenException('لا يمكنك تحديث خطة زيارات مندوب آخر');
    }
    const line = await this.prisma.visitPlanLine.findUnique({ where: { id: lineId } });
    if (!line || line.planId !== planId) throw new NotFoundException(`VisitPlanLine ${lineId} not found`);
    await this.prisma.visitPlanLine.update({
      where: { id: lineId },
      data: { status: dto.status, notes: dto.notes?.trim() ?? line.notes },
    });
    return this.get(planId, companyId);
  }

  /** خطة اليوم للمندوب الحالي. */
  async today(user: AuthUser) {
    const date = dateOnly(new Date());
    const plan = await this.prisma.visitPlan.findFirst({
      where: { repId: user.id, date, ...tenantWhere(user.companyId ?? null) },
    });
    if (!plan) return { date, lines: [] };
    return this.get(plan.id, user.companyId ?? null);
  }
}