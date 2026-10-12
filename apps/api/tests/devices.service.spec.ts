import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DevicesService } from '../src/devices/devices.service.js';

function makeService(overrides: {
  findMany?: (args: unknown) => Promise<unknown>;
  findFirst?: (args: unknown) => Promise<unknown>;
} = {}): {
  service: DevicesService;
  findMany: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn(overrides.findMany ?? (async () => []));
  const findFirst = vi.fn(overrides.findFirst ?? (async () => null));
  const update = vi.fn(async () => ({ id: 7, active: false }));
  const write = vi.fn(async () => undefined);
  const prisma = {
    deviceRegistration: { findMany, findFirst, update },
  } as never;
  const audits = { write } as never;
  return { service: new DevicesService(prisma as never, audits as never), findMany, findFirst, update, write };
}

describe('DevicesService', () => {
  it('list scopes by tenant and includes the user summary', async () => {
    const { service, findMany } = makeService();
    await service.list(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 1 } }),
    );
  });

  it('list with no company id is unscoped', async () => {
    const { service, findMany } = makeService();
    await service.list(null);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('revoke sets active=false and writes an audit entry', async () => {
    const { service, update, write } = makeService({
      findFirst: async () => ({ id: 7, active: true, deviceId: 'dev-1' }),
    });
    await service.setActive(7, false, 1, 'root');
    expect(update).toHaveBeenCalledWith({ where: { id: 7 }, data: { active: false } });
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'device.revoke', entityId: 7 }),
    );
  });

  it('activate writes device.activate', async () => {
    const { service, write } = makeService({
      findFirst: async () => ({ id: 7, active: false, deviceId: 'dev-1' }),
    });
    await service.setActive(7, true, 1);
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ action: 'device.activate' }));
  });

  it('throws 404 when the device is not found in the company', async () => {
    const { service } = makeService({ findFirst: async () => null });
    await expect(service.setActive(99, false, 1)).rejects.toBeInstanceOf(NotFoundException);
  });
});
