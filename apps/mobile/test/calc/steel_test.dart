import 'package:bayan_rep/core/calc/calc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('حاسبة أوزان الحديد', () {
    test('سيخ 12مم طول 12م ≈ 10.654 كجم', () {
      expect(steelBarWeightKg(diameterMm: 12, lengthM: 12), 10.654);
    });

    test('وزن المتر الطولي 12مم ≈ 0.888 و16مم ≈ 1.578 كجم/م', () {
      expect(steelWeightPerMeterKg(12), 0.888);
      expect(steelWeightPerMeterKg(16), 1.578);
    });

    test('وزن 3 أسياخ 12مم × 12م ≈ 31.961 كجم', () {
      expect(steelWeightKg(diameterMm: 12, lengthM: 12, count: 3), 31.961);
    });

    test('يتسق الوزن الكلي مع وزن السيخ الواحد', () {
      final per = steelBarWeightKg(diameterMm: 12, lengthM: 12);
      expect(steelWeightKg(diameterMm: 12, lengthM: 12, count: 1), per);
      expect(steelWeightKg(diameterMm: 12, lengthM: 12, count: 2), 21.308);
    });

    test('يرفض مدخلات غير موجبة', () {
      expect(() => steelBarWeightKg(diameterMm: 0, lengthM: 12), throwsArgumentError);
      expect(() => steelBarWeightKg(diameterMm: 12, lengthM: -1), throwsArgumentError);
      expect(
        () => steelWeightKg(diameterMm: 12, lengthM: 12, count: 0),
        throwsArgumentError,
      );
    });
  });
}