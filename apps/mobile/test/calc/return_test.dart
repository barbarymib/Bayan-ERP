import 'package:bayan_rep/core/calc/calc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const lineNetFinal = 29750.5;
  const originalQty = 20.0;

  group('تسعير المرتجع بصافي البيان الأصلي', () {
    test('سعر وحدة المرتجع الأساسي (دقيق) = 1487.525', () {
      expect(calcReturnUnitNetPrice(lineNetFinal, originalQty), 1487.525);
    });

    test('قيمة مرتجع 5 عبوات = 7437.63', () {
      final unit = calcReturnUnitNetPrice(lineNetFinal, originalQty);
      expect(calcReturnLineValue(lineNetFinal, originalQty, 5), 7437.63);
      expect(calcReturnLineValue(lineNetFinal, originalQty, 5), roundMoney(unit * 5));
    });

    test('مرتجع كامل = صافي البند', () {
      expect(calcReturnLineValue(lineNetFinal, originalQty, 20), lineNetFinal);
    });

    test('مرتجع جزئي 3 عبوات = 4462.58', () {
      expect(calcReturnLineValue(lineNetFinal, originalQty, 3), 4462.58);
    });
  });

  group('validateReturnQty', () {
    test('يسمح بالبقية', () {
      expect(
        () => validateReturnQty(originalQty: 20, alreadyReturnedQty: 5, requestedQty: 15),
        returnsNormally,
      );
    });

    test('يمنع التجاوز', () {
      expect(
        () => validateReturnQty(originalQty: 20, alreadyReturnedQty: 5, requestedQty: 15.5),
        throwsArgumentError,
      );
    });

    test('يمنع إرجاع صنف لم يُبع', () {
      expect(
        () => validateReturnQty(originalQty: 0, alreadyReturnedQty: 0, requestedQty: 1),
        throwsArgumentError,
      );
    });

    test('يمنع الصفر', () {
      expect(
        () => validateReturnQty(originalQty: 10, alreadyReturnedQty: 0, requestedQty: 0),
        throwsArgumentError,
      );
    });
  });
}