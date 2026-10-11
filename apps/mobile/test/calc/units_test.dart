import 'package:bayan_rep/core/calc/units.dart';
import 'package:flutter_test/flutter_test.dart';

const kg = UnitDef(id: 'kg', name: 'كجم', factorToBase: 1, allowDecimal: true);
const bar = UnitDef(id: 'bar', name: 'سيخ', factorToBase: 10.656, allowDecimal: false);
const ton = UnitDef(id: 'ton', name: 'طن', factorToBase: 1000, allowDecimal: true);
const piece = UnitDef(id: 'pc', name: 'قطعة', factorToBase: 1, allowDecimal: false);
const carton = UnitDef(id: 'ctn', name: 'كرتونة', factorToBase: 4, allowDecimal: false);
const bottle = UnitDef(id: 'btl', name: 'عبوة', factorToBase: 1, allowDecimal: false);

void main() {
  group('تحويل الوحدات', () {
    test('سيخ ← كجم', () {
      expect(toBaseQty(1, bar), 10.656);
      expect(toBaseQty(3, bar), 31.968);
    });

    test('طن ← كجم', () => expect(toBaseQty(2.5, ton), 2500));

    test('كجم ← سيخ (يرفض الكسور)', () {
      expect(() => fromBaseQty(5, bar), throwsArgumentError);
      expect(fromBaseQty(10.656, bar), 1);
    });

    test('وحدة عددية ترفض الكسور', () {
      expect(() => toBaseQty(1.5, piece), throwsArgumentError);
      expect(toBaseQty(3, piece), 3);
    });

    test('تحويل مباشر', () {
      expect(convertQty(1, ton, kg), 1000);
      expect(convertQty(1000, kg, ton), 1);
    });

    test('يرفض معامل تحويل غير موجب', () {
      expect(() => fromBaseQty(1000, const UnitDef(id: 'x', name: 'x', factorToBase: 0, allowDecimal: true)), throwsArgumentError);
    });
  });

  group('decomposeQty — العرض المركب', () {
    const paintUnits = [bottle, carton];

    test('22 عبوة = 5 كرتونة + 2 عبوة', () {
      final parts = decomposeQty(22, paintUnits);
      expect(parts.length, 2);
      expect(parts[0].unit.id, 'ctn');
      expect(parts[0].qty, 5);
      expect(parts[1].unit.id, 'btl');
      expect(parts[1].qty, 2);
    });

    test('2500 كجم = 2 طن + 500 كجم', () {
      final parts = decomposeQty(2500, const [kg, ton]);
      expect(parts.length, 2);
      expect(parts[0].unit.id, 'ton');
      expect(parts[0].qty, 2);
      expect(parts[1].unit.id, 'kg');
      expect(parts[1].qty, 500);
    });

    test('رصيد صفر → فارغ', () => expect(decomposeQty(0, paintUnits), isEmpty));
  });
}