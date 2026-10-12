import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { DeviceGuard } from '../src/auth/device.guard.js';
import { SKIP_DEVICE_KEY, type AuthUser } from '../src/auth/auth.decorators.js';
import { currentCompanyId, runWithTenant } from '../src/tenant/tenant.context.js';

const USER: AuthUser = {
  id: 2,
  sub: 2,
  name: 'مندوب',
  roleCode: 'SALES_REP',
  repCode: 'M03',
  permissions: ['sync.use'],
  maxItemDiscountPct: 0,
  maxInvoiceDiscountPct: 0,
  companyId: 1,
};

function makeContext(overrides: { deviceId?: string; user?: AuthUser | undefined } = {}): {
  ctx: ExecutionContext;
  request: Record<string, unknown>;
} {
  const handler = (): void => {};
  const klass = class Foo {};
  const request: Record<string, unknown> = {
    headers: { 'x-device-id': overrides.deviceId },
    user: 'user' in overrides ? overrides.user : USER,
  };
  const ctx = {
    getHandler: () => handler,
    getClass: () => klass,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

function makeGuard(overrides: {
  skip?: boolean;
  device?: { id: number; deviceId: string; active: boolean } | null;
} = {}): { guard: DeviceGuard; update: ReturnType<typeof vi.fn> } {
  const reflector = {
    getAllAndOverride: (key: string) => (key === SKIP_DEVICE_KEY ? overrides.skip : undefined),
  } as unknown as Reflector;

  const device = 'device' in overrides
    ? overrides.device
    : { id: 7, deviceId: 'dev-1', active: true };
  const update = vi.fn(async () => device);
  const prisma = {
    deviceRegistration: {
      findFirst: vi.fn(async () => device),
      update,
    },
  } as never;

  return { guard: new DeviceGuard(reflector, prisma as never), update };
}

describe('DeviceGuard', () => {
  it('skips the device check on exempt (bootstrap) routes', async () => {
    const { guard } = makeGuard({ skip: true });
    const { ctx } = makeContext();
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects 400 when the X-Device-Id header is missing', async () => {
    const { guard } = makeGuard();
    const { ctx } = makeContext();
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects 400 when there is no authenticated user', async () => {
    const { guard } = makeGuard();
    const { ctx } = makeContext({ deviceId: 'dev-1', user: undefined });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects 403 when the device is not registered for the user', async () => {
    const { guard } = makeGuard({ device: null });
    const { ctx } = makeContext({ deviceId: 'dev-1' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects 403 when the device was revoked (inactive)', async () => {
    const { guard } = makeGuard({ device: { id: 7, deviceId: 'dev-1', active: false } });
    const { ctx } = makeContext({ deviceId: 'dev-1' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts an active device, attaches it to the request and touches lastSeenAt', async () => {
    const { guard, update } = makeGuard();
    const { ctx, request } = makeContext({ deviceId: 'dev-1' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.device).toEqual({ id: 7, deviceId: 'dev-1' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 7 }, data: expect.objectContaining({ lastSeenAt: expect.any(Date) }) }),
    );
  });

  // Guards run before TenantContextInterceptor, so the RLS tenant GUC is not yet set
  // by the interceptor. This mirrors RLS: the row is only visible when the guard
  // pins the tenant context itself (regression for the "sync always 403" bug).
  it('reads the device under the user tenant context (RLS-visible)', async () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const prisma = {
      deviceRegistration: {
        // Defer like Prisma: the tenant GUC is read when the query coroutine runs,
        // not at call time — so a scoped run() would already have exited.
        findFirst: vi.fn(() =>
          Promise.resolve().then(() =>
            currentCompanyId() === 1 ? { id: 7, deviceId: 'dev-1', active: true } : null,
          ),
        ),
        update: vi.fn(() => Promise.resolve({})),
      },
    } as never;
    const guard = new DeviceGuard(reflector, prisma as never);
    const { ctx } = makeContext({ deviceId: 'dev-1' });
    await runWithTenant({ companyId: null }, () => guard.canActivate(ctx)).then((ok) =>
      expect(ok).toBe(true),
    );
  });
});
