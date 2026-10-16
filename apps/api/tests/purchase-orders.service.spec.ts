import { describe, expect, it, vi } from 'vitest';
import { PurchaseOrdersService } from '../src/purchase-orders/purchase-orders.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { AuthUser } from '../src/auth/auth.decorators.js';
import type { CreatePurchaseOrderDto } from '../src/purchase-orders/purchase-orders.dto.js';

const user = { id: 7, companyId: 1, repCode: 'M03' } as unknown as AuthUser;

interface Opts {
  order?: Record<string, unknown>;
}

function harness(opts: Opts = {}) {
  const calls = {
    orderCreate: [] as Record<string, unknown>[],
    purchaseCreate: [] as Record<string, unknown>[],
    poLineUpdate: [] as Record<string, unknown>[],
    orderUpdate: [] as Record<string, unknown>[],
  };

  const detail = (over: Record<string, unknown> = {}) => ({
    id: 55,
    companyId: 1,
    supplierId: 1,
    warehouseId: 3,
    status: 'DRAFT',
    lines: [],
    supplier: { id: 1, code: 'S1', nameAr: 'مورد' },
    warehouse: { id: 3, code: 'MAIN', nameAr: 'رئيسي' },
    ...over,
  });

  const order = opts.order;

  const prisma = {
    supplier: { findUnique: async () => ({ id: 1, companyId: 1 }) },
    warehouse: {
      findUnique: async () => ({ id: 3, code: 'MAIN', companyId: 1 }),
      findFirst: async () => ({ id: 3, code: 'MAIN', companyId: 1 }),
    },
    item: { findUnique: async () => ({ id: 11, baseUnitId: 1, companyId: 1 }) },
    purchaseOrder: {
      create: async (args: Record<string, unknown>) => {
        calls.orderCreate.push(args);
        return { id: 55 };
      },
      findUnique: async () => (order ? detail(order) : detail()),
    },
    $transaction: async (cb: (t: unknown) => Promise<unknown>) =>
      cb({
        purchaseStatement: { update: vi.fn(async () => ({})) },
        purchaseOrderLine: {
          update: vi.fn(async (args: Record<string, unknown>) => {
            calls.poLineUpdate.push(args);
          }),
        },
        purchaseOrder: {
          update: vi.fn(async (args: Record<string, unknown>) => {
            calls.orderUpdate.push(args);
          }),
        },
      }),
  } as unknown as PrismaService;

  const purchases = {
    create: vi.fn(async (dto: Record<string, unknown>) => {
      calls.purchaseCreate.push(dto);
      return { id: 99, number: 'PR-1' };
    }),
  };

  const service = new PurchaseOrdersService(
    prisma,
    { issue: async () => 'PO-1' } as never,
    { open: async () => ({ id: 1 }) } as never,
    purchases as never,
    { write: async () => {} } as never,
  );

  return { service, calls };
}

function dto(lines: CreatePurchaseOrderDto['lines']): CreatePurchaseOrderDto {
  return { supplierId: 1, warehouseId: 3, lines } as CreatePurchaseOrderDto;
}

describe('PurchaseOrdersService.create — تخزين خصم البند (§5.5)', () => {
  it('يحفظ نوع/قيمة/مبلغ الخصم وصافي البند بعد الخصم', async () => {
    const { service, calls } = harness();
    await service.create(
      dto([{ itemId: 11, qty: 2, unitPrice: 100, discount: { type: 'percent', value: 10 } }]),
      user,
    );
    const created = calls.orderCreate[0] as {
      data: { net: number; discountAmount: number; lines: { create: Record<string, unknown>[] } };
    };
    expect(created.data.net).toBe(180);
    const line = created.data.lines.create[0]!;
    expect(line).toMatchObject({
      lineDiscountType: 'PERCENT',
      lineDiscountValue: 10,
      lineDiscountAmount: 20,
      netLine: 180,
    });
  });

  it('بلا خصم: عمود النوع فارغ والمبلغ صفر', async () => {
    const { service, calls } = harness();
    await service.create(dto([{ itemId: 11, qty: 2, unitPrice: 100 }]), user);
    const line = (calls.orderCreate[0] as { data: { lines: { create: Record<string, unknown>[] } } })
      .data.lines.create[0]!;
    expect(line).toMatchObject({ lineDiscountType: null, lineDiscountValue: null, lineDiscountAmount: 0, netLine: 200 });
  });
});

describe('PurchaseOrdersService.receive — تمرير خصم البند للبيان (§5.5)', () => {
  const approvedOrder = {
    id: 55,
    companyId: 1,
    supplierId: 1,
    warehouseId: 3,
    status: 'APPROVED',
    lines: [
      {
        id: 1,
        item: { code: 'A' },
        unit: { code: 'pc' },
        qty: 2,
        qtyBase: 2,
        unitPrice: 100,
        lineDiscountType: 'PERCENT',
        lineDiscountValue: 10,
        netLine: 180,
      },
    ],
  };

  it('يمرّر الخصم (نسبة) إلى بيان التوريد فلا يتغيّر الصافي', async () => {
    const { service, calls } = harness({ order: approvedOrder });
    await service.receive(55, {}, user);
    const purchaseDto = calls.purchaseCreate[0] as { lines: Record<string, unknown>[] };
    expect(purchaseDto.lines[0]).toMatchObject({
      itemCode: 'A',
      unitCode: 'pc',
      qty: 2,
      unitPrice: 100,
      discount: { type: 'percent', value: 10 },
    });
  });

  it('يمرّر الخصم (مبلغ ثابت) ويرفض الاستلام قبل الاعتماد', async () => {
    const fixed = structuredClone(approvedOrder);
    fixed.lines[0]!.lineDiscountType = 'AMOUNT';
    fixed.lines[0]!.lineDiscountValue = 15;
    const { service, calls } = harness({ order: fixed });
    await service.receive(55, {}, user);
    const purchaseDto = calls.purchaseCreate[0] as { lines: Record<string, unknown>[] };
    expect(purchaseDto.lines[0]!.discount).toEqual({ type: 'amount', value: 15 });

    const draft = structuredClone(approvedOrder);
    draft.status = 'DRAFT';
    const h2 = harness({ order: draft });
    await expect(h2.service.receive(55, {}, user)).rejects.toThrow(/قبل الاستلام/);
    expect(h2.calls.purchaseCreate).toHaveLength(0);
  });

  it('بلا خصم على البند: لا يُرسل حقل discount', async () => {
    const plain = structuredClone(approvedOrder);
    plain.lines[0]!.lineDiscountType = null as unknown as string;
    plain.lines[0]!.lineDiscountValue = null as unknown as number;
    const { service, calls } = harness({ order: plain });
    await service.receive(55, {}, user);
    const purchaseDto = calls.purchaseCreate[0] as { lines: Record<string, unknown>[] };
    expect(purchaseDto.lines[0]!.discount).toBeUndefined();
  });
});
