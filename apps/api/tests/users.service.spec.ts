import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { UsersService } from '../src/users/users.service.js';
import type { AuditLogsService } from '../src/audit-logs/audit-logs.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';

interface UserRow {
  id: number;
  companyId: number | null;
  name: string;
  role: { code: string; nameAr: string };
  active: boolean;
}

type Captured = Record<string, unknown>;

function harness(users: UserRow[] = []) {
  let createArgs: Captured | null = null;
  let listArgs: Captured | null = null;
  let countArgs: Captured | null = null;

  const match = (where: Record<string, unknown>, u: UserRow): boolean => {
    if (where.id !== undefined && where.id !== u.id) return false;
    if (where.companyId !== undefined && where.companyId !== u.companyId) return false;
    return true;
  };

  const prisma = {
    role: { findUnique: async ({ where }: { where: { code: string } }) => ({ id: 3, code: where.code }) },
    branch: { findFirst: async () => null },
    user: {
      create: async (args: Captured) => {
        createArgs = args;
        const data = args.data as Record<string, unknown>;
        return {
          id: 99,
          companyId: data.companyId ?? null,
          name: data.name as string,
          role: { code: 'ACCOUNTANT', nameAr: 'محاسب' },
          maxItemDiscountPct: 0,
          maxInvoiceDiscountPct: 0,
          active: true,
          branchId: null,
        };
      },
      findMany: async (args: Captured) => {
        listArgs = args;
        return [];
      },
      count: async (args: Captured) => {
        countArgs = args;
        return 2;
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const found = users.find((u) => match(where, u));
        return found ?? null;
      },
      update: async ({ where }: { where: { id: number } }) => ({
        id: where.id,
        companyId: 7,
        name: 'U',
        role: { code: 'ACCOUNTANT', nameAr: 'محاسب' },
        maxItemDiscountPct: 0,
        maxInvoiceDiscountPct: 0,
        active: true,
        branchId: null,
      }),
    },
  } as unknown as PrismaService;

  const audits = { write: async () => undefined } as unknown as AuditLogsService;
  const svc = new UsersService(prisma, audits);
  return {
    svc,
    get createArgs() {
      return createArgs;
    },
    get listArgs() {
      return listArgs;
    },
    get countArgs() {
      return countArgs;
    },
  };
}

describe('UsersService tenant scoping (R3-A1)', () => {
  it('يعيّن companyId عند إنشاء مستخدم', async () => {
    const h = harness();
    await h.svc.create(
      { name: 'أ', email: 'a@b.c', password: 'secret123', roleCode: 'ACCOUNTANT' },
      1,
      7,
    );
    expect((h.createArgs?.data as Record<string, unknown>).companyId).toBe(7);
  });

  it('يقيّد قائمة المستخدمين بالشركة', async () => {
    const h = harness();
    await h.svc.list({} as never, 7);
    expect(h.listArgs?.where).toMatchObject({ companyId: 7 });
  });

  it('لا يعيد قائمة مقيّدة عندما تكون الشركة غير محددة (توافق خلفي)', async () => {
    const h = harness();
    await h.svc.list({} as never, null);
    expect(h.listArgs?.where).not.toHaveProperty('companyId');
  });

  it('يرفض قراءة مستخدم من شركة أخرى', async () => {
    const h = harness([
      { id: 1, companyId: 7, name: 'A', role: { code: 'ACCOUNTANT', nameAr: 'محاسب' }, active: true },
      { id: 2, companyId: 9, name: 'B', role: { code: 'ACCOUNTANT', nameAr: 'محاسب' }, active: true },
    ]);
    await expect(h.svc.findOne(2, 7)).rejects.toThrow(NotFoundException);
    await expect(h.svc.findOne(2, 9)).resolves.toBeTruthy();
  });

  it('يرفض تعديل مستخدم من شركة أخرى', async () => {
    const h = harness([
      { id: 2, companyId: 9, name: 'B', role: { code: 'ACCOUNTANT', nameAr: 'محاسب' }, active: true },
    ]);
    await expect(h.svc.update(2, {}, 1, 7)).rejects.toThrow(NotFoundException);
  });

  it('يرفض إيقاف مستخدم من شركة أخرى ويقيّد عدّ المسؤولين بالشركة', async () => {
    const h = harness([
      { id: 5, companyId: 9, name: 'B', role: { code: 'ADMIN', nameAr: 'مدير' }, active: true },
    ]);
    await expect(h.svc.remove(5, 1, true, 7)).rejects.toThrow(NotFoundException);

    const h2 = harness([
      { id: 6, companyId: 7, name: 'C', role: { code: 'ADMIN', nameAr: 'مدير' }, active: true },
    ]);
    await h2.svc.remove(6, 1, true, 7);
    expect(h2.countArgs?.where).toMatchObject({ companyId: 7, active: true });
  });
});
