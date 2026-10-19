import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../src/auth/auth.guard.js';
import { FeaturesService } from '../src/auth/features.service.js';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY, ANY_PERMISSIONS_KEY, type AuthUser } from '../src/auth/auth.decorators.js';

function makeContext(overrides: {
  public?: boolean;
  permissions?: string[];
  header?: string;
} = {}): { ctx: ExecutionContext; request: Record<string, unknown> } {
  const handler = (): void => {};
  const klass = class Foo {};
  const request: Record<string, unknown> = {
    headers: { authorization: overrides.header },
  };
  const ctx = {
    getHandler: () => handler,
    getClass: () => klass,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

function makeGuard(overrides: {
  reflector?: Pick<Reflector, 'getAllAndOverride'>;
  jwt?: Pick<JwtService, 'verifyAsync'>;
  prisma?: {
    user?: { findUnique: (args: never) => Promise<unknown> };
    systemFeature?: { findUnique: (args: never) => Promise<unknown> };
    userFeature?: { findUnique: (args: never) => Promise<unknown> };
    companyFeature?: { findUnique: (args: never) => Promise<unknown> };
  };
  features?: FeaturesService;
} = {}): AuthGuard {
  const reflector = (overrides.reflector ?? {
    getAllAndOverride: (key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === PERMISSIONS_KEY) return [];
      return undefined;
    },
  }) as unknown as Reflector;

  const jwt = (overrides.jwt ?? {
    verifyAsync: vi.fn(async (): Promise<AuthUser> => {
      return { id: 1, sub: 1, name: 'x', roleCode: 'ADMIN', repCode: null, permissions: ['a'] } as AuthUser;
    }),
  }) as unknown as JwtService;

  const activeUser = {
    id: 1,
    active: true,
    companyId: 1,
    company: { status: 'ACTIVE' },
  };
  const prisma = (overrides.prisma ?? {
    user: { findUnique: vi.fn(async () => activeUser) },
    systemFeature: { findUnique: vi.fn(async () => null) },
    userFeature: { findUnique: vi.fn(async () => null) },
    companyFeature: { findUnique: vi.fn(async () => null) },
  }) as never;

  const features = overrides.features ?? (new FeaturesService(prisma as never) as unknown as FeaturesService);

  return new AuthGuard(reflector, jwt, prisma as never, features);
}

describe('AuthGuard', () => {
  it('allows public routes without a token', async () => {
    const guard = makeGuard({
      reflector: {
        getAllAndOverride: (key: string) => key === IS_PUBLIC_KEY,
      } as never,
    });
    const { ctx } = makeContext();
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects 401 when no bearer token', async () => {
    const guard = makeGuard();
    const { ctx } = makeContext();
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects 401 on invalid token', async () => {
    const guard = makeGuard({
      jwt: {
        verifyAsync: vi.fn(async () => {
          throw new Error('bad');
        }),
      } as never,
    });
    const { ctx } = makeContext({ header: 'Bearer nope' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts valid token and attaches user', async () => {
    const guard = makeGuard();
    const { ctx, request } = makeContext({ header: 'Bearer abc' });
    await guard.canActivate(ctx);
    expect(request.user).toBeDefined();
    expect((request.user as AuthUser).roleCode).toBe('ADMIN');
  });

  it('resolves effective discount limits from the role over the user (§4.2)', async () => {
    const guard = makeGuard({
      prisma: {
        user: {
          findUnique: vi.fn(async () => ({
            id: 1,
            active: true,
            companyId: 1,
            company: { status: 'ACTIVE' },
            maxItemDiscountPct: 2,
            maxInvoiceDiscountPct: 4,
            role: { maxItemDiscountPct: 7, maxInvoiceDiscountPct: 9 },
          })),
        },
        systemFeature: { findUnique: vi.fn(async () => null) },
        userFeature: { findUnique: vi.fn(async () => null) },
        companyFeature: { findUnique: vi.fn(async () => null) },
      },
    });
    const { ctx, request } = makeContext({ header: 'Bearer abc' });
    await guard.canActivate(ctx);
    expect((request.user as AuthUser).maxItemDiscountPct).toBe(7);
    expect((request.user as AuthUser).maxInvoiceDiscountPct).toBe(9);
  });

  it('falls back to the user discount limits when the role has none', async () => {
    const guard = makeGuard({
      prisma: {
        user: {
          findUnique: vi.fn(async () => ({
            id: 1,
            active: true,
            companyId: 1,
            company: { status: 'ACTIVE' },
            maxItemDiscountPct: 6,
            maxInvoiceDiscountPct: 11,
            role: { maxItemDiscountPct: null, maxInvoiceDiscountPct: null },
          })),
        },
        systemFeature: { findUnique: vi.fn(async () => null) },
        userFeature: { findUnique: vi.fn(async () => null) },
        companyFeature: { findUnique: vi.fn(async () => null) },
      },
    });
    const { ctx, request } = makeContext({ header: 'Bearer abc' });
    await guard.canActivate(ctx);
    expect((request.user as AuthUser).maxItemDiscountPct).toBe(6);
    expect((request.user as AuthUser).maxInvoiceDiscountPct).toBe(11);
  });

  it('rejects 403 when permission is missing', async () => {
    const guard = makeGuard({
      reflector: {
        getAllAndOverride: (key: string) => {
          if (key === IS_PUBLIC_KEY) return false;
          if (key === PERMISSIONS_KEY) return ['admin.super'];
          return undefined;
        },
      } as never,
    });
    const { ctx } = makeContext({ header: 'Bearer abc' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('passes when all required permissions are present', async () => {
    const guard = makeGuard({
      reflector: {
        getAllAndOverride: (key: string) => {
          if (key === IS_PUBLIC_KEY) return false;
          if (key === PERMISSIONS_KEY) return ['a'];
          return undefined;
        },
      } as never,
    });
    const { ctx } = makeContext({ header: 'Bearer abc' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('R4-B3: AnyPermission passes when the user holds at least one of the codes (OR)', async () => {
    const guard = makeGuard({
      reflector: {
        getAllAndOverride: (key: string) => {
          if (key === IS_PUBLIC_KEY) return false;
          if (key === PERMISSIONS_KEY) return [];
          if (key === ANY_PERMISSIONS_KEY) return ['discount.approve', 'return.approve'];
          return undefined;
        },
      } as never,
      jwt: {
        verifyAsync: vi.fn(async (): Promise<AuthUser> => {
          return { id: 1, sub: 1, name: 'x', roleCode: 'ACCOUNTANT', repCode: null, permissions: ['return.approve'] } as AuthUser;
        }),
      } as never,
    });
    const { ctx } = makeContext({ header: 'Bearer abc' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('R4-B3: AnyPermission rejects 403 when the user holds none of the codes', async () => {
    const guard = makeGuard({
      reflector: {
        getAllAndOverride: (key: string) => {
          if (key === IS_PUBLIC_KEY) return false;
          if (key === PERMISSIONS_KEY) return [];
          if (key === ANY_PERMISSIONS_KEY) return ['discount.approve', 'return.approve'];
          return undefined;
        },
      } as never,
      jwt: {
        verifyAsync: vi.fn(async (): Promise<AuthUser> => {
          return { id: 1, sub: 1, name: 'x', roleCode: 'REP', repCode: null, permissions: ['statement.create'] } as AuthUser;
        }),
      } as never,
    });
    const { ctx } = makeContext({ header: 'Bearer abc' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects 403 when the user belongs to a disabled company', async () => {
    const guard = makeGuard({
      prisma: {
        user: {
          findUnique: vi.fn(async () => ({
            id: 1,
            active: true,
            companyId: 5,
            company: { status: 'DISABLED' },
          })),
        },
      },
    });
    const { ctx } = makeContext({ header: 'Bearer abc' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects 403 when a feature is required but disabled', async () => {
    const guard = makeGuard({
      reflector: {
        getAllAndOverride: (key: string) => {
          if (key === IS_PUBLIC_KEY) return false;
          if (key === PERMISSIONS_KEY) return [];
          if (key === 'requiredFeatures') return ['reports.valuation'];
          return undefined;
        },
      } as never,
      prisma: {
        user: {
          findUnique: vi.fn(async () => ({
            id: 1,
            active: true,
            companyId: 1,
            company: { status: 'ACTIVE' },
          })),
        },
        systemFeature: {
          findUnique: vi.fn(async () => ({ id: 1, code: 'reports.valuation', enabled: false })),
        },
        userFeature: { findUnique: vi.fn(async () => null) },
        companyFeature: { findUnique: vi.fn(async () => null) },
      } as never,
    });
    const { ctx } = makeContext({ header: 'Bearer abc' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects 401 when a refresh token is used for access', async () => {
    const guard = makeGuard({
      jwt: {
        verifyAsync: vi.fn(async () => ({ sub: 1, typ: 'refresh' })),
      } as never,
    });
    const { ctx } = makeContext({ header: 'Bearer refresh' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects 403 when a global token hits a tenant endpoint', async () => {
    const guard = makeGuard({
      jwt: {
        verifyAsync: vi.fn(async () => ({
          scope: 'global',
          sub: 9,
          name: 'g',
          username: 'root',
          permissions: [],
        })),
      } as never,
    });
    const { ctx } = makeContext({ header: 'Bearer g' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });
});