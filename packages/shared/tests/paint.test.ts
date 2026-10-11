import { describe, expect, it } from 'vitest';
import { paintLiters, paintPacks, calcPaint } from '../src/index.js';

describe('حاسبة كميات الدهانات', () => {
  it('اللترات = المساحة × الوجهات ÷ التغطية', () => {
    expect(paintLiters({ areaM2: 100, coats: 2, coverageM2PerLiter: 10 })).toBe(20);
  });

  it('عدد العبوات يُقرَّب لأعلى', () => {
    expect(
      paintPacks({ areaM2: 100, coats: 2, coverageM2PerLiter: 10, packSizeL: 4 }),
    ).toBe(5);
    expect(
      paintPacks({ areaM2: 95, coats: 2, coverageM2PerLiter: 10, packSizeL: 4 }),
    ).toBe(5); // 19 لتر ⇒ 5 عبوات
  });

  it('النتيجة الكاملة تشمل إجمالي اللترات المشتراة', () => {
    const r = calcPaint({ areaM2: 120, coats: 2, coverageM2PerLiter: 12, packSizeL: 5 });
    expect(r.liters).toBe(20);
    expect(r.packs).toBe(4);
    expect(r.totalLiters).toBe(20);
  });

  it('تقرير عبوات كسري ⇒ عبوة إضافية', () => {
    const r = calcPaint({ areaM2: 50, coats: 1, coverageM2PerLiter: 10, packSizeL: 15 });
    expect(r.liters).toBe(5);
    expect(r.packs).toBe(1);
    expect(r.totalLiters).toBe(15);
  });

  it('يرفض مدخلات غير موجبة', () => {
    expect(() => paintLiters({ areaM2: 0, coats: 1, coverageM2PerLiter: 10 })).toThrow(/positive/);
    expect(() => paintLiters({ areaM2: 10, coats: 0, coverageM2PerLiter: 10 })).toThrow(
      /positive/,
    );
    expect(() => paintLiters({ areaM2: 10, coats: 1, coverageM2PerLiter: 0 })).toThrow(/positive/);
    expect(() =>
      paintPacks({ areaM2: 10, coats: 1, coverageM2PerLiter: 10, packSizeL: 0 }),
    ).toThrow(/positive/);
  });
});