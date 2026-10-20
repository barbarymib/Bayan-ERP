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

function pushStatementDto(payload: Record<string, unknown>): PushDto {
  return { items: [{ clientUuid: 'u1', type: 'price_statement', payload }] } as PushDto;
}

describe('SyncService.push — مرتجع المندوب (R4-B4 §5.9/§5.12)', () => {
  function harnessReturn() {
    const prisma = {
      returnStatement: { findFirst: async () => null },
      customerRepAssignment: { findFirst: async () => ({ id: 1 }) },
      _: 0,
    } as unknown as PrismaService;
    const calls: Record<string, unknown>[] = [];
    const returnsSvc = {
      create: vi.fn(async (dto: Record<string, unknown>) => {
        calls.push(dto);
        return { id: 9, status: 'DRAFT', number: 'RT-9' };
      }),
    };
    const service = new SyncService(
      prisma,
      {} as never,
      returnsSvc as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { write: async () => {} } as never,
    );
    return { service, calls };
  }

  const repUser = {
    ...baseUser,
    roleCode: 'SALES_REP',
    repCode: 'M03',
    permissions: ['return.create', 'return.without_statement', 'return.cash_refund'],
  } as unknown as AuthUser;

  function pushReturn(payload: Record<string, unknown>): PushDto {
    return { items: [{ clientUuid: 'u1', type: 'return_statement', payload, number: 'RT-9' }] } as PushDto;
  }

  it('يمرّر mode/settlement/withoutStatement/per-line unitCode إلى returns.create', async () => {
    const { service, calls } = harnessReturn();
    await service.push(
      repUser,
      pushReturn({
        mode: 'BY_CUSTOMER',
        customerId: 2,
        reasonCode: 'DEFECT',
        settlement: 'CREDIT',
        withoutStatement: true,
        lines: [{ itemId: 5, qty: 2, unitCode: 'can', condition: 'GOOD' }],
      }),
    );
    const dto = calls[0]!;
    expect(dto.mode).toBe('BY_CUSTOMER');
    expect(dto.settlement).toBe('CREDIT');
    expect(dto.withoutStatement).toBe(true);
    const lines = dto.lines as Record<string, unknown>[];
    expect(lines[0]!.unitCode).toBe('can');
    expect(lines[0]!.sourceLineId).toBeUndefined();
  });

  it('يرسل sourceLineId عند الإرجاع من بيان أصلي', async () => {
    const { service, calls } = harnessReturn();
    await service.push(
      repUser,
      pushReturn({
        mode: 'BY_REP',
        customerId: 2,
        reasonCode: 'DAMAGED',
        lines: [{ sourceLineId: 77, qty: 1, condition: 'GOOD' }],
      }),
    );
    const lines = calls[0]!.lines as Record<string, unknown>[];
    expect(lines[0]!.sourceLineId).toBe(77);
  });
});

describe('SyncService.push — تنبيهات التسعير مع رفع بيان سعر (R3-A8 §5.3)', () => {
  const repUser = {
    ...baseUser,
    roleCode: 'SALES_REP',
    repCode: 'M03',
    permissions: ['statement.create'],
  } as unknown as AuthUser;

  function harnessWithStatement(result: Record<string, unknown>) {
    const prisma = {
      priceStatement: {
        findFirst: async () => null,
        findMany: async () => [],
      },
      item: { findFirst: async () => null },
      unit: { findUnique: async () => null },
      itemUnit: { findUnique: async () => null },
      customer: { findUnique: async () => ({ id: 2, nameAr: 'عميل', companyId: 1 }) },
      customerRepAssignment: { findMany: async () => [], findFirst: async () => ({ id: 1 }) },
      deviceBlockReservation: { findFirst: async () => null },
      numberSequence: { findUnique: async () => null, update: async () => ({}) },
      $transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
    } as unknown as PrismaService;
    const statements = {
      create: vi.fn(async (_dto: unknown) => result),
    };
    const service = new SyncService(
      prisma,
      statements as never,
      {} as never,
      {} as never,
      {} as never,
      { holdForReview: async () => {} } as never,
      {} as never,
      { write: async () => {} } as never,
    );
    return { service, statements };
  }

  const payload = {
    customerId: 2,
    paymentTerm: 'CREDIT',
    net: 100,
    lines: [{ itemCode: 'IR', qty: 2, unitPrice: 50 }],
  };

  it('يُعيد pricingAlerts مع نتيجة رفع بيان السعر', async () => {
    const alerts = [
      { type: 'below_cost', itemCode: 'IR', unitPrice: 50, threshold: 40 },
    ];
    const { service } = harnessWithStatement({
      id: 31,
      net: 100,
      status: 'DRAFT',
      number: 'BP-000031',
      pricingAlerts: alerts,
    });
    const res = await service.push(repUser, pushStatementDto(payload));
    expect((res.results[0] as { pricingAlerts?: unknown[] }).pricingAlerts).toEqual(alerts);
  });

  it('لا يُعيد pricingAlerts عند عدم وجودها', async () => {
    const { service } = harnessWithStatement({
      id: 32,
      net: 100,
      status: 'APPROVED',
      number: 'BP-000032',
    });
    const res = await service.push(repUser, pushStatementDto(payload));
    expect((res.results[0] as { pricingAlerts?: unknown[] }).pricingAlerts).toBeUndefined();
  });

  it('يمرّر unitCode السطر (مبسّط) إلى statements.create — G14 §5.12', async () => {
    const { service, statements } = harnessWithStatement({
      id: 33,
      net: 100,
      status: 'DRAFT',
      number: 'BP-000033',
    });
    await service.push(
      repUser,
      pushStatementDto({
        customerId: 2,
        net: 100,
        lines: [{ itemCode: 'IR', qty: 2, unitPrice: 50, unitCode: '  ton  ' }],
      }),
    );
    const dto = statements.create.mock.calls[0]![0] as { lines: { unitCode?: string }[] };
    expect(dto.lines).toHaveLength(1);
    expect(dto.lines[0]!.unitCode).toBe('ton');
  });

  it('يُسقط unitCode الفارغ أو غير النصي — G14 §5.12', async () => {
    const { service, statements } = harnessWithStatement({
      id: 34,
      net: 50,
      status: 'DRAFT',
      number: 'BP-000034',
    });
    await service.push(
      repUser,
      pushStatementDto({
        customerId: 2,
        net: 50,
        lines: [
          { itemCode: 'IR', qty: 1, unitPrice: 50, unitCode: '   ' },
          { itemCode: 'PNT', qty: 1, unitPrice: 30, unitCode: 7 },
        ],
      }),
    );
    const dto = statements.create.mock.calls[0]![0] as { lines: { unitCode?: string }[] };
    expect(dto.lines[0]!.unitCode).toBeUndefined();
    expect(dto.lines[1]!.unitCode).toBeUndefined();
  });

  it('يمرّر saveAsDraft من حمولة الجهاز إلى statements.create — R4-B7 §6.1', async () => {
    const { service, statements } = harnessWithStatement({
      id: 35,
      net: 100,
      status: 'DRAFT',
      number: 'BP-000035',
    });
    await service.push(repUser, pushStatementDto({ ...payload, saveAsDraft: true }));
    const dto = statements.create.mock.calls[0]![0] as { saveAsDraft?: boolean };
    expect(dto.saveAsDraft).toBe(true);
  });

  it('لا يمرّر saveAsDraft عند غيابه أو عند قيمة غير منطقية — R4-B7 §6.1', async () => {
    const { service, statements } = harnessWithStatement({
      id: 36,
      net: 100,
      status: 'APPROVED',
      number: 'BP-000036',
    });
    await service.push(repUser, pushStatementDto({ ...payload, saveAsDraft: 'yes' }));
    const dto = statements.create.mock.calls[0]![0] as { saveAsDraft?: boolean };
    expect(dto.saveAsDraft).toBeUndefined();
  });
});

describe('SyncService.delta — باركود الأصناف والوحدات (G13 §9)', () => {
  function deltaHarness(items: unknown[], stockBalance?: Partial<Record<'findMany' | 'groupBy', unknown>>) {
    const prisma = {
      item: { findMany: async () => items },
      customerRepAssignment: { findMany: async () => [] },
      priceList: { findMany: async () => [] },
      priceStatement: { findMany: async () => [] },
      numberBlock: { findMany: async () => [] },
      stockBalance: {
        findMany: async () => [],
        groupBy: async () => [],
        ...stockBalance,
      },
    };
    const service = new SyncService(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
      {} as never,
      { notify: async () => {} } as never,
      {} as never,
      {} as never,
      { write: async () => {} } as never,
    );
    return service;
  }

  const deltaUser = { ...baseUser, repCode: 'REP1' } as unknown as AuthUser;

  it('يُرسل باركود الصنف وباركود كل وحدة مع عوامل التحويل', async () => {
    const service = deltaHarness([
      {
        id: 1,
        code: 'IR',
        nameAr: 'حديد',
        barcode: '6221000000017',
        baseUnit: { code: 'KG' },
        category: { code: 'STEEL' },
        itemUnits: [
          {
            unitId: 3,
            factorToBase: 1000,
            allowDecimal: false,
            barcode: 'BOX-1',
            isSale: true,
            isPurchase: true,
            unit: { code: 'TON' },
          },
          {
            unitId: 5,
            factorToBase: 1,
            allowDecimal: true,
            barcode: null,
            isSale: true,
            isPurchase: false,
            unit: null,
          },
        ],
      },
    ]);
    const res = await service.delta(deltaUser);
    expect(res.items[0]).toEqual({
      id: 1,
      code: 'IR',
      name: 'حديد',
      baseUnit: 'KG',
      categoryCode: 'STEEL',
      lastPrice: null,
      barcode: '6221000000017',
      units: [
        {
          unitId: 3,
          unitCode: 'TON',
          factorToBase: 1000,
          allowDecimal: false,
          barcode: 'BOX-1',
          isSale: true,
          isPurchase: true,
        },
        {
          unitId: 5,
          unitCode: null,
          factorToBase: 1,
          allowDecimal: true,
          barcode: null,
          isSale: true,
          isPurchase: false,
        },
      ],
    });
  });

  it('يُرسل barcode=null وقائمة وحدات فارغة عند غيابها', async () => {
    const service = deltaHarness([
      {
        id: 2,
        code: 'PNT',
        nameAr: 'دهان',
        barcode: null,
        baseUnit: { code: 'GLN' },
        category: { code: 'PAINT' },
        itemUnits: [],
      },
    ]);
    const res = await service.delta(deltaUser);
    expect(res.items[0]).toMatchObject({ id: 2, barcode: null, units: [] });
  });

  it('يعتمر updatedAt على مرشّح item.findMany عند تمرير since (لحقل Item.updatedAt — R3-F2)', async () => {
    const itemArgs: { where?: Record<string, unknown> }[] = [];
    const prisma = {
      item: {
        findMany: async (args: { where?: Record<string, unknown> }) => {
          itemArgs.push(args);
          return [];
        },
      },
      customerRepAssignment: { findMany: async () => [] },
      priceList: { findMany: async () => [] },
      priceStatement: { findMany: async () => [] },
      numberBlock: { findMany: async () => [] },
      stockBalance: { findMany: async () => [], groupBy: async () => [] },
    };
    const service = new SyncService(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
      {} as never,
      { notify: async () => {} } as never,
      {} as never,
      {} as never,
      { write: async () => {} } as never,
    );

    // بلا since: لا مرشّح وقت — كل الأصناف النشطة تُرسل (مزامنة أولى).
    await service.delta(deltaUser);
    expect(itemArgs[0]!.where).not.toHaveProperty('updatedAt');

    // مع since: مرشّح updatedAt.gt مطلوب — غيابه على حقل Item بدون updatedAt
    // كان يرفع خطأ Prisma (500) في كل مزامنة بعد الأولى.
    const since = '2026-10-19T00:00:00.000Z';
    await service.delta(deltaUser, since);
    expect(itemArgs[1]!.where).toMatchObject({
      updatedAt: { gt: new Date(since) },
      active: true,
    });
  });

  it('يرفض since غير صالح بتاريخ قبل تنفيذ الاستعلام', async () => {
    const service = deltaHarness([]);
    await expect(service.delta(deltaUser, 'not-a-date')).rejects.toThrow(/Invalid since/);
  });
});

describe('SyncService.delta — قسم أرصدة الأصناف (R3-F2 §8.2 #7)', () => {
  function stockHarness(opts: {
    changed?: { itemId: number }[];
    grouped?: { itemId: number; _sum: { qtyBase: unknown } }[];
  }) {
    const calls: unknown[] = [];
    const prisma = {
      item: { findMany: async () => [] },
      customerRepAssignment: { findMany: async () => [] },
      priceList: { findMany: async () => [] },
      priceStatement: { findMany: async () => [] },
      numberBlock: { findMany: async () => [] },
      stockBalance: {
        findMany: async (args: unknown) => {
          calls.push(args);
          return opts.changed ?? [];
        },
        groupBy: async (args: unknown) => {
          calls.push(args);
          return opts.grouped ?? [];
        },
      },
    };
    const service = new SyncService(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
      {} as never,
      { notify: async () => {} } as never,
      {} as never,
      {} as never,
      { write: async () => {} } as never,
    );
    return { service, calls };
  }

  const stockUser = { ...baseUser, repCode: 'M03' } as unknown as AuthUser;

  it('أول مزامنة (بلا since) تجمّع كل الأرصدة وتعيدها مقرّبة', async () => {
    const { service, calls } = stockHarness({
      grouped: [
        { itemId: 1, _sum: { qtyBase: '12.5000' } },
        { itemId: 7, _sum: { qtyBase: null } },
      ],
    });
    const res = await service.delta(stockUser);
    expect(res.stock).toEqual([
      { itemId: 1, qty: 12.5 },
      { itemId: 7, qty: 0 },
    ]);
    // بلا since: لا استعلام تغيّرات — groupBy مباشرة بلا itemId in.
    expect(calls).toHaveLength(1);
    const where = (calls[0] as { where: Record<string, unknown> }).where;
    expect(where.itemId).toBeUndefined();
  });

  it('مع since: يُرسل أرصدة الأصناف المتغيّرة فقط عبر معرّفات محدّدة', async () => {
    const { service, calls } = stockHarness({
      changed: [{ itemId: 5 }, { itemId: 9 }],
      grouped: [{ itemId: 5, _sum: { qtyBase: 3 } }],
    });
    const res = await service.delta(stockUser, '2026-10-19T00:00:00.000Z');
    expect(res.stock).toEqual([{ itemId: 5, qty: 3 }]);
    expect(calls).toHaveLength(2);
    const where = (calls[1] as { where: { itemId: { in: number[] } } }).where;
    expect(where.itemId.in).toEqual([5, 9]);
  });

  it('مع since دون أي تغيّر في المخزون: قسم stock فارغ بلا استعلام تجميع', async () => {
    const { service, calls } = stockHarness({ changed: [] });
    const res = await service.delta(stockUser, '2026-10-19T00:00:00.000Z');
    expect(res.stock).toEqual([]);
    expect(calls).toHaveLength(1); // findMany التغيّرات فقط
  });
});
