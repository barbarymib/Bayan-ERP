import { describe, expect, it } from 'vitest';
import { haversineM, PROXIMITY_METERS, GeoService } from '../src/geo/geo.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';

function mockPrisma(overrides: Record<string, unknown> = {}): PrismaService {
  return {
    repShift: { findFirst: async () => null, create: async () => ({}), findMany: async () => [], update: async () => ({}) },
    repLocation: {
      create: async () => ({}),
      findMany: async () => [],
      findFirst: async () => null,
      deleteMany: async () => ({ count: 0 }),
    },
    repVisit: { create: async () => ({}), count: async () => 0, findMany: async () => [], findFirst: async () => null },
    customer: {
      findFirst: async () => ({ id: 1, code: 'CUST-01', nameAr: 'العميل', lat: 30.0444, lng: 31.2357, active: true }),
    },
    user: { findMany: async () => [] },
    customerRepAssignment: { findMany: async () => [] },
    deviceRegistration: { findFirst: async () => null, create: async () => ({}), update: async () => ({}) },
    ...overrides,
  } as unknown as PrismaService;
}

describe('geo Haversine', () => {
  it('يحسب المسافة صفراً في نفس النقطة', () => {
    expect(haversineM(30.0, 31.0, 30.0, 31.0)).toBe(0);
  });

  it('يعطي مسافة تقريبية لمسافة 1 كيلومتر تقريباً', () => {
    const d = haversineM(30.0, 31.0, 30.009, 31.0);
    expect(d).toBeGreaterThan(980);
    expect(d).toBeLessThan(1030);
  });
});

describe('GeoService', () => {
  it('يرفض إرسال موقع بدون وردية نشطة (§5.13 لا تتبع خارج الوردية)', async () => {
    const prisma = mockPrisma({ repShift: { findFirst: async () => null } });
    const service = new GeoService(prisma);
    await expect(service.pushLocation(2, { lat: 30, lng: 31 })).rejects.toThrow('لا توجد وردية نشطة');
  });

  it('يقبل الموقع خلال وردية نشطة ويربطه بها', async () => {
    const created: unknown[] = [];
    const prisma = mockPrisma({
      repShift: {
        findFirst: async () => ({ id: 7, repId: 2, startedAt: new Date(), endedAt: null }),
      },
      repLocation: {
        create: async (args: unknown) => {
          created.push(args);
          return args;
        },
      },
    });
    const service = new GeoService(prisma);
    await service.pushLocation(2, { lat: 30.001, lng: 31.002, battery: 80 });
    expect(created).toHaveLength(1);
  });

  it('يحسب قرب الزيارة من العميل ويُشعر بالخروج عن النطاق فوق 150م', async () => {
    const enter: { data?: Record<string, unknown> }[] = [];
    let customer = { id: 5, code: 'C', nameAr: 'ج', lat: 30.0524, lng: 31.1784, active: true };
    const prisma = mockPrisma({
      repShift: { findFirst: async () => ({ id: 1, repId: 2, startedAt: new Date(), endedAt: null }) },
      repLocation: {
        findFirst: async () => null,
        findMany: async () => [],
      },
      repVisit: {
        create: async (args: { data?: Record<string, unknown> }) => {
          enter.push(args);
          return args;
        },
      },
      customer: { findFirst: async () => customer },
    });
    const service = new GeoService(prisma);

    // نفس النقطة نوعاً ما → قريب
    const near = await service.recordVisit(2, { customerId: 5, status: 'DONE', lat: 30.0524, lng: 31.1784 });
    expect(near.proximity.outOfRange).toBe(false);

    // على بُعد ~1.5كم → خارج النطاق
    customer = { ...customer, lat: 30.0605, lng: 31.1926 };
    const far = await service.recordVisit(2, { customerId: 5, status: 'DONE', lat: 30.0524, lng: 31.1784 });
    expect(far.proximity.outOfRange).toBe(true);
    expect((far.proximity.distanceM as number) > PROXIMITY_METERS).toBe(true);
  });

  it('نظيف سجلات الموقع الأقدم من مدة الاحتفاظ', async () => {
    let cutoff: Date | undefined;
    const prisma = mockPrisma({
      repLocation: {
        deleteMany: async (args: { where: { capturedAt: { lt: Date } } }) => {
          cutoff = args.where.capturedAt.lt;
          return { count: 5 };
        },
      },
    });
    const service = new GeoService(prisma);
    const res = await service.cleanupOldLocations();
    expect(res.deleted).toBe(5);
    expect(cutoff).toBeDefined();
  });
});