import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { roundMoney } from '@bayan/shared';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import type {
  CommissionReportDto,
  CreateRepTargetDto,
  QueryRepTargetsDto,
  UpdateRepTargetDto,
} from './rep-targets.dto.js';

const includeRep = { rep: { select: { id: true, name: true, repCode: true } } } as const;

@Injectable()
export class RepTargetsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRepTargetDto, companyId: number | null = null) {
    const rep = await this.prisma.user.findUnique({ where: { repCode: dto.repCode } });
    if (!rep || (rep.companyId != null && rep.companyId !== companyId)) {
      throw new NotFoundException(`Rep ${dto.repCode} not found`);
    }
    this.assertRange(dto.fromDate, dto.toDate);

    const target = await this.prisma.repTarget.create({
      data: {
        repId: rep.id,
        companyId,
        periodType: dto.periodType ?? 'MONTHLY',
        fromDate: new Date(dto.fromDate),
        toDate: new Date(dto.toDate),
        targetAmount: dto.targetAmount,
        commissionBase: dto.commissionBase ?? 'COLLECTED',
        commissionRate: dto.commissionRate,
        active: dto.active ?? true,
      },
      include: includeRep,
    });
    return this.withComputed(target, companyId);
  }

  async list(query: QueryRepTargetsDto, companyId: number | null = null) {
    const where = {
      ...tenantWhere(companyId),
      ...(query.repCode ? { rep: { repCode: query.repCode } } : {}),
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(query.from || query.to
        ? {
            fromDate: { ...(query.to ? { lte: new Date(query.to) } : {}) },
            ...(query.from ? { toDate: { gte: new Date(query.from) } } : {}),
          }
        : {}),
    };
    const targets = await this.prisma.repTarget.findMany({
      where,
      include: includeRep,
      orderBy: { fromDate: 'desc' },
      take: 200,
    });
    const rows = await Promise.all(targets.map((t) => this.withComputed(t, companyId)));
    return { total: rows.length, items: rows };
  }

  async get(id: number, companyId: number | null = null) {
    const target = await this.prisma.repTarget.findUnique({ where: { id }, include: includeRep });
    if (!target || (target.companyId != null && target.companyId !== companyId)) {
      throw new NotFoundException(`Rep target #${id} not found`);
    }
    return this.withComputed(target, companyId);
  }

  async update(id: number, dto: UpdateRepTargetDto, companyId: number | null = null) {
    const existing = await this.prisma.repTarget.findUnique({ where: { id } });
    if (!existing || (existing.companyId != null && existing.companyId !== companyId)) {
      throw new NotFoundException(`Rep target #${id} not found`);
    }

    let repId: number | undefined;
    if (dto.repCode) {
      const rep = await this.prisma.user.findUnique({ where: { repCode: dto.repCode } });
      if (!rep || (rep.companyId != null && rep.companyId !== companyId)) {
        throw new NotFoundException(`Rep ${dto.repCode} not found`);
      }
      repId = rep.id;
    }
    if (dto.fromDate && dto.toDate) this.assertRange(dto.fromDate, dto.toDate);

    await this.prisma.repTarget.update({
      where: { id },
      data: {
        ...(repId !== undefined ? { repId } : {}),
        ...(dto.periodType ? { periodType: dto.periodType } : {}),
        ...(dto.fromDate ? { fromDate: new Date(dto.fromDate) } : {}),
        ...(dto.toDate ? { toDate: new Date(dto.toDate) } : {}),
        ...(dto.targetAmount !== undefined ? { targetAmount: dto.targetAmount } : {}),
        ...(dto.commissionBase ? { commissionBase: dto.commissionBase } : {}),
        ...(dto.commissionRate !== undefined ? { commissionRate: dto.commissionRate } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
    return this.get(id, companyId);
  }

  async remove(id: number, companyId: number | null = null) {
    const existing = await this.prisma.repTarget.findUnique({ where: { id } });
    if (!existing || (existing.companyId != null && existing.companyId !== companyId)) {
      throw new NotFoundException(`Rep target #${id} not found`);
    }
    await this.prisma.repTarget.delete({ where: { id } });
    return { ok: true };
  }

  /** إعادة حساب الإنجاز والعمولة آلياً وحفظهما (§5.16). */
  async recalculate(id: number, companyId: number | null = null) {
    const target = await this.prisma.repTarget.findUnique({ where: { id }, include: includeRep });
    if (!target || (target.companyId != null && target.companyId !== companyId)) {
      throw new NotFoundException(`Rep target #${id} not found`);
    }
    const enriched = await this.withComputed(target, companyId);
    await this.prisma.repTarget.update({
      where: { id },
      data: { achievedAmount: enriched.achieved, commissionDue: enriched.commissionDue },
    });
    return enriched;
  }

  /** تقرير التارجت والعمولات لفترة (§5.16). */
  async report(dto: CommissionReportDto, companyId: number | null = null) {
    const from = dto.from ? new Date(dto.from) : this.startOfMonth();
    const to = dto.to ? new Date(dto.to) : new Date();

    const targets = await this.prisma.repTarget.findMany({
      where: {
        ...tenantWhere(companyId),
        fromDate: { lte: this.endOfDay(to) },
        toDate: { gte: from },
      },
      include: includeRep,
      orderBy: { fromDate: 'desc' },
    });
    const rows = await Promise.all(targets.map((t) => this.withComputed(t, companyId)));

    const totals = rows.reduce(
      (acc, row) => ({
        target: acc.target + Number(row.targetAmount),
        achieved: acc.achieved + row.achieved,
        commission: acc.commission + row.commissionDue,
      }),
      { target: 0, achieved: 0, commission: 0 },
    );

    return {
      from,
      to,
      rows,
      totals: {
        target: roundMoney(totals.target),
        achieved: roundMoney(totals.achieved),
        commission: roundMoney(totals.commission),
      },
    };
  }

  // ==================== helpers ====================

  private async withComputed<
    T extends {
      repId: number;
      fromDate: Date;
      toDate: Date;
      commissionBase: string;
      commissionRate: unknown;
      targetAmount: unknown;
    },
  >(
    target: T,
    companyId: number | null = null,
  ): Promise<T & { achieved: number; commissionDue: number; achievementPct: number }> {
    const achieved = await this.computeAchieved(
      target.repId,
      target.fromDate,
      target.toDate,
      target.commissionBase,
      companyId,
    );
    const commissionDue = roundMoney((achieved * Number(target.commissionRate)) / 100);
    const targetAmount = Number(target.targetAmount);
    const achievementPct = targetAmount > 0 ? roundMoney((achieved / targetAmount) * 100) : 0;
    return { ...target, achieved, commissionDue, achievementPct };
  }

  /** المحقّق آلياً: مبيعات معتمدة أو محصّل فعلي حسب أساس العمولة. */
  private async computeAchieved(
    repId: number,
    fromDate: Date,
    toDate: Date,
    base: string,
    companyId: number | null = null,
  ): Promise<number> {
    const from = fromDate;
    const to = this.endOfDay(toDate);

    if (base === 'SALES') {
      const agg = await this.prisma.priceStatement.aggregate({
        _sum: { net: true },
        where: {
          ...tenantWhere(companyId),
          repId,
          date: { gte: from, lte: to },
          status: { in: ['APPROVED', 'ARCHIVED'] },
        },
      });
      return agg._sum.net ? Number(agg._sum.net) : 0;
    }

    const agg = await this.prisma.receiptAllocation.aggregate({
      _sum: { amount: true },
      where: {
        statement: { repId, ...tenantWhere(companyId) },
        receipt: { receivedAt: { gte: from, lte: to }, ...tenantWhere(companyId) },
      },
    });
    return agg._sum.amount ? Number(agg._sum.amount) : 0;
  }

  private assertRange(fromDate: string, toDate: string) {
    if (new Date(toDate) < new Date(fromDate)) {
      throw new BadRequestException('toDate must be on or after fromDate');
    }
  }

  private endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private startOfMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}
