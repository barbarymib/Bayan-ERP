import { describe, expect, it } from 'vitest';
import { diffOfStocktakeLine, summarizeStocktake, roundQty, roundMoney } from '../src/index.js';

describe('diffOfStocktakeLine — فرق الكمية والقيمة (الكمية × آخر سعر شراء)', () => {
  it('زيادة: نظام 100، فعلي 103، سعر 25 → فرق +3 وقيمة 75', () => {
    const r = diffOfStocktakeLine({ systemQtyBase: 100, countedQtyBase: 103, lastCost: 25 });
    expect(r).toEqual({ diffQty: 3, diffValue: 75 });
  });

  it('عجز: نظام 1000، فعلي 999.5 → فرق −0.5 وقيمة −12.5', () => {
    const r = diffOfStocktakeLine({ systemQtyBase: 1000, countedQtyBase: 999.5, lastCost: 25 });
    expect(r).toEqual({ diffQty: -0.5, diffValue: -12.5 });
  });

  it('تطابق (فرق صفر)', () => {
    const r = diffOfStocktakeLine({ systemQtyBase: 40, countedQtyBase: 40, lastCost: 100 });
    expect(r).toEqual({ diffQty: 0, diffValue: 0 });
  });

  it('سفر دون سعر (lastCost=null) قيمته صفر', () => {
    const r = diffOfStocktakeLine({ systemQtyBase: 10, countedQtyBase: 12, lastCost: null });
    expect(r.diffQty).toBe(2);
    expect(r.diffValue).toBe(0);
  });

  it('بنود بلا عد → تُحسب كانفر=0 ولا تُحتسب', () => {
    const r = diffOfStocktakeLine({ systemQtyBase: 10, countedQtyBase: null, lastCost: 5 });
    expect(r.diffQty).toBe(0);
    expect(r.diffValue).toBe(0);
  });

  it('قيمة طويلة تُقرَّب لخانتين', () => {
    const r = diffOfStocktakeLine({ systemQtyBase: 3, countedQtyBase: 3.333, lastCost: 7.77 });
    expect(r.diffQty).toBe(roundQty(0.333));
    expect(r.diffValue).toBe(roundMoney(0.333 * 7.77));
  });
});

describe('summarizeStocktake — إجماليات الجلسة', () => {
  const sample = [
    { systemQtyBase: 20, countedQtyBase: 22, lastCost: 10 }, // +2 = 20
    { systemQtyBase: 50, countedQtyBase: 48, lastCost: 5 }, // −2 = −10
    { systemQtyBase: 8, countedQtyBase: 8, lastCost: 100 }, // 0
    { systemQtyBase: 30, countedQtyBase: null, lastCost: 7 }, // غير مُعدّ
    { systemQtyBase: 4, countedQtyBase: 5, lastCost: null }, // بلا سعر، +1
  ];

  it('يُحصي البنود والمُعدّ وغير المُعدّ', () => {
    const s = summarizeStocktake(sample);
    expect(s.lines).toBe(5);
    expect(s.countedLines).toBe(4);
    expect(s.uncountedLines).toBe(1);
  });

  it('إجمالي الفروقات (كمية وقيمة)', () => {
    const s = summarizeStocktake(sample);
    expect(s.totalDiffQty).toBe(1); // 2 − 2 + 0 + 1
    expect(s.totalDiffValue).toBe(10); // 20 − 10 + 0 + 0
  });

  it('يفصل العجز عن الزيادة', () => {
    const s = summarizeStocktake(sample);
    expect(s.surplusLines).toBe(2);
    expect(s.surplusQty).toBe(3);
    expect(s.surplusValue).toBe(20);
    expect(s.deficitLines).toBe(1);
    expect(s.deficitQty).toBe(2);
    expect(s.deficitValue).toBe(10);
  });

  it('يُحصي البنود بلا سعر', () => {
    const s = summarizeStocktake(sample);
    expect(s.noCostLines).toBe(1);
  });

  it('جلسة فارغة تعيد أصفاراً', () => {
    const s = summarizeStocktake([]);
    expect(s).toEqual({
      lines: 0,
      countedLines: 0,
      uncountedLines: 0,
      totalDiffQty: 0,
      totalDiffValue: 0,
      surplusLines: 0,
      deficitLines: 0,
      surplusQty: 0,
      deficitQty: 0,
      surplusValue: 0,
      deficitValue: 0,
      noCostLines: 0,
    });
  });
});