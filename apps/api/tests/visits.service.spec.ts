import { describe, expect, it } from 'vitest';
import { VisitsService } from '../src/visits/visits.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { AuthUser } from '../src/auth/auth.decorators.js';

interface UpdateArgs {
  where: { id: number };
  data: { status: string; notes: string | null };
}

function makePrisma(plan: { companyId: number | null; repId: number }) {
  let captured: UpdateArgs | null = null;
  const prisma = {
    visitPlan: {
      findUnique: async (args: unknown) => {
        const a = args as { select?: unknown };
        if (a?.select) return plan;
        return {
          id: 7,
          repId: plan.repId,
          companyId: plan.companyId,
          date: new Date('2026-10-10T00:00:00.000Z'),
          notes: null,
          lines: [],
        };
      },
    },
    visitPlanLine: {
      findUnique: async () => ({ id: 10, planId: 7, status: 'PLANNED', notes: null }),
      update: async (args: UpdateArgs) => {
        captured = args;
        return args.data;
      },
    },
  } as unknown as PrismaService;
  return { prisma, getCaptured: () => captured };
}

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 2,
    sub: 2,
    name: 'مندوب',
    roleCode: 'SALES_REP',
    repCode: 'M03',
    permissions: ['visit.plan.view'],
    maxItemDiscountPct: 0,
    maxInvoiceDiscountPct: 0,
    companyId: 1,
    ...overrides,
  };
}

describe('VisitsService.setLineStatus', () => {
  it('يسمح للمندوب بتحديث بند في خطته الشخصية بصلاحية العرض فقط', async () => {
    const { prisma, getCaptured } = makePrisma({ companyId: 1, repId: 2 });
    const service = new VisitsService(prisma);

    await service.setLineStatus(7, 10, { status: 'DONE' }, user());

    expect(getCaptured()?.data.status).toBe('DONE');
  });

  it('يمنع المندوب من تحديث خطة مندوب آخر', async () => {
    const { prisma } = makePrisma({ companyId: 1, repId: 99 });
    const service = new VisitsService(prisma);

    await expect(service.setLineStatus(7, 10, { status: 'DONE' }, user())).rejects.toThrow('مندوب آخر');
  });

  it('يسمح لمن يملك صلاحية الإدارة بتحديث خطة أي مندوب', async () => {
    const { prisma, getCaptured } = makePrisma({ companyId: 1, repId: 99 });
    const service = new VisitsService(prisma);

    await service.setLineStatus(
      7,
      10,
      { status: 'MISSED', notes: 'العميل مغلق' },
      user({ permissions: ['visit.plan.view', 'visit.plan.manage'] }),
    );

    expect(getCaptured()?.data.status).toBe('MISSED');
    expect(getCaptured()?.data.notes).toBe('العميل مغلق');
  });

  it('يرفض خطة من شركة أخرى', async () => {
    const { prisma } = makePrisma({ companyId: 2, repId: 2 });
    const service = new VisitsService(prisma);

    await expect(service.setLineStatus(7, 10, { status: 'DONE' }, user())).rejects.toThrow('not found');
  });
});
