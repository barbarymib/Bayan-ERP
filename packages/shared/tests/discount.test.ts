import { describe, expect, it } from 'vitest';
import {
  allocateHeaderDiscount,
  calcHeaderDiscount,
  calcLineDiscount,
  convertDiscount,
  discountToAmount,
  discountToPercent,
  validateDiscount,
} from '../src/index.js';

describe('خصم البند: نسبة أو قيمة ثابتة (§7.4)', () => {
  it('نسبة: خصم 1% على بند 30,000 = 300', () => {
    expect(calcLineDiscount(30000, { type: 'percent', value: 1 })).toBe(300);
  });

  it('قيمة ثابتة: 100 جنيه تخصم من إجمالي البند', () => {
    expect(calcLineDiscount(30000, { type: 'amount', value: 100 })).toBe(100);
  });

  it('حماية: قيمة ثابتة تتجاوز الإجمالي تُقصر عليه (صافي لا يصبح سالباً)', () => {
    expect(calcLineDiscount(100, { type: 'amount', value: 500 })).toBe(100);
    expect(calcLineDiscount(0, { type: 'amount', value: 500 })).toBe(0);
  });

  it('يرفض النسبة فوق 100 والقيمة السالبة', () => {
    expect(() => validateDiscount({ type: 'percent', value: 101 })).toThrow(/100/);
    expect(() => validateDiscount({ type: 'amount', value: -1 })).toThrow(/negative/);
  });
});

describe('خصم البيان وتوزيعه النسبي على البنود (§7.4)', () => {
  it('خصم البيان النسبي يُحسب على صافي البنود بعد خصوماتها', () => {
    const subtotal = 425900;
    expect(calcHeaderDiscount(subtotal, { type: 'percent', value: 0.5 })).toBe(2129.5);
  });

  it('توزيع الخصم الثابت نسبياً مع تصحيح فرق التقريب على آخر بند', () => {
    const allocations = allocateHeaderDiscount([396000, 29900], 100);
    const theirSum = allocations.reduce((a, b) => a + b, 0);
    expect(theirSum).toBe(100);
    expect(allocations).toHaveLength(2);
  });

  it('لا توزيع على صفر بنود أو صفر خصم', () => {
    expect(allocateHeaderDiscount([], 100)).toEqual([]);
    expect(allocateHeaderDiscount([100, 200], 0)).toEqual([0, 0]);
  });
});

describe('التحويل الآلي بين النسبة والقيمة (§5.3)', () => {
  it('نسبة → قيمة: 10% من 30,000 = 3,000 و 10', () => {
    expect(convertDiscount({ type: 'percent', value: 10 }, 30000)).toEqual({ amount: 3000, percent: 10 });
  });

  it('قيمة → نسبة: 3,000 من 30,000 = 10%', () => {
    expect(convertDiscount({ type: 'amount', value: 3000 }, 30000)).toEqual({ amount: 3000, percent: 10 });
  });

  it('قيمة كبيرة على أساس صغير تُقصر على 100%', () => {
    expect(discountToPercent({ type: 'amount', value: 500 }, 100)).toBe(100);
    expect(discountToAmount({ type: 'amount', value: 500 }, 100)).toBe(100);
  });

  it('أساس صفري ⇒ النسبة صفر والقيمة صفر', () => {
    expect(discountToPercent({ type: 'amount', value: 50 }, 0)).toBe(0);
    expect(discountToAmount({ type: 'amount', value: 50 }, 0)).toBe(0);
  });

  it('تقريب النسبة المكافئة إلى خانتين', () => {
    expect(discountToPercent({ type: 'amount', value: 100 }, 30000)).toBe(0.33);
  });
});