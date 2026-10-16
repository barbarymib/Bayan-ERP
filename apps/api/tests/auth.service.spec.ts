import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashSync } from 'bcryptjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/auth/auth.service.js';

function dbUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    active: true,
    repCode: 'M03',
    companyId: 1,
    passwordHash: hashSync('secret', 4),
    maxItemDiscountPct: 5,
    maxInvoiceDiscountPct: 10,
    role: { code: 'SALES_REP', permissions: [{ permission: { code: 'statement.create' } }] },
    company: { status: 'ACTIVE' },
    ...overrides,
  };
}

function makeService(overrides: {
  findFirst?: (args: never) => Promise<unknown>;
  findUnique?: (args: never) => Promise<unknown>;
  verifyAsync?: (token: string) => Promise<unknown>;
} = {}) {
  const prisma = {
    user: {
      findFirst: vi.fn(overrides.findFirst ?? (async () => dbUser())),
      findUnique: vi.fn(overrides.findUnique ?? (async () => dbUser())),
    },
  };
  const signAsync = vi.fn(
    async (payload: Record<string, unknown>) => (payload.typ === 'refresh' ? 'REFRESH' : 'ACCESS'),
  );
  const jwt = {
    signAsync,
    verifyAsync: vi.fn(overrides.verifyAsync ?? (async () => ({ sub: 1, typ: 'refresh' }))),
  } as unknown as JwtService;
  return { service: new AuthService(prisma as never, jwt), signAsync };
}

describe('AuthService.login', () => {
  it('returns access + refresh tokens and the user', async () => {
    const { service } = makeService();
    const res = await service.login({ email: 'a@b.c', password: 'secret' });
    expect(res.accessToken).toBe('ACCESS');
    expect(res.refreshToken).toBe('REFRESH');
    expect(res.user.roleCode).toBe('SALES_REP');
  });

  it('rejects bad credentials', async () => {
    const { service } = makeService();
    await expect(service.login({ email: 'a@b.c', password: 'wrong' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('uses the role discount limits when configured (§4.2)', async () => {
    const { service } = makeService({
      findFirst: async () =>
        dbUser({
          role: {
            code: 'SALES_REP',
            permissions: [{ permission: { code: 'statement.create' } }],
            maxItemDiscountPct: 3,
            maxInvoiceDiscountPct: 8,
          },
        }),
    });
    const res = await service.login({ email: 'a@b.c', password: 'secret' });
    expect(res.user.maxItemDiscountPct).toBe(3);
    expect(res.user.maxInvoiceDiscountPct).toBe(8);
  });

  it('falls back to the user discount limits when the role has none', async () => {
    const { service } = makeService();
    const res = await service.login({ email: 'a@b.c', password: 'secret' });
    expect(res.user.maxItemDiscountPct).toBe(5);
    expect(res.user.maxInvoiceDiscountPct).toBe(10);
  });
});

describe('AuthService.refresh', () => {
  it('issues a new token pair from a valid refresh token', async () => {
    const { service } = makeService();
    const res = await service.refresh('REFRESH');
    expect(res.accessToken).toBe('ACCESS');
    expect(res.refreshToken).toBe('REFRESH');
    expect(res.user.id).toBe(1);
  });

  it('rejects a token that is not a refresh token', async () => {
    const { service } = makeService({ verifyAsync: async () => ({ sub: 1 }) });
    await expect(service.refresh('ACCESS')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unverifiable token', async () => {
    const { service } = makeService({
      verifyAsync: async () => {
        throw new Error('bad signature');
      },
    });
    await expect(service.refresh('x')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when the refresh token user is inactive', async () => {
    const { service } = makeService({ findUnique: async () => dbUser({ active: false }) });
    await expect(service.refresh('REFRESH')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
