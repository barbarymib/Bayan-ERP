import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../src/auth/auth.guard.js';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY, type AuthUser } from '../src/auth/auth.decorators.js';

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

  return new AuthGuard(reflector, jwt, prisma as never);
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