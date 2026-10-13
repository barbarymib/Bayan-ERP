import { describe, expect, it } from 'vitest';
import {
  calcStockLineValue,
  calcStockValue,
  resolveUnitCost,
  roundMoney,
  weightedAverageCost,
} from '../src/index.js';

describe('معادلة تقييم المخزون §7.4: قيمة_المخزن = Σ (رصيد الأساس × تكلفة الوحدة الأساسية)', () => {
  it('قيمة بند = رصيد الأساس × تكلفة الوحدة (آخر سعر شراء)', () => {
    // 22 عبوة × 1,500 = 33,000
    expect(calcStockLineValue(22, 1500)).toBe(33000);
  });

  it('الإجمالي = مجموع قيم البنود', () => {
    const rows = [
      { qtyBase: 22, lastPurchaseCost: 1500 },
      { qtyBase: 3.5, lastPurchaseCost: 80.5 },
      { qtyBase: 100, lastPurchaseCost: 12.25 },
    ];
    // 33000 + 281.75 + 1225 = 34506.75
    expect(calcStockValue(rows, 'LAST')).toEqual({ qtyBase: 125.5, value: 34506.75 });
  });

  it('غياب آخر سعر شراء يُقيَّم بصفر', () => {
    expect(calcStockValue([{ qtyBase: 10, lastPurchaseCost: null }], 'LAST')).toEqual({
      qtyBase: 10,
      value: 0,
    });
  });

  it('يدعم الكميات الكسرية بالتدوير الكميّ', () => {
    // roundQty(0.3335) = 0.334 ← 0.334 × 100 = 33.4
    expect(calcStockLineValue(0.3335, 100)).toBe(33.4);
  });
});

describe('المتوسط المرجح (WEIGHTED)', () => {
  it('= Σ(كمية×تكلفة) ÷ Σ(كمية)', () => {
    expect(
      weightedAverageCost([
        { qtyBase: 10, cost: 100 },
        { qtyBase: 30, cost: 200 },
      ]),
    ).toBe(175);
  });

  it('يتجاهل الكميات غير الموجبة', () => {
    expect(
      weightedAverageCost([
        { qtyBase: 10, cost: 100 },
        { qtyBase: 0, cost: 999 },
        { qtyBase: -5, cost: 999 },
      ]),
    ).toBe(100);
  });

  it('يساوي صفراً بدون مشتريات', () => {
    expect(weightedAverageCost([])).toBe(0);
  });
});

describe('resolveUnitCost حسب الطريقة', () => {
  const line = {
    qtyBase: 4,
    lastPurchaseCost: 250,
    purchases: [
      { qtyBase: 2, cost: 200 },
      { qtyBase: 2, cost: 300 },
    ],
    salePrice: 500,
  };

  it('LAST يعيد آخر سعر شراء', () => {
    expect(resolveUnitCost(line, 'LAST')).toBe(250);
  });

  it('WEIGHTED يعيد المتوسط المرجح (250)', () => {
    expect(resolveUnitCost(line, 'WEIGHTED')).toBe(250);
  });

  it('SALES يعيد سعر البيع', () => {
    expect(resolveUnitCost(line, 'SALES')).toBe(500);
  });

  it('الافتراضي LAST', () => {
    expect(resolveUnitCost({ qtyBase: 1, lastPurchaseCost: 7 })).toBe(7);
  });
});

describe('اتساق التقييم مع §7.4 في طرق مختلفة', () => {
  it('قيمة SALES للرصيد 4 = 2000', () => {
    expect(
      calcStockValue([{ qtyBase: 4, salePrice: 500 }], 'SALES'),
    ).toEqual({ qtyBase: 4, value: 2000 });
  });

  it('القيمة تُقرَّب مالياً والرصيد كميّاً (تطابق roundMoney)', () => {
    const total = calcStockValue([{ qtyBase: 3, lastPurchaseCost: 10.111 }], 'LAST');
    expect(total.value).toBe(roundMoney(3 * 10.111));
    expect(total.value).toBe(30.33);
  });
});
