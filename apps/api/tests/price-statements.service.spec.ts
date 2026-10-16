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
    approvals: { type: string; refJson?: Record<string, unknown> }[];
    finalized: boolean;
    notified: number;
    creditChecks: { customerId: number; newNet: number }[];
    statementFindMany: { where: Record<string, unknown> }[];
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

function harness(
  stOverrides: Record<string, unknown> = {},
  maxRevision: number | null = null,
  itemOverrides: Record<string, unknown> = {},
  opts: { customer?: Record<string, unknown>; blockCredit?: boolean; assignments?: number[] } = {},
): Harness {
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
    approvals: [],
    finalized: false,
    notified: 0,
    creditChecks: [],
    statementFindMany: [],
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
    approval: {
      updateMany: async () => ({ count: 0 }),
      createMany: async (args: { data: { type: string; refJson?: Record<string, unknown> }[] }) => {
        calls.approvals.push(...args.data);
        return { count: args.data.length };
      },
    },
  };

  const prisma = {
    priceStatement: {
      findUnique: async () => st,
      findMany: async (args: { where: Record<string, unknown> }) => {
        calls.statementFindMany.push(args);
        return [];
      },
      count: async () => 0,
      create: async () => ({ ...st, id: 99, lines: [] }),
    },
    customer: {
      findUnique: async () => ({ id: 2, nameAr: 'عميل', priceListId: null, companyId: 1, creditLimit: 0, openingBalance: 0, ...opts.customer }),
    },
    warehouse: {
      findFirst: async () => ({ id: 3, code: 'MAIN', companyId: 1 }),
      findUnique: async () => ({ id: 3, code: 'MAIN', companyId: 1 }),
    },
    item: {
      findFirst: async () => ({
        id: 5,
        code: 'IR',
        baseUnitId: 6,
        lastPurchaseCost: 40,
        active: true,
        baseUnit: { measurement: 'COUNT', nameAr: 'قطعة' },
        ...itemOverrides,
      }),
    },
    unit: { findUnique: async () => ({ id: 6, code: 'PCS' }) },
    itemUnit: { findUnique: async () => null },
    approval: { findMany: async () => [] },
    customerRepAssignment: {
      findMany: async () => (opts.assignments ?? []).map((customerId) => ({ customerId })),
      findFirst: async (args: { where?: { customerId?: number } } = {}) =>
        (opts.assignments ?? []).includes(args.where?.customerId ?? -1) ? { id: 1 } : null,
    },
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
    balanceOf: async () => ({ debit: 0, credit: 0 }),
  } as unknown as LedgerService;

  const ops = {
    finalizeStatement: async () => {
      calls.finalized = true;
      return true;
    },
    assertCustomerCredit: async (customerId: number, newNet: number) => {
      calls.creditChecks.push({ customerId, newNet });
      if (opts.blockCredit) throw new BadRequestException('تجاوز الحد الائتماني');
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

describe('PriceStatementsService pricing floor & conversion (G7)', () => {
  it('يرفع طلب موافقة BELOW_MIN_PRICE وينبّه عند البيع تحت الحد الأدنى', async () => {
    const { service, calls } = harness({ status: 'DRAFT' }, null, { lastPurchaseCost: null, minSalePrice: 60 });
    const res = (await service.update(
      7,
      { customerId: 2, lines: [{ itemCode: 'IR', qty: 1, unitPrice: 50 }] },
      editor,
    )) as unknown as { pricingAlerts: unknown[] };

    expect(calls.approvals.map((a) => a.type)).toContain('BELOW_MIN_PRICE');
    expect(calls.reservations).toEqual([1]);
    expect(calls.finalized).toBe(false);
    expect(res.pricingAlerts).toEqual([{ type: 'below_min_price', itemCode: 'IR', unitPrice: 50, threshold: 60 }]);
  });

  it('لا يرفع طلباً ولا ينبّه عندما يكون السعر عند الحد الأدنى أو أعلى', async () => {
    const { service, calls } = harness({ status: 'DRAFT' }, null, { lastPurchaseCost: null, minSalePrice: 50 });
    const res = (await service.update(
      7,
      { customerId: 2, lines: [{ itemCode: 'IR', qty: 1, unitPrice: 50 }] },
      editor,
    )) as unknown as { pricingAlerts: unknown[] };

    expect(calls.approvals).toHaveLength(0);
    expect(calls.finalized).toBe(true);
    expect(res.pricingAlerts).toEqual([]);
  });

  it('يحوّل خصم البند بالقيمة إلى نسبة ويفحص الحد (نوع-مستقل §5.3)', async () => {
    const { service, calls } = harness({ status: 'DRAFT' }, null, { lastPurchaseCost: null, minSalePrice: null });
    // خصم قيمة 30 على بند 50 = 60% > حد 0
    await service.update(
      7,
      { customerId: 2, lines: [{ itemCode: 'IR', qty: 1, unitPrice: 50, discount: { type: 'amount' as const, value: 30 } }] },
      editor,
    );
    expect(calls.approvals.map((a) => a.type)).toContain('ITEM_DISCOUNT');
  });

  it('يفحص خصم البيان بالقيمة مقابل حد النسبة (تحويل آلي)', async () => {
    const { service, calls } = harness({ status: 'DRAFT' }, null, { lastPurchaseCost: null, minSalePrice: null });
    // بند 1 × 50 = 50، خصم قيمة 25 = 50% > حد 0
    await service.update(
      7,
      {
        customerId: 2,
        lines: [{ itemCode: 'IR', qty: 1, unitPrice: 50 }],
        discount: { type: 'amount' as const, value: 25 },
      },
      editor,
    );
    expect(calls.approvals.map((a) => a.type)).toContain('HEADER_DISCOUNT');
  });

  it('يعيد النسبة المكافئة للخصم على الرأس والبنود', async () => {
    const { service } = harness(
      {
        status: 'DRAFT',
        subtotal: 50,
        discountType: 'AMOUNT',
        discountValue: 10,
        lines: [
          {
            itemId: 5,
            unitId: 6,
            factor: 1,
            qty: 1,
            qtyBase: 1,
            unitPrice: 50,
            lineDiscountType: 'AMOUNT',
            lineDiscountValue: 5,
            lineDiscountAmount: 5,
            allocatedHeaderDiscount: 0,
            netLine: 45,
            costSnapshot: null,
            item: { id: 5, code: 'IR', lastPurchaseCost: null },
            unit: { id: 6, code: 'PCS' },
          },
        ],
      },
      null,
      { lastPurchaseCost: null, minSalePrice: null },
    );
    const res = (await service.update(
      7,
      { customerId: 2, lines: [{ itemCode: 'IR', qty: 1, unitPrice: 50 }] },
      editor,
    )) as unknown as { discountPercent: number; lines: { lineDiscountPercent: number }[] };

    // رأس 10 من 50 = 20%، بند 5 من 50 = 10%
    expect(res.discountPercent).toBe(20);
    expect(res.lines[0]!.lineDiscountPercent).toBe(10);
  });
});

describe('PriceStatementsService.create credit limit (R3-B1 §5.4)', () => {
  const createDto = { customerId: 2, lines: [{ itemCode: 'IR', qty: 2, unitPrice: 50 }] };

  it('يستدعي فحص الحد الائتماني عند الإنشاء ويُعيد exceeded في التحذير', async () => {
    const { service, calls } = harness({}, null, {}, { customer: { creditLimit: 50 } });
    const res = (await service.create(createDto, approver)) as unknown as {
      creditWarning?: { creditLimit: number; projectedBalance: number; exceeded?: boolean };
    };
    expect(calls.creditChecks).toHaveLength(1);
    expect(calls.creditChecks[0]).toMatchObject({ customerId: 2, newNet: 100 });
    expect(res.creditWarning).toBeTruthy();
    expect(res.creditWarning!.exceeded).toBe(true);
  });

  it('عند رفض فحص الحد (BLOCK) يُسقط الإنشاء ولا يثبّت البيان', async () => {
    const { service, calls } = harness({}, null, {}, { customer: { creditLimit: 50 }, blockCredit: true });
    await expect(service.create(createDto, approver)).rejects.toThrow(/الحد الائتماني/);
    expect(calls.finalized).toBe(false);
  });
});

describe('PriceStatementsService unit precision (R3-A4 §5.2)', () => {
  it('يرفض كمية كسرية على وحدة أساسية عددية (COUNT)', async () => {
    const { service } = harness({}, null, { baseUnit: { measurement: 'COUNT', nameAr: 'قطعة' } });
    await expect(
      service.create({ customerId: 2, lines: [{ itemCode: 'IR', qty: 2.5, unitPrice: 50 }] }, approver),
    ).rejects.toThrow(/integer-only/);
  });

  it('يقبل الكمية الكسرية على وحدة أساسية وزنية (WEIGHT)', async () => {
    const { service } = harness({}, null, { baseUnit: { measurement: 'WEIGHT', nameAr: 'كجم' } });
    const res = await service.create(
      { customerId: 2, lines: [{ itemCode: 'IR', qty: 2.5, unitPrice: 50 }] },
      approver,
    );
    expect(res).toBeTruthy();
  });

  it('يقبل الكمية الصحيحة على وحدة أساسية عددية (COUNT)', async () => {
    const { service } = harness({}, null, { baseUnit: { measurement: 'COUNT', nameAr: 'قطعة' } });
    const res = await service.create(
      { customerId: 2, lines: [{ itemCode: 'IR', qty: 3, unitPrice: 50 }] },
      approver,
    );
    expect(res).toBeTruthy();
  });
});

const rep = {
  id: 9,
  name: 'مندوب',
  roleCode: 'SALES_REP',
  repCode: 'M03',
  permissions: ['statement.create', 'statement.edit', 'cost.view'],
  maxItemDiscountPct: 0,
  maxInvoiceDiscountPct: 0,
  companyId: 1,
} as unknown as AuthUser;

const createDto = { customerId: 2, lines: [{ itemCode: 'IR', qty: 2, unitPrice: 50 }] };

describe('PriceStatementsService rep scoping (R3-A9 §4.2)', () => {
  it('يرفض إنشاء بيان لعميل غير مسنَد للمندوب (403)', async () => {
    const { service } = harness({}, null, {}, { assignments: [99] });
    await expect(service.create(createDto, rep)).rejects.toThrow(ForbiddenException);
  });

  it('يسمح للمندوب بإنشاء بيان لعميله المسنَد', async () => {
    const { service } = harness({}, null, {}, { assignments: [2] });
    const res = await service.create(createDto, rep);
    expect(res).toBeTruthy();
  });

  it('لا يقيّد مدير بلا دور مندوب (ينشئ لأي عميل)', async () => {
    const { service } = harness({}, null, {}, { assignments: [] });
    const res = await service.create(createDto, approver);
    expect(res).toBeTruthy();
  });

  it('يحصر قائمة البيانات على عملاء المندوب المسنَدين فقط', async () => {
    const { service, calls } = harness({}, null, {}, { assignments: [2, 5] });
    await service.list({}, rep);
    expect(calls.statementFindMany[0]!.where.customerId).toEqual({ in: [2, 5] });
  });

  it('يستبعد عميلاً خارج نطاق المندوب في فلتر القائمة', async () => {
    const { service, calls } = harness({}, null, {}, { assignments: [2, 5] });
    await service.list({ customerId: 9 }, rep);
    expect(calls.statementFindMany[0]!.where.customerId).toBe(-1);
  });
});

describe('PriceStatementsService weight note (R3-A6 §5.2)', () => {
  it('يحفظ ملاحظة الوزن الفعلي لبند حديدي ويُرجعه في صفوف البند', async () => {
    const { service, calls } = harness({ status: 'DRAFT' }, null, { category: { code: 'STEEL' } });
    await service.update(
      7,
      { customerId: 2, lines: [{ itemCode: 'IR', qty: 3, unitPrice: 50, weightNote: 'الوزن الفعلي 980كج' }] },
      editor,
    );
    expect(calls.lineCreates[0]!.data[0]!.weightNote).toBe('الوزن الفعلي 980كج');
  });

  it('يقصّ الملاحظة الفارغة (مسافات فقط) فلا تُرفض على صنف غير حديدي', async () => {
    const { service } = harness({ status: 'DRAFT' }, null, { category: { code: 'PAINT' } });
    await expect(
      service.update(
        7,
        { customerId: 2, lines: [{ itemCode: 'IR', qty: 1, unitPrice: 50, weightNote: '   ' }] },
        editor,
      ),
    ).resolves.toBeTruthy();
  });

  it('يرفض ملاحظة الوزن غير الفارغة على صنف غير حديدي', async () => {
    const { service } = harness({ status: 'DRAFT' }, null, { category: { code: 'PAINT' } });
    await expect(
      service.update(
        7,
        { customerId: 2, lines: [{ itemCode: 'IR', qty: 1, unitPrice: 50, weightNote: 'فرق 20كج' }] },
        editor,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
