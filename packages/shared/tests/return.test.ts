import { describe, expect, it } from 'vitest';
import {
  calcReturnLineValue,
  calcReturnUnitNetPrice,
  validateReturnQty,
  roundMoney,
} from '../src/index.js';

describe('تسعير المرتجع بصافي البيان الأصلي (لا بسعر اليوم)', () => {
  // من المثال: بند الدهان صافيه النهائي 29,750.5 لـ 20 عبوة
  const lineNetFinal = 29750.5;
  const originalQty = 20;

  it('سعر وحدة المرتجع الأساسي = الصافي ÷ الكمية الأصلية (دقيق، يُقرَّب عند العرض)', () => {
    expect(calcReturnUnitNetPrice(lineNetFinal, originalQty)).toBe(1487.525);
  });

  it('قيمة مرتجع 5 عبوات = 7,437.63 (وليس بسعر 1,500)', () => {
    const value = calcReturnLineValue(lineNetFinal, originalQty, 5);
    expect(value).toBe(7437.63);
    expect(value).toBe(roundMoney((lineNetFinal * 5) / originalQty));
  });

  it('قيمة المرتجع مطابقة لـ round(سعر الوحدة الأساسي × الكمية) — اتساق مع §7.4', () => {
    const unit = calcReturnUnitNetPrice(lineNetFinal, originalQty);
    const value = calcReturnLineValue(lineNetFinal, originalQty, 5);
    expect(value).toBe(roundMoney(unit * 5));
  });

  it('مرتجع كامل يساوي صافي البند حرفياً', () => {
    expect(calcReturnLineValue(lineNetFinal, originalQty, 20)).toBe(lineNetFinal);
  });

  it('مرتجع جزئي 3 عبوات', () => {
    // 29750.5 × 3 / 20 = 4462.575 ← 4462.58
    expect(calcReturnLineValue(lineNetFinal, originalQty, 3)).toBe(4462.58);
  });
});

describe('validateReturnQty', () => {
  it('يسمح بالكمية المتبقية بالضبط', () => {
    expect(() =>
      validateReturnQty({ originalQty: 20, alreadyReturnedQty: 5, requestedQty: 15 }),
    ).not.toThrow();
  });

  it('يمنع التجاوز (20 مباعة − 5 سابقة = 15 كحد أقصى)', () => {
    expect(() =>
      validateReturnQty({ originalQty: 20, alreadyReturnedQty: 5, requestedQty: 15.5 }),
    ).toThrow(/exceeds/);
  });

  it('يمنع الإرجاع لصنف لم يُبع', () => {
    expect(() =>
      validateReturnQty({ originalQty: 0, alreadyReturnedQty: 0, requestedQty: 1 }),
    ).toThrow();
  });

  it('يمنع الكمية السالبة أو الصفر', () => {
    expect(() =>
      validateReturnQty({ originalQty: 10, alreadyReturnedQty: 0, requestedQty: 0 }),
    ).toThrow(/positive/);
  });
});
