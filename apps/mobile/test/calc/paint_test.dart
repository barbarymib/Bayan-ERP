import 'package:bayan_rep/core/calc/calc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('حاسبة كميات الدهانات', () {
    test('اللترات = المساحة × الوجوه ÷ التغطية', () {
      expect(paintLiters(areaM2: 100, coats: 2, coverageM2PerL: 10), 20);
    });

    test('عدد العبوات يُقرَّب لأعلى', () {
      final r = calcPaint(areaM2: 95, coats: 2, coverageM2PerL: 10, packSizeL: 4);
      expect(r.liters, 19);
      expect(r.packs, 5);
      expect(r.purchasedLiters, 20);
    });

    test('عبوة إضافية عند كسر بسيط', () {
      final r = calcPaint(areaM2: 50, coats: 1, coverageM2PerL: 10, packSizeL: 15);
      expect(r.liters, 5);
      expect(r.packs, 1);
      expect(r.purchasedLiters, 15);
    });

    test('يرفض مدخلات غير موجبة', () {
      expect(
        () => paintLiters(areaM2: 0, coats: 1, coverageM2PerL: 10),
        throwsArgumentError,
      );
      expect(
        () => paintLiters(areaM2: 10, coats: 0, coverageM2PerL: 10),
        throwsArgumentError,
      );
      expect(
        () => calcPaint(areaM2: 10, coats: 1, coverageM2PerL: 10, packSizeL: 0),
        throwsArgumentError,
      );
    });
  });
}