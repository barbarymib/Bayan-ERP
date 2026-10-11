import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { RepTargetsService } from '../src/rep-targets/rep-targets.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { CreateRepTargetDto, CommissionReportDto } from '../src/rep-targets/rep-targets.dto.js';

const baseDto: CreateRepTargetDto = {
  repCode: 'M03',
  periodType: 'MONTHLY',
  fromDate: '2026-10-01',
  toDate: '2026-10-31',
  targetAmount: 100000,
  commissionBase: 'SALES',
  commissionRate: 1.5,
} as CreateRepTargetDto;

type AggCall = { where: Record<string, unknown> };

function harness(opts: {
  salesNet?: number | null;
  collected?: number | null;
  repMissing?: boolean;
} = {}) {
  const salesCalls: AggCall[] = [];
  const collectedCalls: AggCall[] = [];
  const updates: { data: Record<string, unknown> }[] = [];

  const prisma = {
    user: {
      findUnique: async () =>
        opts.repMissing ? null : { id: 2, name: 'مندوب المبيعات', repCode: 'M03' },
    },
    repTarget: {
      create: async (args: { data: Record<string, unknown> }) => ({
        id: 1,
        ...args.data,
        rep: { id: 2, name: 'مندوب المبيعات', repCode: 'M03' },
      }),
      findUnique: async () => ({
        id: 1,
        repId: 2,
        fromDate: new Date('2026-10-01'),
        toDate: new Date('2026-10-31'),
        commissionBase: 'SALES',
        commissionRate: 1.5,
        targetAmount: 100000,
        achievedAmount: 0,
        commissionDue: 0,
        active: true,
        rep: { id: 2, name: 'مندوب المبيعات', repCode: 'M03' },
      }),
      findMany: async () => [],
      update: async (args: { data: Record<string, unknown> }) => {
        updates.push(args);
        return { id: 1 };
      },
    },
    priceStatement: {
      aggregate: async (args: { where: Record<string, unknown> }) => {
        salesCalls.push({ where: args.where });
        return { _sum: { net: opts.salesNet ?? 0 } };
      },
    },
    receiptAllocation: {
      aggregate: async (args: { where: Record<string, unknown> }) => {
        collectedCalls.push({ where: args.where });
        return { _sum: { amount: opts.collected ?? 0 } };
      },
    },
  } as unknown as PrismaService;

  return { service: new RepTargetsService(prisma), salesCalls, collectedCalls, updates };
}

describe('RepTargetsService (§5.16 التارجت والعمولات)', () => {
  it('يحسب الإنجاز من المبيعات المعتمدة والعمولة بنسبة الأساس', async () => {
    const { service, salesCalls } = harness({ salesNet: 50000 });
    const t = await service.create(baseDto);

    expect(t.achieved).toBe(50000);
    expect(t.commissionDue).toBe(750); // 50000 * 1.5 / 100
    expect(t.achievementPct).toBe(50); // 50000 / 100000 * 100
    expect(salesCalls).toHaveLength(1);
    expect(salesCalls[0]?.where.status).toEqual({ in: ['APPROVED', 'ARCHIVED'] });
    expect(salesCalls[0]?.where.repId).toBe(2);
  });

  it('أساس العمولة COLLECTED يقرأ المحصّل الفعلي من تخصيصات السندات', async () => {
    const { service, collectedCalls, salesCalls } = harness({ collected: 12000 });
    const t = await service.create({ ...baseDto, commissionBase: 'COLLECTED' } as CreateRepTargetDto);

    expect(t.achieved).toBe(12000);
    expect(t.commissionDue).toBe(180);
    expect(salesCalls).toHaveLength(0);
    expect(collectedCalls).toHaveLength(1);
    expect(collectedCalls[0]?.where.statement).toEqual({ repId: 2 });
  });

  it('لا مبيعات ⇒ إنجاز وعمولة صفرين', async () => {
    const { service } = harness({ salesNet: null });
    const t = await service.create(baseDto);
    expect(t.achieved).toBe(0);
    expect(t.commissionDue).toBe(0);
    expect(t.achievementPct).toBe(0);
  });

  it('يرفض تارجت لمندوب غير موجود', async () => {
    const { service } = harness({ repMissing: true });
    await expect(service.create(baseDto)).rejects.toThrow(NotFoundException);
  });

  it('يرفض فترة منتهية قبل بدايتها', async () => {
    const { service } = harness();
    await expect(
      service.create({ ...baseDto, fromDate: '2026-10-31', toDate: '2026-10-01' } as CreateRepTargetDto),
    ).rejects.toThrow(BadRequestException);
  });

  it('recalculate يحفظ الإنجاز والعمولة المحسوبتين', async () => {
    const { service, updates } = harness({ salesNet: 80000 });
    const t = await service.recalculate(1);
    expect(t.achieved).toBe(80000);
    expect(updates[0]?.data.achievedAmount).toBe(80000);
    expect(updates[0]?.data.commissionDue).toBe(1200);
  });

  it('يجمّع التقرير إجماليات الهدف والإنجاز والعمولة', async () => {
    const targets = [
      {
        id: 1,
        repId: 2,
        fromDate: new Date('2026-10-01'),
        toDate: new Date('2026-10-31'),
        commissionBase: 'SALES',
        commissionRate: 2,
        targetAmount: 100000,
        rep: { id: 2, name: 'م', repCode: 'M03' },
      },
      {
        id: 2,
        repId: 3,
        fromDate: new Date('2026-10-01'),
        toDate: new Date('2026-10-31'),
        commissionBase: 'SALES',
        commissionRate: 1,
        targetAmount: 50000,
        rep: { id: 3, name: 'ن', repCode: 'M04' },
      },
    ];
    const svc = new RepTargetsService({
      user: { findUnique: async () => null },
      repTarget: {
        findMany: async () => targets,
        findUnique: async () => targets[0],
        create: async () => targets[0],
        update: async () => targets[0],
      },
      priceStatement: { aggregate: async () => ({ _sum: { net: 60000 } }) },
      receiptAllocation: { aggregate: async () => ({ _sum: { amount: 0 } }) },
    } as unknown as PrismaService);

    const report = await svc.report({} as CommissionReportDto);
    expect(report.rows).toHaveLength(2);
    expect(report.totals.target).toBe(150000);
    expect(report.totals.achieved).toBe(120000);
    // 60000*2% = 1200 + 60000*1% = 600
    expect(report.totals.commission).toBe(1800);
  });
});
