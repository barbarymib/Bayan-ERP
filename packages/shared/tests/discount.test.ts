import { describe, expect, it } from 'vitest';
import {
  allocateHeaderDiscount,
  calcHeaderDiscount,
  calcLineDiscount,
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