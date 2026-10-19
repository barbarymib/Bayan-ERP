import { describe, expect, it } from 'vitest';
import {
  allowsDecimalByMeasurement,
  assertQtyAllowed,
  convertQty,
  decomposeQty,
  formatCompositeQty,
  fromBaseQty,
  toBaseQty,
  type UnitDef,
} from '../src/index.js';

const kg: UnitDef = { id: 'kg', name: 'كجم', factorToBase: 1, allowDecimal: true };
const bar: UnitDef = { id: 'bar', name: 'سيخ', factorToBase: 10.656, allowDecimal: false };
const ton: UnitDef = { id: 'ton', name: 'طن', factorToBase: 1000, allowDecimal: true };
const piece: UnitDef = { id: 'pc', name: 'قطعة', factorToBase: 1, allowDecimal: false };
const carton: UnitDef = { id: 'ctn', name: 'كرتونة', factorToBase: 4, allowDecimal: false };
const bottle: UnitDef = { id: 'btl', name: 'عبوة', factorToBase: 1, allowDecimal: false };

describe('تحويل الوحدات', () => {
  it('سيخ ← كجم (وزني بـ 3 خانات)', () => {
    expect(toBaseQty(1, bar)).toBe(10.656);
    expect(toBaseQty(3, bar)).toBe(31.968);
  });

  it('طن ← كجم', () => {
    expect(toBaseQty(2.5, ton)).toBe(2500);
  });

  it('كجم ← سيخ (عددي: يرفض كسور السيخ)', () => {
    expect(() => fromBaseQty(5, bar)).toThrow(/whole units/);
    expect(fromBaseQty(10.656, bar)).toBe(1);
  });

  it('وحدة عددية ترفض كسوراً عند الإدخال', () => {
    expect(() => toBaseQty(1.5, piece)).toThrow(/fractional/);
    expect(toBaseQty(3, piece)).toBe(3);
  });

  it('تحويل مباشر بين وحدتين', () => {
    expect(convertQty(1, ton, kg)).toBe(1000);
    expect(convertQty(1000, kg, ton)).toBe(1);
  });

  it('يرفض معامل تحويل غير موجب', () => {
    expect(() => fromBaseQty(1000, { ...ton, factorToBase: 0 })).toThrow(/positive/);
    expect(() => fromBaseQty(1000, { ...ton, factorToBase: -1 })).toThrow(/positive/);
  });
});

describe('assertQtyAllowed — نوع القياس (§5.2)', () => {
  it('COUNT يرفض الكسور ويقبل الأعداد الصحيحة', () => {
    expect(allowsDecimalByMeasurement('COUNT')).toBe(false);
    expect(() => assertQtyAllowed(1.5, false, 'قطعة')).toThrow(/integer-only/);
    expect(() => assertQtyAllowed(3, false, 'قطعة')).not.toThrow();
  });

  it('WEIGHT يقبل الكسور', () => {
    expect(allowsDecimalByMeasurement('WEIGHT')).toBe(true);
    expect(() => assertQtyAllowed(2.125, true, 'كجم')).not.toThrow();
  });

  it('يرفض الكميات غير المنتهية', () => {
    expect(() => assertQtyAllowed(Number.NaN, true, 'كجم')).toThrow(/finite/);
    expect(() => assertQtyAllowed(Number.POSITIVE_INFINITY, true, 'كجم')).toThrow(/finite/);
  });
});

describe('decomposeQty — العرض المركب', () => {
  const paintUnits = [bottle, carton];

  it('22 عبوة = 5 كرتونة + 2 عبوة (المثال من التصميم)', () => {
    const parts = decomposeQty(22, paintUnits);
    expect(parts).toEqual([
      { unit: carton, qty: 5 },
      { unit: bottle, qty: 2 },
    ]);
  });

  it('عرض الحديدين: 2500 كجم = 1 طن + 235 كجم (وحدة 1000)', () => {
    const parts = decomposeQty(2500, [kg, ton]);
    expect(parts).toEqual([
      { unit: ton, qty: 2 },
      { unit: kg, qty: 500 },
    ]);
  });

  it('رصيد صفر يُرجع مصفوفة فارغة', () => {
    expect(decomposeQty(0, paintUnits)).toEqual([]);
  });
});

describe('formatCompositeQty — نص العرض المركب (G12 §5.2)', () => {
  it('22 عبوة = "5 كرتونة + 2 عبوة" (المثال من التصميم)', () => {
    expect(formatCompositeQty(22, [bottle, carton])).toBe('5 كرتونة + 2 عبوة');
  });

  it('2500 كجم = "2 طن + 500 كجم"', () => {
    expect(formatCompositeQty(2500, [kg, ton])).toBe('2 طن + 500 كجم');
  });

  it('الرصيد الصفر = "0"', () => {
    expect(formatCompositeQty(0, [kg, ton])).toBe('0');
  });

  it('وحدة واحدة = القيمة باسم الوحدة', () => {
    expect(formatCompositeQty(3, [carton])).toBe('3 كرتونة');
  });

  it('يرفض الكميات السالبة', () => {
    expect(() => formatCompositeQty(-1, [kg, carton])).toThrow(/negative/);
  });
});
