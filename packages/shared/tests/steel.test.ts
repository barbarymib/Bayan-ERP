import { describe, expect, it } from 'vitest';
import {
  STEEL_DENSITY_KG_M3,
  steelBarWeightKg,
  steelWeightKg,
  steelWeightPerMeterKg,
} from '../src/index.js';

describe('حاسبة أوزان الحديد', () => {
  it('كثافة الحديد القياسية', () => {
    expect(STEEL_DENSITY_KG_M3).toBe(7850);
  });

  it('سيخ 12مم طول 12م ≈ 10.654 كجم', () => {
    expect(steelBarWeightKg({ diameterMm: 12, lengthM: 12 })).toBe(10.654);
  });

  it('وزن المتر الطولي لسيخ 12مم ≈ 0.888 كجم/م', () => {
    expect(steelWeightPerMeterKg(12)).toBe(0.888);
    expect(steelWeightPerMeterKg(16)).toBe(1.578);
  });

  it('وزن 3 أسياخ 12مم × 12م ≈ 31.961 كجم', () => {
    expect(steelWeightKg({ diameterMm: 12, lengthM: 12, count: 3 })).toBe(31.961);
  });

  it('يتسق الوزن الكلي مع وزن السيخ الواحد', () => {
    const per = steelBarWeightKg({ diameterMm: 12, lengthM: 12 });
    expect(steelWeightKg({ diameterMm: 12, lengthM: 12, count: 1 })).toBe(per);
    expect(steelWeightKg({ diameterMm: 12, lengthM: 12, count: 2 })).toBe(21.308);
  });

  it('يرفض المدخلات غير الموجبة', () => {
    expect(() => steelWeightKg({ diameterMm: 0, lengthM: 12, count: 1 })).toThrow(/positive/);
    expect(() => steelWeightKg({ diameterMm: 12, lengthM: -1, count: 1 })).toThrow(/positive/);
    expect(() => steelWeightKg({ diameterMm: 12, lengthM: 12, count: 0 })).toThrow(/positive/);
  });
});