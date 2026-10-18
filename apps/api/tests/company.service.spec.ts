import { describe, expect, it } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CompanyService } from '../src/company/company.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { AuditLogsService } from '../src/audit-logs/audit-logs.service.js';

interface Options {
  features?: { id: number; code: string; nameAr: string; enabled: boolean }[];
  companyFeatures?: { featureId: number; enabled: boolean }[];
  companyFeature?: { enabled: boolean } | null;
  userFeature?: { enabled: boolean } | null;
  targetUser?: { id: number; companyId: number | null } | null;
}

const FEATURES = [
  { id: 1, code: 'printing.retail', nameAr: 'طباعة التجزئة', enabled: true },
  { id: 2, code: 'reports.valuation', nameAr: 'تقارير التقييم', enabled: false },
];

function makePrisma(opts: Options = {}): PrismaService {
  const features = opts.features ?? FEATURES;
  return {
    systemFeature: {
      findMany: async () => features,
      findUnique: async (args: { where: { code: string } }) =>
        features.find((f) => f.code === args.where.code) ?? null,
    },
    companyFeature: {
      findMany: async () => opts.companyFeatures ?? [],
      findUnique: async () => opts.companyFeature ?? null,
      upsert: async (args: {
        where: { companyId_featureId: { companyId: number; featureId: number } };
        create: { enabled: boolean };
      }) => ({
        companyId: args.where.companyId_featureId.companyId,
        featureId: args.where.companyId_featureId.featureId,
        enabled: args.create.enabled,
      }),
      delete: async () => ({}),
    },
    userFeature: {
      findUnique: async () => opts.userFeature ?? null,
      upsert: async (args: {
        where: { userId_featureId: { userId: number; featureId: number } };
        create: { enabled: boolean };
      }) => ({
        userId: args.where.userId_featureId.userId,
        featureId: args.where.userId_featureId.featureId,
        enabled: args.create.enabled,
      }),
      delete: async () => ({}),
    },
    user: {
      findUnique: async (args: { where: { id: number } }) =>
        opts.targetUser !== undefined
          ? opts.targetUser
          : { id: args.where.id, companyId: 1 },
    },
    company: {
      findUnique: async () => ({ id: 1, code: 'bayan', nameAr: 'بيان', taxPercent: 0 }),
      update: async (args: { data: Record<string, unknown> }) => ({ id: 1, code: 'bayan', nameAr: 'بيان', ...args.data }),
    },
  } as unknown as PrismaService;
}

function makeAudits(): AuditLogsService {
  return { write: async () => ({}) } as unknown as AuditLogsService;
}

function make(opts: Options = {}): CompanyService {
  return new CompanyService(makePrisma(opts), makeAudits());
}

describe('CompanyService.listFeatures', () => {
  it('marks features with a company override as COMPANY and those without as GLOBAL', async () => {
    const svc = make({ companyFeatures: [{ featureId: 1, enabled: false }] });
    const out = await svc.listFeatures(1);
    expect(out.features).toHaveLength(2);
    const retail = out.features.find((f) => f.code === 'printing.retail')!;
    expect(retail.scope).toBe('COMPANY');
    expect(retail.enabled).toBe(false);
    const valuation = out.features.find((f) => f.code === 'reports.valuation')!;
    expect(valuation.scope).toBe('GLOBAL');
    expect(valuation.enabled).toBe(false);
  });

  it('throws when there is no company scope', async () => {
    await expect(make().listFeatures(null)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('CompanyService.setCompanyFeature / clearCompanyFeature', () => {
  it('upserts a company override and reports COMPANY scope', async () => {
    const out = await make().setCompanyFeature(1, 'reports.valuation', true, 7, 'admin');
    expect(out).toEqual({ code: 'reports.valuation', enabled: true, scope: 'COMPANY' });
  });

  it('throws for an unknown feature code', async () => {
    await expect(make().setCompanyFeature(1, 'nope.missing', true, 7)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('clearing an existing override falls back to the global default', async () => {
    const svc = make({ companyFeature: { enabled: false } });
    const out = await svc.clearCompanyFeature(1, 'printing.retail', 7, 'admin');
    expect(out).toEqual({ code: 'printing.retail', enabled: true, scope: 'GLOBAL' });
  });
});

describe('CompanyService.setUserFeature', () => {
  it('upserts a USER override when enabled is provided', async () => {
    const out = await make().setUserFeature(1, 2, 'reports.valuation', true, 7, 'admin');
    expect(out).toEqual({ code: 'reports.valuation', userId: 2, enabled: true, scope: 'USER' });
  });

  it('deletes the override (enabled=undefined) and reports COMPANY_OR_GLOBAL', async () => {
    const svc = make({ userFeature: { enabled: false } });
    const out = await svc.setUserFeature(1, 2, 'reports.valuation', undefined, 7, 'admin');
    expect(out).toEqual({ code: 'reports.valuation', userId: 2, enabled: null, scope: 'COMPANY_OR_GLOBAL' });
  });

  it('throws when the target user is outside the company', async () => {
    await expect(
      make({ targetUser: { id: 2, companyId: 99 } }).setUserFeature(1, 2, 'reports.valuation', true, 7),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
