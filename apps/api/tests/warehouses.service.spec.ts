import { describe, expect, it } from 'vitest';
import { WarehousesService } from '../src/warehouses/warehouses.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { AuditLogsService } from '../src/audit-logs/audit-logs.service.js';

const makeAudits = () => ({ write: async () => {} }) as unknown as AuditLogsService;

function makePrisma(total = 0) {
  const captured: { findMany?: { skip?: number; take?: number; where?: unknown } } = {};
  const prisma = {
    warehouse: {
      findMany: async (a: { skip?: number; take?: number; where?: unknown }) => {
        captured.findMany = a;
        return [] as never;
      },
      count: async () => total as never,
    },
  } as unknown as PrismaService;
  return { prisma, captured };
}

describe('WarehousesService.list — ترقيم الصفحات (يمنع 400 على limit)', () => {
  it('يطبّق skip/take من page/limit ويعيد حقول الترقيم', async () => {
    const { prisma, captured } = makePrisma(35);
    const svc = new WarehousesService(prisma, makeAudits());
    const res = await svc.list({ page: 2, limit: 10 }, 1);
    expect(captured.findMany?.skip).toBe(10);
    expect(captured.findMany?.take).toBe(10);
    expect(res).toMatchObject({ total: 35, page: 2, limit: 10, pages: 4 });
  });

  it('يعيد القيم الافتراضية (page=1, limit=20) دون معاملات', async () => {
    const { prisma, captured } = makePrisma(5);
    const svc = new WarehousesService(prisma, makeAudits());
    const res = await svc.list({}, 1);
    expect(captured.findMany?.skip).toBe(0);
    expect(captured.findMany?.take).toBe(20);
    expect(res).toMatchObject({ page: 1, limit: 20, pages: 1 });
  });

  it('يحدّ limit الأقصى عند 100', async () => {
    const { prisma, captured } = makePrisma(300);
    const svc = new WarehousesService(prisma, makeAudits());
    const res = await svc.list({ limit: 500 }, 1);
    expect(captured.findMany?.take).toBe(100);
    expect(res.limit).toBe(100);
  });
});
