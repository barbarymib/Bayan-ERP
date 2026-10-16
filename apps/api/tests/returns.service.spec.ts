import { describe, expect, it } from 'vitest';
import { ReturnsService } from '../src/returns/returns.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { AuthUser } from '../src/auth/auth.decorators.js';
import type { CreateReturnDto } from '../src/returns/returns.dto.js';

interface Captured {
  approval: Record<string, unknown>[];
  finalize: number[];
  createdStatus: string | null;
}

function makeService(opts: { setting?: string | null } = {}) {
  const captured: Captured = { approval: [], finalize: [], createdStatus: null };
  const settings: Record<string, string> = {};
  if (opts.setting !== undefined && opts.setting !== null) settings['return.rep.approval.required'] = opts.setting;

  let created: { id: number; companyId: number | null; status: string } = { id: 99, companyId: 1, status: 'DRAFT' };
  const prisma = {
    customer: { findUnique: async () => ({ id: 1, nameAr: 'عميل تجريبي', companyId: 1 }) },
    customerRepAssignment: { findFirst: async () => ({ id: 1 }) },
    returnReason: { findUnique: async () => ({ id: 1, code: 'DEFECT', nameAr: 'عيب' }) },
    item: {
      findUnique: async () => ({ id: 5, companyId: 1, baseUnitId: 1, baseUnit: { measurement: 'WEIGHT', nameAr: 'كجم' } }),
    },
    systemSetting: {
      findUnique: async (a: { where: { key: string } }) => {
        const v = settings[a.where.key];
        return v === undefined ? null : { key: a.where.key, value: v };
      },
    },
    approval: {
      create: async (a: { data: Record<string, unknown> }) => {
        captured.approval.push(a.data);
        return {};
      },
    },
    returnStatement: {
      findFirst: async () => null,
      create: async (a: { data: { status: string } }) => {
        created = { id: 99, companyId: 1, status: a.data.status };
        captured.createdStatus = a.data.status;
        return created;
      },
      findUnique: async () => created,
    },
  } as unknown as PrismaService;

  const numbering = { issue: async () => 'RT-000001' } as never;
  const periods = { open: async () => ({ id: 1 }) } as never;
  const ops = {
    finalizeReturn: async (id: number) => {
      captured.finalize.push(id);
      created = { ...created, status: 'APPROVED' };
      return {};
    },
  } as never;
  const notifications = { userIdsWithPermission: async () => [2], notifyMany: async () => undefined } as never;
  const audits = { write: async () => undefined } as never;

  const service = new ReturnsService(prisma, numbering, periods, ops, notifications, audits);
  return { service, captured };
}

function repUser(perms: string[] = []): AuthUser {
  return { id: 7, companyId: 1, roleCode: 'SALES_REP', repCode: 'M03', permissions: perms } as unknown as AuthUser;
}

function adminUser(perms: string[] = []): AuthUser {
  return { id: 1, companyId: 1, roleCode: 'ADMIN', repCode: undefined, permissions: perms } as unknown as AuthUser;
}

function dto(mode: 'BY_REP' | 'BY_CUSTOMER' = 'BY_REP'): CreateReturnDto {
  return {
    mode,
    customerId: 1,
    reasonCode: 'DEFECT',
    withoutStatement: true,
    settlement: 'BALANCE',
    lines: [{ itemId: 5, unitPrice: 40, qty: 2, condition: 'GOOD' }],
  } as CreateReturnDto;
}

const BASE = ['return.without_statement'];

describe('ReturnsService — اعتماد مرتجع المندوب (§5.9.6)', () => {
  it('مندوب + الإعداد مطلوب (افتراضي/غير معرّف) → ينشئ طلب اعتماد ولا يُرحّل', async () => {
    const { service, captured } = makeService({ setting: undefined });
    await service.create(dto(), repUser(BASE));
    expect(captured.approval).toHaveLength(1);
    expect(captured.approval[0]!.status).toBe('PENDING');
    expect(captured.finalize).toHaveLength(0);
    expect(captured.createdStatus).toBe('DRAFT');
  });

  it('مندوب + الإعداد false → يُرحّل مباشرة بلا اعتماد', async () => {
    const { service, captured } = makeService({ setting: 'false' });
    await service.create(dto(), repUser(BASE));
    expect(captured.approval).toHaveLength(0);
    expect(captured.finalize).toEqual([99]);
  });

  it('مندوب مُصرَّح له return.approve + الإعداد مطلوب → اعتماد ذاتي (دون طلب)', async () => {
    const { service, captured } = makeService({ setting: 'true' });
    await service.create(dto(), repUser([...BASE, 'return.approve']));
    expect(captured.approval).toHaveLength(0);
    expect(captured.finalize).toEqual([99]);
  });

  it('غير مندوب (بلا return.approve) → طلب اعتماد كما قبل (لا يتأثر بالإعداد)', async () => {
    const { service, captured } = makeService({ setting: 'false' });
    await service.create(dto('BY_CUSTOMER'), adminUser(BASE));
    expect(captured.approval).toHaveLength(1);
    expect(captured.finalize).toHaveLength(0);
  });

  it('مندوب + الإعداد صريح true → طلب اعتماد', async () => {
    const { service, captured } = makeService({ setting: 'true' });
    await service.create(dto(), repUser(BASE));
    expect(captured.approval).toHaveLength(1);
    expect(captured.finalize).toHaveLength(0);
  });
});
