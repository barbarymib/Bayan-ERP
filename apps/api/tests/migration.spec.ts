import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MigrationService } from '../src/migration/migration.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { LegacyImportDto } from '../src/migration/migration.dto.js';
import type { AuditLogsService } from '../src/audit-logs/audit-logs.service.js';
import type { BackupsService } from '../src/backups/backups.service.js';

const noopAudits = { write: async () => {} } as unknown as AuditLogsService;
const noopBackups = { runBackup: vi.fn().mockResolvedValue({ code: 'BK-TEST' }) } as unknown as BackupsService;

const payloadFixture: LegacyImportDto = {
  mode: 'MERGE',
  categories: [{ code: 'CAT1', nameAr: 'فئة' }],
  units: [{ code: 'PCS', nameAr: 'قطعة', measurement: 'COUNT' }],
  priceLists: [{ code: 'RETAIL', nameAr: 'تجزئة' }],
  warehouses: [{ code: 'WH1', nameAr: 'مخزن' }],
  items: [
    {
      code: 'ITEM1',
      nameAr: 'صنف 1',
      baseUnitCode: 'PCS',
      categoryCode: 'CAT1',
      prices: [{ priceListCode: 'RETAIL', price: 10 }],
    },
  ],
  suppliers: [{ code: 'SUP1', nameAr: 'مورد', openingBalance: 100 }],
  customers: [{ code: 'CUST1', nameAr: 'عميل', priceListCode: 'RETAIL', openingBalance: 200 }],
  openingStock: [{ itemCode: 'ITEM1', warehouseCode: 'WH1', qtyBase: 5, cost: 1 }],
} as LegacyImportDto;

type Row = Record<string, unknown>;

function makePrisma(seed: { items?: number; customers?: number; rep?: boolean } = {}) {
  const created: Record<string, Row[]> = {
    category: [],
    unit: [],
    priceList: [],
    warehouse: [],
    item: [],
    supplier: [],
    customer: [],
    customerRepAssignment: [],
  };
  const prisma = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma as never),
    category: {
      findMany: async () => [],
      create: async (a: { data: Row }) => {
        created.category?.push(a.data);
        return { id: created.category?.length ?? 0, ...a.data } as never;
      },
    },
    unit: {
      findMany: async () => [],
      create: async (a: { data: Row }) => {
        created.unit?.push(a.data);
        return { id: created.unit?.length ?? 0, ...a.data } as never;
      },
    },
    priceList: {
      findMany: async () => [],
      create: async (a: { data: Row }) => {
        created.priceList?.push(a.data);
        return { id: created.priceList?.length ?? 0, ...a.data } as never;
      },
    },
    warehouse: {
      findMany: async () => [],
        findFirst: async (a: { where: { code: string } }) => ({ id: 1, code: a.where.code }),
      create: async (a: { data: Row }) => {
        created.warehouse?.push(a.data);
        return { id: created.warehouse?.length ?? 0, code: a.data.code } as never;
      },
      update: async () => ({ id: 1 }) as never,
    },
    item: {
      findMany: async () => (seed.items ? [{ id: 1, code: 'ITEM1' }] : []),
      create: async (a: { data: Row }) => {
        created.item?.push(a.data);
        return { id: seed.items ?? created.item?.length ?? 0, ...a.data } as never;
      },
      update: async () => ({ id: 1 }) as never,
    },
    supplier: {
      findMany: async () => [],
      create: async (a: { data: Row }) => {
        created.supplier?.push(a.data);
        return { id: created.supplier?.length ?? 0, ...a.data } as never;
      },
      update: async () => ({ id: 1 }) as never,
    },
    customer: {
      findMany: async () => (seed.customers ? [{ id: 1, code: 'CUST1' }] : []),
      create: async (a: { data: Row }) => {
        created.customer?.push(a.data);
        return { id: seed.customers ?? created.customer?.length ?? 0, ...a.data } as never;
      },
      update: async () => ({ id: 1 }) as never,
    },
    user: { findMany: async () => (seed.rep ? [{ id: 42, repCode: 'M03' }] : []) },
    customerRepAssignment: {
      findFirst: async () => null,
      updateMany: async () => ({ count: 0 }) as never,
      create: async (a: { data: Row }) => {
        created.customerRepAssignment?.push(a.data);
        return { id: created.customerRepAssignment?.length ?? 0, ...a.data } as never;
      },
    },
    itemPrice: {
      findFirst: async () => null,
      create: async (a: { data: Row }) => ({ id: 1, ...a.data }) as never,
      update: async (a: { data: Row }) => ({ id: 1, ...a.data }) as never,
    },
    stockMovement: { findFirst: async () => (seed.items ? { id: 1 } : null) },
  } as unknown as PrismaService;

  return { prisma, created };
}

const stockMock = { purchaseIn: vi.fn().mockResolvedValue(undefined) };

beforeEach(() => {
  stockMock.purchaseIn.mockClear();
});

describe('MigrationService (المرحلة 7 — ترحيل البيانات)', () => {
  it('يستورد كل الأقسام ويصل رصيد المخزون الافتتاحي عبر حركة مخزنية', async () => {
    const { prisma, created } = makePrisma();
    const svc = new MigrationService(prisma, stockMock as never, noopAudits, noopBackups);
    const res = await svc.importPayload(payloadFixture, 1);

    expect(res.errors).toBe(0);
    expect(res.total).toBe(8);
    expect(res.counts.items).toBe(1);
    expect(res.counts.customers).toBe(1);
    expect(res.counts.openingStock).toBe(1);
    expect(created.item).toHaveLength(1);
    expect(created.customer).toHaveLength(1);
    expect(created.supplier?.[0]).toMatchObject({ openingBalance: 100 });
    expect(stockMock.purchaseIn).toHaveBeenCalledOnce();
    const stockArgs = stockMock.purchaseIn.mock.calls[0]?.[1] as {
      warehouseId: number;
      lines: { qtyBase: number; cost: number | null }[];
    };
    expect(stockArgs.lines[0]).toMatchObject({ qtyBase: 5, cost: 1 });
  });

  it('وضع STRICT يلغي الاستيراد كاملاً عند تكرار كود', async () => {
    const { prisma } = makePrisma({ items: 1, customers: 1 });
    const svc = new MigrationService(prisma, stockMock as never, noopAudits, noopBackups);
    await expect(
      svc.importPayload(
        { mode: 'STRICT', items: [{ code: 'ITEM1', nameAr: 'x', baseUnitCode: 'PCS' }] } as LegacyImportDto,
        1,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('وضع MERGE يحدّث الموجود بدلاً من إعادة إنشائه ولا يضاعف الرصيد الافتتاحي', async () => {
    const { prisma } = makePrisma({ items: 1, customers: 1 });
    const svc = new MigrationService(prisma, stockMock as never, noopAudits, noopBackups);
    const res = await svc.importPayload(payloadFixture, 1);
    expect(res.errors).toBe(0);
    expect(res.results.items?.[0]).toMatchObject({ action: 'UPDATED' });
    expect(res.results.customers?.[0]).toMatchObject({ action: 'UPDATED' });
    // stock لا يتكرر: الحركة موجودة مسبقاً
    expect(stockMock.purchaseIn).not.toHaveBeenCalled();
  });

  it('يُسجل صفاً تالفاً كـ SKIPPED بخطأ دون إلغاء بقية الاستيراد في وضع MERGE', async () => {
    const { prisma } = makePrisma();
    const svc = new MigrationService(prisma, stockMock as never, noopAudits, noopBackups);
    const res = await svc.importPayload(
      {
        mode: 'MERGE',
        items: [{ code: 'BROKEN', nameAr: 'صنف', baseUnitCode: 'NO-SUCH-UNIT' }],
        suppliers: [{ code: 'SUP2', nameAr: 'مورد' }],
      } as LegacyImportDto,
      1,
    );
    expect(res.errors).toBe(1);
    const row = res.results.items?.[0];
    expect(row?.action).toBe('SKIPPED');
    expect(row?.error).toContain('NO-SUCH-UNIT');
    expect(res.results.suppliers?.[0]?.action).toBe('CREATED');
  });

  it('بيعرض الموردين بالفتح في حالة عدم وجود أرقام مفردة', async () => {
    const { prisma } = makePrisma();
    const svc = new MigrationService(prisma, stockMock as never, noopAudits, noopBackups);
    const res = await svc.importPayload(
      {
        mode: 'MERGE',
        units: [{ code: 'PCS', nameAr: 'قطعة' }],
        warehouses: [{ code: 'MAIN', nameAr: 'مخزن' }],
        customers: [
          { code: 'CPX', nameAr: 'عميل بدون قائمة', creditDays: 10, openingBalance: 0 },
        ],
      } as LegacyImportDto,
      1,
    );
    expect(res.errors).toBe(0);
    expect(res.results.customers?.[0]?.action).toBe('CREATED');
  });

  it('يربط كل السجلات المستوردة بمُعرّف الشركة (عزل المستأجرين)', async () => {
    const { prisma, created } = makePrisma();
    const svc = new MigrationService(prisma, stockMock as never, noopAudits, noopBackups);
    const res = await svc.importPayload(payloadFixture, 1, 7);
    expect(res.errors).toBe(0);
    expect(created.category?.[0]).toMatchObject({ companyId: 7 });
    expect(created.priceList?.[0]).toMatchObject({ companyId: 7 });
    expect(created.warehouse?.[0]).toMatchObject({ companyId: 7 });
    expect(created.item?.[0]).toMatchObject({ companyId: 7 });
    expect(created.supplier?.[0]).toMatchObject({ companyId: 7 });
    expect(created.customer?.[0]).toMatchObject({ companyId: 7 });
    const stockArgs = stockMock.purchaseIn.mock.calls[0]?.[1] as { companyId: number };
    expect(stockArgs.companyId).toBe(7);
  });

  it('ينشئ تعيين مندوب (CustomerRepAssignment) للعميل المستورد المربوط بمندوب', async () => {
    const { prisma, created } = makePrisma({ rep: true });
    const svc = new MigrationService(prisma, stockMock as never, noopAudits, noopBackups);
    const res = await svc.importPayload(
      {
        mode: 'MERGE',
        priceLists: [{ code: 'RETAIL', nameAr: 'تجزئة' }],
        customers: [
          { code: 'CREP', nameAr: 'عميل مندوب', priceListCode: 'RETAIL', repCode: 'M03' },
        ],
      } as LegacyImportDto,
      1,
      7,
    );
    expect(res.errors).toBe(0);
    expect(created.customer?.[0]).toMatchObject({ companyId: 7, repId: 42 });
    expect(created.customerRepAssignment?.[0]).toMatchObject({
      customerId: 1,
      repId: 42,
      companyId: 7,
    });
  });

  it('يأخذ نسخة احتياطية مشفّرة قبل الترحيل ويعيد رمزها (§9)', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const runBackup = vi.fn().mockResolvedValue({ code: 'BK-20260101000000-abc123' });
      const backups = { runBackup } as unknown as BackupsService;
      const { prisma } = makePrisma();
      const svc = new MigrationService(prisma, stockMock as never, noopAudits, backups);
      const res = await svc.importPayload(payloadFixture, 1);
      expect(runBackup).toHaveBeenCalledOnce();
      expect(runBackup).toHaveBeenCalledWith(1);
      expect(res.backupCode).toBe('BK-20260101000000-abc123');
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('يتخطى النسخة الاحتياطية عند skipBackup=true', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const runBackup = vi.fn().mockResolvedValue({ code: 'BK-X' });
      const backups = { runBackup } as unknown as BackupsService;
      const { prisma } = makePrisma();
      const svc = new MigrationService(prisma, stockMock as never, noopAudits, backups);
      const res = await svc.importPayload({ skipBackup: true, ...payloadFixture }, 1);
      expect(runBackup).not.toHaveBeenCalled();
      expect(res.backupCode).toBeUndefined();
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});