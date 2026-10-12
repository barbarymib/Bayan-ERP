import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PriceStatementsService } from '../src/price-statements/price-statements.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { NumberingService } from '../src/numbering.service.js';
import type { PeriodsService } from '../src/common/periods.service.js';
import type { LedgerService } from '../src/common/ledger.service.js';
import type { SalesOpsService } from '../src/common/sales-ops.service.js';
import type { StockService } from '../src/common/stock.service.js';
import type { PriceResolverService } from '../src/common/price-resolver.service.js';
import type { NotificationsService } from '../src/notifications/notifications.service.js';
import type { AuditLogsService } from '../src/audit-logs/audit-logs.service.js';
import type { AuthUser } from '../src/auth/auth.decorators.js';

type RevisionCall = { data: { statementId: number; revisionNo: number; reason: string | null; changedById: number } };
type LedgerCall = { accountId: number; debit?: number; credit?: number; refType?: string | null };
type AuditCall = { action: string; entity: string; entityId: number };

type Harness = {
  service: PriceStatementsService;
  calls: {
    revisions: RevisionCall[];
    restock: { lines: { itemId: number; qtyBase: number }[] }[];
    saleOut: { lines: { itemId: number; qtyBase: number }[] }[];
    ledger: LedgerCall[];
    audit: AuditCall[];
    updates: { data: Record<string, unknown> }[];
    lineCreates: { data: Record<string, unknown>[] }[];
    reservations: number[];
    finalized: boolean;
    notified: number;
  };
  st: Record<string, unknown>;
};

function makeStatement(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    companyId: 1,
    status: 'APPROVED',
    customerId: 2,
    warehouseId: 3,
    repId: null,
    number: 'BP-000007',
    date: new Date('2026-10-01'),
    paymentTerm: 'CREDIT',
    paid: 0,
    net: 100,
    subtotal: 100,
    discountType: null,
    discountValue: null,
    discountAmount: 0,
    shipping: 0,
    taxPercent: 0,
    taxAmount: 0,
    notes: null,
    lines: [
      {
        itemId: 5,
        unitId: 6,
        factor: 1,
        qty: 2,
        qtyBase: 2,
        unitPrice: 50,
        lineDiscountType: null,
        lineDiscountValue: null,
        lineDiscountAmount: 0,
        allocatedHeaderDiscount: 0,
        netLine: 100,
        costSnapshot: 40,
        item: { id: 5, code: 'IR', lastPurchaseCost: 40 },
        unit: { id: 6, code: 'PCS' },
      },
    ],
    ...overrides,
  };
}

function harness(stOverrides: Record<string, unknown> = {}, maxRevision: number | null = null): Harness {
  const st = makeStatement(stOverrides);
  const calls: Harness['calls'] = {
    revisions: [],
    restock: [],
    saleOut: [],
    ledger: [],
    audit: [],
    updates: [],
    lineCreates: [],
    reservations: [],
    finalized: false,
    notified: 0,
  };

  const tx = {
    statementRevision: {
      aggregate: async () => ({ _max: { revisionNo: maxRevision } }),
      create: async (args: RevisionCall) => {
        calls.revisions.push(args);
        return { id: calls.revisions.length, ...args.data };
      },
    },
    priceStatementLine: {
      deleteMany: async () => ({ count: 1 }),
      createMany: async (args: { data: Record<string, unknown>[] }) => {
        calls.lineCreates.push(args);
        return { count: args.data.length };
      },
    },
    priceStatement: {
      update: async (args: { data: Record<string, unknown> }) => {
        calls.updates.push(args);
        return { ...st, ...args.data };
      },
    },
    approval: { updateMany: async () => ({ count: 0 }), createMany: async () => ({ count: 0 }) },
  };

  const prisma = {
    priceStatement: { findUnique: async () => st },
    customer: { findUnique: async () => ({ id: 2, nameAr: 'عميل', priceListId: null, companyId: 1 }) },
    warehouse: {
      findFirst: async () => ({ id: 3, code: 'MAIN', companyId: 1 }),
      findUnique: async () => ({ id: 3, code: 'MAIN', companyId: 1 }),
    },
    item: { findFirst: async () => ({ id: 5, code: 'IR', baseUnitId: 6, lastPurchaseCost: 40, active: true }) },
    unit: { findUnique: async () => ({ id: 6, code: 'PCS' }) },
    itemUnit: { findUnique: async () => null },
    approval: { findMany: async () => [] },
    statementRevision: {
      findMany: async () => calls.revisions.map((r, i) => ({ id: i + 1, ...r.data, createdAt: new Date() })),
    },
    $transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaService;

  const stock = {
    assertMovable: async () => {},
    assertSalePermitted: async () => {},
    restock: async (_tx: unknown, p: { lines: { itemId: number; qtyBase: number }[] }) => {
      calls.restock.push(p);
    },
    saleOut: async (_tx: unknown, p: { lines: { itemId: number; qtyBase: number }[] }) => {
      calls.saleOut.push(p);
    },
    releaseReservations: async () => {},
    reserve: async (_tx: unknown, _rt: string, _id: number, _wh: number, lines: unknown[]) => {
      calls.reservations.push(lines.length);
    },
  } as unknown as StockService;

  const ledger = {
    entry: async (_tx: unknown, p: LedgerCall) => {
      calls.ledger.push(p);
    },
  } as unknown as LedgerService;

  const ops = {
    finalizeStatement: async () => {
      calls.finalized = true;
      return true;
    },
  } as unknown as SalesOpsService;

  const notifications = {
    userIdsWithPermission: async () => [],
    notifyMany: async () => {
      calls.notified += 1;
    },
  } as unknown as NotificationsService;

  const audits = {
    write: async (input: AuditCall) => {
      calls.audit.push({ action: input.action, entity: input.entity, entityId: input.entityId });
    },
  } as unknown as AuditLogsService;

  const service = new PriceStatementsService(
    prisma,
    { issue: async () => 'BP-000007' } as unknown as NumberingService,
    { open: async () => null } as unknown as PeriodsService,
    ledger,
    ops,
    stock,
    { resolve: async () => 50 } as unknown as PriceResolverService,
    notifications,
    audits,
  );

  return { service, calls, st };
}

const approver = {
  id: 1,
  name: 'مدير',
  permissions: ['statement.edit', 'statement.edit_approved', 'cost.view'],
  maxItemDiscountPct: 0,
  maxInvoiceDiscountPct: 0,
  companyId: 1,
  repCode: null,
} as unknown as AuthUser;

const editor = {
  ...approver,
  permissions: ['statement.edit', 'cost.view'],
} as unknown as AuthUser;

const editDto = { customerId: 2, lines: [{ itemCode: 'IR', qty: 3, unitPrice: 50 }] };

describe('PriceStatementsService.update (G3)', () => {
  it('يرفض تعديل بيان معتمد بلا صلاحية statement.edit_approved', async () => {
    const { service } = harness({ status: 'APPROVED' });
    await expect(service.update(7, editDto, editor)).rejects.toThrow(ForbiddenException);
  });

  it('يرفض تعديل بيان معتمد له مدفوعات', async () => {
    const { service } = harness({ status: 'APPROVED', paid: 25 });
    await expect(service.update(7, editDto, approver)).rejects.toThrow(BadRequestException);
  });

  it('يرفض تعديل بيان ملغي', async () => {
    const { service } = harness({ status: 'CANCELLED' });
    await expect(service.update(7, editDto, approver)).rejects.toThrow(BadRequestException);
  });

  it('يرفض تعديل بيان غير موجود', async () => {
    const { service } = harness({ companyId: 99 });
    await expect(service.update(7, editDto, approver)).rejects.toThrow(NotFoundException);
  });

  it('يسجّل نسخة (snapshot) ويعكس ثم يعيد ترحيل الأثر عند تعديل بيان معتمد', async () => {
    const { service, calls } = harness({ status: 'APPROVED' });
    const dto = { ...editDto, reason: 'تصحيح كمية' };
    await service.update(7, dto, approver);

    // نسخة واحدة بالحالة السابقة
    expect(calls.revisions).toHaveLength(1);
    expect(calls.revisions[0]!.data).toMatchObject({
      statementId: 7,
      revisionNo: 1,
      reason: 'تصحيح كمية',
      changedById: 1,
    });

    // عكس الأثر السابق (كمية 2) ثم ترحيل الجديد (كمية 3)
    expect(calls.restock).toHaveLength(1);
    expect(calls.restock[0]!.lines).toEqual([{ itemId: 5, qtyBase: 2 }]);
    expect(calls.saleOut).toHaveLength(1);
    expect(calls.saleOut[0]!.lines).toEqual([{ itemId: 5, qtyBase: 3, cost: 40 }]);

    // قيد عكسي (دائن 100) ثم قيد جديد (مدين 150)
    const credit = calls.ledger.find((e) => e.credit);
    const debit = calls.ledger.find((e) => e.debit);
    expect(credit?.credit).toBe(100);
    expect(debit?.debit).toBe(150);

    // الحالة تبقى معتمدة + تدقيق
    const statusUpdate = calls.updates.find((u) => u.data.status === 'APPROVED');
    expect(statusUpdate).toBeDefined();
    expect(statusUpdate?.data.net).toBe(150);
    expect(calls.audit).toContainEqual({ action: 'statement.edit_approved', entity: 'PriceStatement', entityId: 7 });
  });

  it('يزيد رقم النسخة تصاعدياً', async () => {
    const { service, calls } = harness({ status: 'APPROVED' }, 2);
    await service.update(7, editDto, approver);
    expect(calls.revisions[0]!.data.revisionNo).toBe(3);
  });

  it('يعدّل مسودة بصلاحية statement.edit دون تسجيل نسخة ويُرحّل الأثر', async () => {
    const { service, calls } = harness({ status: 'DRAFT', net: 100 });
    await service.update(7, editDto, editor);

    expect(calls.revisions).toHaveLength(0);
    expect(calls.finalized).toBe(true);
    expect(calls.audit).toContainEqual({ action: 'statement.edit', entity: 'PriceStatement', entityId: 7 });
    const statusUpdate = calls.updates.find((u) => u.data.status === 'DRAFT');
    expect(statusUpdate).toBeDefined();
  });

  it('يرفض تعديل مسودة بلا صلاحية statement.edit', async () => {
    const noPerms = { ...editor, permissions: ['cost.view'] } as unknown as AuthUser;
    const { service } = harness({ status: 'DRAFT' });
    await expect(service.update(7, editDto, noPerms)).rejects.toThrow(ForbiddenException);
  });

  it('يحجز ويطلب موافقة عند تجاوز حد الخصم في مسودة', async () => {
    const { service, calls } = harness({ status: 'DRAFT' });
    const dto = {
      customerId: 2,
      lines: [{ itemCode: 'IR', qty: 1, unitPrice: 50, discount: { type: 'percent' as const, value: 30 } }],
    };
    await service.update(7, dto, editor);
    expect(calls.reservations).toEqual([1]);
    expect(calls.notified).toBe(1);
    expect(calls.finalized).toBe(false);
    // لا نسخة لأنها مسودة
    expect(calls.revisions).toHaveLength(0);
  });
});
