import { describe, expect, it } from 'vitest';
import {
  formatDocNumber,
  isSequenceInBlock,
  nextSequenceInBlock,
  reserveNextBlock,
  roundMoney,
  roundQty,
} from '../src/index.js';

describe('التدوير المالي الآمن', () => {
  it('7437.625 ← 7437.63 (half-up)', () => {
    expect(roundMoney(7437.625)).toBe(7437.63);
  });

  it('4462.575 ← 4462.58', () => {
    expect(roundMoney(4462.575)).toBe(4462.58);
  });

  it('0.1 + 0.2 حالة', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  it('سالب: -1.005 ← -1.01 (بعيداً عن الصفر)', () => {
    expect(roundMoney(-1.005)).toBe(-1.01);
  });

  it('كمية: 3 خانات', () => {
    expect(roundQty(10.6561)).toBe(10.656);
    expect(roundQty(1.0005)).toBe(1.001);
  });

  it('يرفض القيم غير المحدودة', () => {
    expect(() => roundMoney(Infinity)).toThrow();
    expect(() => roundMoney(NaN)).toThrow();
    expect(() => roundMoney(1e20)).toThrow(/magnitude/);
  });
});

describe('الترقيم الآمن أوفلاين (بادئة + كود مندوب + كتلة)', () => {
  it('تنسيق: BP-M03-000127', () => {
    expect(formatDocNumber('BP', 'M03', 127)).toBe('BP-M03-000127');
  });

  it('تنسيق المكتب بدون كود مندوب: PR-000042', () => {
    expect(formatDocNumber('PR', '', 42)).toBe('PR-000042');
  });

  it('يمنع تسلسلاً غير صالح', () => {
    expect(() => formatDocNumber('BP', 'M03', 0)).toThrow();
    expect(() => formatDocNumber('BP', 'M03', 1.5)).toThrow();
  });

  it('سنة/فترة للمكتب: BP-2027-000001 (§5.11.8)', () => {
    expect(formatDocNumber('BP', '', 1, 2027)).toBe('BP-2027-000001');
  });

  it('سنة/فترة مع مندوب: BP-M03-2027-000127', () => {
    expect(formatDocNumber('BP', 'M03', 127, 2027)).toBe('BP-M03-2027-000127');
  });

  it('period = 0/فارغ/غير محدد يعيد الصيغة القديمة', () => {
    expect(formatDocNumber('BP', 'M03', 5, 0)).toBe('BP-M03-000005');
    expect(formatDocNumber('BP', 'M03', 5, null)).toBe('BP-M03-000005');
    expect(formatDocNumber('BP', 'M03', 5)).toBe('BP-M03-000005');
    expect(formatDocNumber('PR', '', 5, undefined)).toBe('PR-000005');
  });

  it('حجز كتلة رقمية جديدة بعد آخر كتلة', () => {
    const block = reserveNextBlock('BP', 'M03', 500, 100);
    expect(block).toEqual({ prefix: 'BP', ownerCode: 'M03', from: 501, to: 600 });
  });

  it('الكتلة الأولى تبدأ من 1', () => {
    expect(reserveNextBlock('BP', '', null, 10)).toEqual({
      prefix: 'BP',
      ownerCode: '',
      from: 1,
      to: 10,
    });
  });

  it('تسلسل داخل الكتلة ثم نفادها', () => {
    const block = reserveNextBlock('RT', 'M03', null, 2);
    expect(nextSequenceInBlock(block, null)).toBe(1);
    expect(nextSequenceInBlock(block, 1)).toBe(2);
    expect(() => nextSequenceInBlock(block, 2)).toThrow(/exhausted/);
  });

  it('فحص الانتماء للكتلة', () => {
    const block = reserveNextBlock('BP', 'M03', 100, 100);
    expect(isSequenceInBlock(block, 101)).toBe(true);
    expect(isSequenceInBlock(block, 201)).toBe(false);
  });
});
