import { describe, expect, it } from 'vitest';
import { FeaturesService } from '../src/auth/features.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';

interface Options {
  features?: { id: number; code: string; enabled: boolean }[];
  userFeature?: unknown;
  companyFeature?: unknown;
  userFeatures?: unknown[];
  companyFeatures?: unknown[];
}

function makePrisma(opts: Options = {}): PrismaService {
  const features = opts.features ?? [
    { id: 1, code: 'printing.retail', enabled: true },
    { id: 2, code: 'reports.valuation', enabled: false },
  ];
  return {
    systemFeature: {
      findUnique: async (args: { where: { code: string } }) =>
        features.find((f) => f.code === args.where.code) ?? null,
      findMany: async () => features,
    },
    userFeature: {
      findUnique: async () => opts.userFeature ?? null,
      findMany: async () => opts.userFeatures ?? [],
    },
    companyFeature: {
      findUnique: async () => opts.companyFeature ?? null,
      findMany: async () => opts.companyFeatures ?? [],
    },
  } as unknown as PrismaService;
}

describe('FeaturesService.isEnabled', () => {
  it('uses the global default when there are no overrides', async () => {
    const svc = new FeaturesService(makePrisma());
    await expect(svc.isEnabled('printing.retail', 1, 1)).resolves.toBe(true);
    await expect(svc.isEnabled('reports.valuation', 1, 1)).resolves.toBe(false);
  });

  it('prefers the user override over the company and global state', async () => {
    const svc = new FeaturesService(
      makePrisma({ userFeature: { enabled: false }, companyFeature: { enabled: true } }),
    );
    await expect(svc.isEnabled('printing.retail', 1, 1)).resolves.toBe(false);
  });

  it('falls back to the company override when there is no user override', async () => {
    const svc = new FeaturesService(makePrisma({ companyFeature: { enabled: false } }));
    await expect(svc.isEnabled('printing.retail', 1, 1)).resolves.toBe(false);
  });

  it('returns false for an unknown feature code', async () => {
    const svc = new FeaturesService(makePrisma());
    await expect(svc.isEnabled('nope.missing', 1, 1)).resolves.toBe(false);
  });

  it('skips overrides when there is no user/company (e.g. global admin)', async () => {
    const svc = new FeaturesService(
      makePrisma({ userFeature: { enabled: false }, companyFeature: { enabled: false } }),
    );
    await expect(svc.isEnabled('printing.retail', null, null)).resolves.toBe(true);
  });
});

describe('FeaturesService.effectiveFlags', () => {
  it('returns the full map with user > company > global precedence', async () => {
    const svc = new FeaturesService(
      makePrisma({
        userFeatures: [{ featureId: 1, enabled: false }],
        companyFeatures: [{ featureId: 2, enabled: true }],
      }),
    );
    const flags = await svc.effectiveFlags(1, 1);
    expect(flags).toEqual({ 'printing.retail': false, 'reports.valuation': true });
  });

  it('falls back to global defaults when no overrides exist', async () => {
    const svc = new FeaturesService(makePrisma());
    const flags = await svc.effectiveFlags(1, 1);
    expect(flags).toEqual({ 'printing.retail': true, 'reports.valuation': false });
  });

  it('ignores overrides for a null user/company and returns global defaults', async () => {
    const svc = new FeaturesService(
      makePrisma({
        userFeatures: [{ featureId: 1, enabled: false }],
        companyFeatures: [{ featureId: 1, enabled: false }],
      }),
    );
    const flags = await svc.effectiveFlags(null, null);
    expect(flags).toEqual({ 'printing.retail': true, 'reports.valuation': false });
  });

  it('returns an empty map when there are no features', async () => {
    const svc = new FeaturesService(makePrisma({ features: [] }));
    const flags = await svc.effectiveFlags(1, 1);
    expect(flags).toEqual({});
  });
});
