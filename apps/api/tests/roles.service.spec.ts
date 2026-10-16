import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { UsersService } from '../src/users/users.service.js';
import type { AuditLogsService } from '../src/audit-logs/audit-logs.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';

interface CatalogRow {
  id: number;
  code: string;
  nameAr: string;
}

interface RoleRow {
  id: number;
  code: string;
  nameAr: string;
  maxItemDiscountPct?: number | null;
  maxInvoiceDiscountPct?: number | null;
  permissions: { permission: { code: string } }[];
}

interface AuditCall {
  action: string;
  entity: string;
  entityId: number;
  beforeJson?: Record<string, unknown>;
  afterJson?: Record<string, unknown>;
}

type Options = {
  role?: RoleRow | null;
  catalog?: CatalogRow[];
};

function harness(opts: Options = {}) {
  const catalog: CatalogRow[] =
    opts.catalog ?? [
      { id: 1, code: 'statement.create', nameAr: 'إنشاء بيان' },
      { id: 2, code: 'report.view', nameAr: 'التقارير' },
    ];
  const role: RoleRow | null =
    'role' in opts
      ? opts.role ?? null
      : { id: 5, code: 'ACCOUNTANT', nameAr: 'محاسب', permissions: [{ permission: { code: 'report.view' } }] };

  const deletes: unknown[] = [];
  const creates: { data: { roleId: number; permissionId: number }[] }[] = [];

  const prisma = {
    role: {
      findUnique: async () => role,
      update: async (args: { where: { id: number }; data: Record<string, unknown> }) => ({
        ...role,
        ...args.data,
      }),
    },
    permission: {
      findMany: async (args: { where?: { code: { in: string[] } } }) => {
        if (args.where) {
          const wanted = args.where.code.in;
          return catalog.filter((p) => wanted.includes(p.code));
        }
        return catalog;
      },
    },
    rolePermission: {
      deleteMany: async (args: unknown) => {
        deletes.push(args);
        return { count: 0 };
      },
      createMany: async (args: { data: { roleId: number; permissionId: number }[] }) => {
        creates.push(args);
        return { count: args.data.length };
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  } as unknown as PrismaService;

  const calls: AuditCall[] = [];
  const audits = {
    write: async (input: AuditCall) => {
      calls.push(input);
    },
  } as unknown as AuditLogsService;

  return { svc: new UsersService(prisma, audits), deletes, creates, calls };
}

describe('UsersService.listPermissions', () => {
  it('يعيد كتالوج الصلاحيات كاملاً', async () => {
    const { svc } = harness();
    const rows = await svc.listPermissions();
    expect(rows.map((r) => r.code)).toEqual(['statement.create', 'report.view']);
  });
});

describe('UsersService.updateRolePermissions', () => {
  it('يستبدل صلاحيات الدور ويسجّل تدقيقاً قبل/بعد', async () => {
    const { svc, deletes, creates, calls } = harness();
    const res = await svc.updateRolePermissions(5, ['statement.create', 'report.view'], 99);

    expect(deletes).toHaveLength(1);
    expect(creates[0]!.data.map((d) => d.permissionId).sort()).toEqual([1, 2]);
    expect(res.permissions.map((p) => p.code).sort()).toEqual(['report.view', 'statement.create']);
    expect(calls[0]!.action).toBe('role.permissions');
    expect(calls[0]!.entityId).toBe(5);
    expect(calls[0]!.beforeJson?.permissions).toEqual(['report.view']);
    expect(calls[0]!.afterJson?.permissions).toEqual(['report.view', 'statement.create']);
  });

  it('يرفض تعديل دور ADMIN المحمي', async () => {
    const { svc } = harness({
      role: { id: 1, code: 'ADMIN', nameAr: 'مدير', permissions: [] },
    });
    await expect(svc.updateRolePermissions(1, ['report.view'])).rejects.toThrow(BadRequestException);
  });

  it('يرفض كود صلاحية غير معروف', async () => {
    const { svc } = harness();
    await expect(svc.updateRolePermissions(5, ['does.not.exist'])).rejects.toThrow(BadRequestException);
  });

  it('يرمي NotFound لدور غير موجود', async () => {
    const { svc } = harness({ role: null });
    await expect(svc.updateRolePermissions(404, ['report.view'])).rejects.toThrow(NotFoundException);
  });
});

describe('UsersService.updateRoleLimits', () => {
  it('يضبط حدّي الدور ويسجّل تدقيقاً قبل/بعد (§4.2)', async () => {
    const { svc, calls } = harness();
    const res = await svc.updateRoleLimits(5, { maxItemDiscountPct: 7, maxInvoiceDiscountPct: 12 }, 42);
    expect(res.maxItemDiscountPct).toBe(7);
    expect(res.maxInvoiceDiscountPct).toBe(12);
    expect(res.permissions.map((p) => p.code)).toEqual(['report.view']);
    expect(calls[0]!.action).toBe('role.limits');
    expect(calls[0]!.entityId).toBe(5);
    expect(calls[0]!.afterJson).toEqual({ roleCode: 'ACCOUNTANT', maxItemDiscountPct: 7, maxInvoiceDiscountPct: 12 });
  });

  it('يمسح الحد عند تمرير null (fallback لحد المستخدم)', async () => {
    const { svc, calls } = harness({
      role: {
        id: 5,
        code: 'ACCOUNTANT',
        nameAr: 'محاسب',
        maxItemDiscountPct: 4,
        maxInvoiceDiscountPct: 6,
        permissions: [],
      },
    });
    const res = await svc.updateRoleLimits(5, { maxItemDiscountPct: null });
    expect(res.maxItemDiscountPct).toBeNull();
    expect(res.maxInvoiceDiscountPct).toBe(6);
    expect(calls[0]!.beforeJson).toEqual({ roleCode: 'ACCOUNTANT', maxItemDiscountPct: 4, maxInvoiceDiscountPct: 6 });
    expect(calls[0]!.afterJson).toEqual({ roleCode: 'ACCOUNTANT', maxItemDiscountPct: null, maxInvoiceDiscountPct: 6 });
  });

  it('يرفض تعديل دور ADMIN المحمي', async () => {
    const { svc } = harness({ role: { id: 1, code: 'ADMIN', nameAr: 'مدير', permissions: [] } });
    await expect(svc.updateRoleLimits(1, { maxItemDiscountPct: 10 })).rejects.toThrow(BadRequestException);
  });

  it('يرفض جسمًا فارغًا', async () => {
    const { svc } = harness();
    await expect(svc.updateRoleLimits(5, {})).rejects.toThrow(BadRequestException);
  });

  it('يرمي NotFound لدور غير موجود', async () => {
    const { svc } = harness({ role: null });
    await expect(svc.updateRoleLimits(404, { maxItemDiscountPct: 1 })).rejects.toThrow(NotFoundException);
  });
});
