import { describe, expect, it, vi } from 'vitest';
import { SyncService } from '../src/sync/sync.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { AuthUser } from '../src/auth/auth.decorators.js';
import type { PushDto } from '../src/sync/sync.dto.js';

const baseUser = {
  id: 7,
  sub: 7,
  name: 'مشرف مخزن',
  roleCode: 'WAREHOUSEKEEPER',
  repCode: null,
  permissions: ['stocktake.execute'],
  maxItemDiscountPct: 100,
  maxInvoiceDiscountPct: 100,
  companyId: 1,
} as unknown as AuthUser;

function harness() {
  const calls: { id: number; counts: unknown[] }[] = [];
  const stocktakes = {
    counts: vi.fn(async (id: number, dto: { counts: unknown[] }) => {
      calls.push({ id, counts: dto.counts });
      return { id, applied: dto.counts.length };
    }),
  };
  const service = new SyncService(
    {} as unknown as PrismaService,
    {} as never,
    {} as never,
    {} as never,
    { notify: async () => {} } as never,
    {} as never,
    stocktakes as never,
    { write: async () => {} } as never,
  );
  return { service, calls, stocktakes };
}

function pushDto(payload: Record<string, unknown>): PushDto {
  return { items: [{ clientUuid: 'u1', type: 'stocktake', payload }] } as PushDto;
}

describe('SyncService.push — رفع عدّات الجرد (§5.8/§5.12)', () => {
  it('يُطبّق العدّات على الجلسة ويعيد حالة UPLOADED مع معرّف الجلسة', async () => {
    const { service, calls } = harness();
    const res = await service.push(baseUser, pushDto({ sessionId: 5, counts: [{ itemId: 11, qty: 3 }] }));
    expect(res.results[0]).toMatchObject({ clientUuid: 'u1', status: 'UPLOADED', serverId: 5 });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.id).toBe(5);
    expect(calls[0]!.counts[0]).toEqual({ itemId: 11, batchId: '', qty: 3 });
  });

  it('يدعم qtyBase ولون الدفعة', async () => {
    const { service, calls } = harness();
    await service.push(baseUser, pushDto({ sessionId: 9, counts: [{ itemId: 4, qtyBase: 12.5, batchId: 'B1' }] }));
    expect(calls[0]!.counts[0]).toEqual({ itemId: 4, batchId: 'B1', qty: 12.5 });
  });

  it('يرفض الرفع بلا صلاحية تنفيذ الجرد', async () => {
    const { service, calls } = harness();
    const res = await service.push(
      { ...baseUser, permissions: [] } as unknown as AuthUser,
      pushDto({ sessionId: 5, counts: [{ itemId: 11, qty: 3 }] }),
    );
    expect(res.results[0]!.status).toBe('PENDING_REVIEW');
    expect(calls).toHaveLength(0);
  });

  it('يرفض payload بلا sessionId أو بلا بنود', async () => {
    const { service } = harness();
    const r1 = await service.push(baseUser, pushDto({ counts: [{ itemId: 11, qty: 3 }] }));
    expect(r1.results[0]!.status).toBe('PENDING_REVIEW');
    const r2 = await service.push(baseUser, pushDto({ sessionId: 5, counts: [] }));
    expect(r2.results[0]!.status).toBe('PENDING_REVIEW');
  });
});
