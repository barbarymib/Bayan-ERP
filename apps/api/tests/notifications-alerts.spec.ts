import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import { NoopPushProvider } from '../src/common/push.noop.js';
import { resolveAlertsIntervalMs } from '../src/notifications/notifications.scheduler.js';
import { NotificationsScheduler } from '../src/notifications/notifications.scheduler.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';

describe('resolveAlertsIntervalMs — مجدول التنبيهات (G23 §5.15)', () => {
  it('يعطّل في بيئة الاختبار', () => {
    expect(resolveAlertsIntervalMs({ NODE_ENV: 'test' })).toBeNull();
  });

  it('يوفر ساعة افتراضية', () => {
    expect(resolveAlertsIntervalMs({})).toBe(3_600_000);
  });

  it('يقبل قيمة مخصصة ويفرض حداً أدنى دقيقة', () => {
    expect(resolveAlertsIntervalMs({ ALERTS_INTERVAL_MS: '300000' })).toBe(300000);
    expect(resolveAlertsIntervalMs({ ALERTS_INTERVAL_MS: '1000' })).toBe(60000);
  });

  it('يعطّل عند off/false ويرفض غير الرقمي', () => {
    expect(resolveAlertsIntervalMs({ ALERTS_INTERVAL_MS: 'off' })).toBeNull();
    expect(resolveAlertsIntervalMs({ ALERTS_INTERVAL_MS: 'false' })).toBeNull();
    expect(resolveAlertsIntervalMs({ ALERTS_INTERVAL_MS: 'abc' })).toBeNull();
  });
});

describe('NotificationsScheduler.runAll — شركة لكل سياق (G23)', () => {
  it('يشغّل refreshAlerts لكل شركة ويرجّع نتائجها', async () => {
    const prisma = {
      company: { findMany: async () => [{ id: 1 }, { id: 2 }] },
    } as unknown as PrismaService;
    const notifications = {
      refreshAlerts: vi.fn(async (companyId: number | null) => ({ low_stock: companyId ?? 0 })),
    } as unknown as NotificationsService;
    const scheduler = new NotificationsScheduler(prisma, notifications);
    const out = await scheduler.runAll();
    expect(Object.keys(out)).toEqual(['1', '2']);
    expect(vi.mocked(notifications.refreshAlerts).mock.calls).toEqual([[1], [2]]);
  });

  it('يعزل فشل شركة عن الأخرى', async () => {
    const prisma = {
      company: { findMany: async () => [{ id: 1 }, { id: 2 }] },
    } as unknown as PrismaService;
    const notifications = {
      refreshAlerts: vi.fn(async (companyId: number | null) => {
        if (companyId === 1) throw new Error('boom');
        return { ok: true };
      }),
    } as unknown as NotificationsService;
    const scheduler = new NotificationsScheduler(prisma, notifications);
    const out = await scheduler.runAll();
    expect(out['2']).toEqual({ ok: true });
    expect(out['1']).toBeUndefined();
  });
});

describe('NotificationsService.refreshAlerts — جمع قابل للتوسّع (G25/R3-E8)', () => {
  it('يجمع الأصناف تحت الحد عبر استعلام خام (بلا groupBy على قائمة معرّفات)', async () => {
    const created: unknown[] = [];
    const prisma = {
      notification: {
        findFirst: async () => null,
        create: async (args: { data: unknown }) => {
          created.push(args.data);
          return args.data;
        },
      },
      $queryRaw: async (strings: TemplateStringsArray) => {
        const sql = strings.join('?');
        if (sql.includes('FROM "Item"')) {
          return [{ id: 5, code: 'IR-16', nameAr: 'حديد', minStock: 10, qty: 3 }];
        }
        return [];
      },
      customer: { findMany: async () => [] },
      approval: { count: async () => 0 },
      archiveRun: { findFirst: async () => null },
      automatedBackup: { findFirst: async () => null },
      user: { findMany: async () => [{ id: 99 }] },
      deviceRegistration: { findMany: async () => [], updateMany: async () => ({ count: 0 }) },
      item: {
        findMany: () => {
          throw new Error('refreshAlerts must not load all items (param-limit bug)');
        },
      },
    } as unknown as PrismaService;
    const svc = new NotificationsService(prisma, new NoopPushProvider());
    const out = await svc.refreshAlerts(1);
    expect(out.low_stock).toBe(1);
    expect(created[0]).toMatchObject({ userId: 99, type: 'low_stock' });
    expect(String((created[0] as { title: string }).title)).toContain('1');
  });
});
