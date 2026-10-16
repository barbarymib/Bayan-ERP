import { describe, expect, it } from 'vitest';
import { StockService } from '../src/common/stock.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';

function build(opts: {
  enforce?: string | null;
  balance?: number;
  reserved?: number;
} = {}) {
  const captured: { aggregate?: Record<string, unknown> } = {};
  const prisma = {
    systemSetting: { findUnique: async () => (opts.enforce === null ? null : { value: opts.enforce ?? 'ALLOW' }) },
    stockBalance: { findUnique: async () => ({ qtyBase: opts.balance ?? 10 }) },
    stockReservation: {
      aggregate: async (args: Record<string, unknown>) => {
        captured.aggregate = args;
        return { _sum: { qtyBase: opts.reserved ?? 0 } };
      },
    },
  } as unknown as PrismaService;
  return { service: new StockService(prisma), captured };
}

describe('StockService.availableQty', () => {
  it('المتاح = الرصيد − الحجوزات النشطة', async () => {
    const { service } = build({ balance: 10, reserved: 3 });
    await expect(service.availableQty(1, 2, '', 1)).resolves.toBe(7);
  });

  it('يحترم نطاق الشركة في الحجوزات', async () => {
    const { service, captured } = build({ balance: 10, reserved: 0, enforce: 'ALLOW' });
    await service.availableQty(1, 2, '', 1);
    expect(captured.aggregate).toMatchObject({ where: { companyId: 1 } });
  });

  it('يستثني حجز مستند معيّن عبر NOT {refType, refId}', async () => {
    const { service, captured } = build({ balance: 10, reserved: 0 });
    await service.availableQty(1, 2, '', 1, { refType: 'price_statement', refId: 5 });
    expect(captured.aggregate).toMatchObject({
      where: { NOT: { refType: 'price_statement', refId: 5 } },
    });
  });
});

describe('StockService.assertSalePermitted (R3-B11)', () => {
  it('ALLOW (افتراضي): لا يمنع ولا يستعلم عن الرصيد', async () => {
    const { service, captured } = build({ enforce: 'ALLOW', balance: 0 });
    await expect(service.assertSalePermitted(1, [{ itemId: 2, qtyBase: 999 }], 1)).resolves.toBeUndefined();
    expect(captured.aggregate).toBeUndefined();
  });

  it('BLOCK والكمية ضمن المتاح: يمرّ', async () => {
    const { service } = build({ enforce: 'BLOCK', balance: 10, reserved: 3 });
    await expect(service.assertSalePermitted(1, [{ itemId: 2, qtyBase: 2 }], 1)).resolves.toBeUndefined();
  });

  it('BLOCK وتجاوز المتاح: يرفض ويمرّر استثناء الحجز', async () => {
    const { service, captured } = build({ enforce: 'BLOCK', balance: 0, reserved: 0 });
    await expect(
      service.assertSalePermitted(1, [{ itemId: 2, qtyBase: 5 }], 1, { refType: 'price_statement', refId: 5 }),
    ).rejects.toThrow(/تتجاوز المتاح/);
    expect(captured.aggregate).toMatchObject({
      where: { NOT: { refType: 'price_statement', refId: 5 } },
    });
  });
});
