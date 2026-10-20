import { describe, expect, it } from 'vitest';
import {
  calcStatementTotals,
  allocateHeaderDiscount,
  allocateProportional,
  apportionLandedCost,
  roundMoney,
} from '../src/index.js';

describe('calcStatementTotals — المثال المرجعي (§14)', () => {
  // بند 1: 10 طن حديد × 40,000 = 400,000 خصم 1% ← 396,000
  // بند 2: 20 عبوة دهان × 1,500 = 30,000 خصم 100 ثابت ← 29,900
  // المجموع 425,900 خصم بيان 0.5% = 2,129.5 ← الصافي 423,770.5
  const result = calcStatementTotals({
    lines: [
      { qty: 10, unitPrice: 40000, discount: { type: 'percent', value: 1 } },
      { qty: 20, unitPrice: 1500, discount: { type: 'amount', value: 100 } },
    ],
    headerDiscount: { type: 'percent', value: 0.5 },
  });

  it('خصم البند 1 = 4,000 وصافيه = 396,000', () => {
    expect(result.lines[0]).toMatchObject({
      gross: 400000,
      lineDiscountAmount: 4000,
      netAfterLineDiscount: 396000,
      allocatedHeaderDiscount: 1980,
      netFinal: 394020,
    });
  });

  it('خصم البند 2 = 100 وصافيه = 29,900', () => {
    expect(result.lines[1]).toMatchObject({
      gross: 30000,
      lineDiscountAmount: 100,
      netAfterLineDiscount: 29900,
      allocatedHeaderDiscount: 149.5,
      netFinal: 29750.5,
    });
  });

  it('الإجماليات: فرعي 425,900 — خصم 2,129.5 — صافي 423,770.5', () => {
    expect(result.subtotal).toBe(425900);
    expect(result.headerDiscountAmount).toBe(2129.5);
    expect(result.net).toBe(423770.5);
    expect(result.tax).toBe(0);
    expect(result.shipping).toBe(0);
  });

  it('مجموع الصافي النهائي للبنود = صافي البيان', () => {
    const sum = result.lines.reduce((s, l) => s + l.netFinal, 0);
    expect(roundMoney(sum)).toBe(result.net);
  });
});

describe('خصم البيان — القيمة الثابتة والنسبة', () => {
  it('خصم ثابت يُوزَّع نسبياً مع تصحيح التقريب على آخر بند', () => {
    const totals = calcStatementTotals({
      lines: [
        { qty: 1, unitPrice: 100 },
        { qty: 1, unitPrice: 200 },
        { qty: 1, unitPrice: 300 },
      ],
      headerDiscount: { type: 'amount', value: 100 },
    });
    const allocated = totals.lines.reduce((s, l) => s + l.allocatedHeaderDiscount, 0);
    expect(roundMoney(allocated)).toBe(100);
    expect(totals.net).toBe(500);
  });

  it('خصم 100% على البيان يصفّر الصافي', () => {
    const totals = calcStatementTotals({
      lines: [{ qty: 5, unitPrice: 10 }],
      headerDiscount: { type: 'percent', value: 100 },
    });
    expect(totals.net).toBe(0);
    expect(totals.lines[0]?.netFinal).toBe(0);
  });

  it('بند بخصم 100% لا يحصل على نصيب من خصم البيان', () => {
    const totals = calcStatementTotals({
      lines: [
        { qty: 1, unitPrice: 100, discount: { type: 'percent', value: 100 } },
        { qty: 1, unitPrice: 100 },
      ],
      headerDiscount: { type: 'amount', value: 20 },
    });
    expect(totals.lines[0]?.allocatedHeaderDiscount).toBe(0);
    expect(totals.lines[1]?.allocatedHeaderDiscount).toBe(20);
  });

  it('نقل وضريبة يُحسبان بعد خصم البيان', () => {
    const totals = calcStatementTotals({
      lines: [{ qty: 1, unitPrice: 1000, discount: { type: 'percent', value: 10 } }],
      headerDiscount: { type: 'percent', value: 10 },
      shipping: 50,
      taxPercent: 14,
    });
    // فرعي 900 − خصم 90 = 810 + نقل 50 = 860 + ضريبة 120.4 = 980.4
    expect(totals.subtotal).toBe(900);
    expect(totals.headerDiscountAmount).toBe(90);
    expect(totals.shipping).toBe(50);
    expect(totals.tax).toBe(120.4);
    expect(totals.net).toBe(980.4);
  });

  it('يرفض الكمية السالبة أو السعر السالب', () => {
    expect(() => calcStatementTotals({ lines: [{ qty: -1, unitPrice: 10 }] })).toThrow();
    expect(() => calcStatementTotals({ lines: [{ qty: 1, unitPrice: -10 }] })).toThrow();
  });
});

describe('allocateHeaderDiscount', () => {
  it('يُرجع مصفوفة صفيرة لخصم صفري', () => {
    expect(allocateHeaderDiscount([100, 200], 0)).toEqual([0, 0]);
  });

  it('يُرجع مصفوفة فارغة لبندات فارغة', () => {
    expect(allocateHeaderDiscount([], 50)).toEqual([]);
  });

  it('مطابق للتوزيع التناسبي العام', () => {
    expect(allocateHeaderDiscount([100, 300], 40)).toEqual(allocateProportional([100, 300], 40));
  });
});

describe('apportionLandedCost — توزيع مصاريف النقل (§5.5)', () => {
  it('وزن القيمة: التوزيع بحسب صافي البند', () => {
    const shares = apportionLandedCost(
      [
        { net: 300, qtyBase: 10 },
        { net: 100, qtyBase: 1 },
      ],
      80,
      'VALUE',
    );
    expect(shares).toEqual([60, 20]);
    expect(roundMoney(shares.reduce((s, v) => s + v, 0))).toBe(80);
  });

  it('وزن الكمية: التوزيع بحسب الكمية الأساسية', () => {
    const shares = apportionLandedCost(
      [
        { net: 300, qtyBase: 10 },
        { net: 100, qtyBase: 1 },
      ],
      11,
      'QTY',
    );
    expect(shares).toEqual([10, 1]);
  });

  it('الافتراضي هو أساس القيمة', () => {
    expect(apportionLandedCost([{ net: 1, qtyBase: 100 }], 5)).toEqual([5]);
  });

  it('يصحّح فرق التقريب على آخر بند غير صفري', () => {
    const shares = apportionLandedCost(
      [
        { net: 100, qtyBase: 1 },
        { net: 100, qtyBase: 1 },
        { net: 100, qtyBase: 1 },
      ],
      10,
    );
    expect(roundMoney(shares.reduce((s, v) => s + v, 0))).toBe(10);
  });

  it('يتراجع لأساس الكمية عندما تكون كل القيم صفراً (بنود مجانية)', () => {
    const shares = apportionLandedCost(
      [
        { net: 0, qtyBase: 3 },
        { net: 0, qtyBase: 1 },
      ],
      40,
      'VALUE',
    );
    expect(shares).toEqual([30, 10]);
  });

  it('يُرجع أصفاراً عند عدم وجود مصاريف أو بنود', () => {
    expect(apportionLandedCost([{ net: 100, qtyBase: 1 }], 0)).toEqual([0]);
    expect(apportionLandedCost([], 50)).toEqual([]);
  });
});
