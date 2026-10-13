import 'package:bayan_rep/core/calc/calc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('معادلة تقييم المخزون §7.4', () {
    test('قيمة بند = رصيد الأساس × تكلفة الوحدة', () {
      expect(calcStockLineValue(22, 1500), 33000);
    });

    test('الإجمالي = مجموع قيم البنود', () {
      final rows = [
        const ValuationLineInput(qtyBase: 22, lastPurchaseCost: 1500),
        const ValuationLineInput(qtyBase: 3.5, lastPurchaseCost: 80.5),
        const ValuationLineInput(qtyBase: 100, lastPurchaseCost: 12.25),
      ];
      final total = calcStockValue(rows, ValuationMethod.last);
      expect(total.qtyBase, 125.5);
      expect(total.value, 34506.75);
    });

    test('غياب آخر سعر شراء يُقيَّم بصفر', () {
      final total = calcStockValue(
        [const ValuationLineInput(qtyBase: 10)],
        ValuationMethod.last,
      );
      expect(total.qtyBase, 10);
      expect(total.value, 0);
    });

    test('يدعم الكميات الكسرية بالتدوير الكميّ', () {
      // roundQty(0.3335) = 0.334 ← × 100 = 33.4
      expect(calcStockLineValue(0.3335, 100), 33.4);
    });
  });

  group('المتوسط المرجح (WEIGHTED)', () {
    test('= Σ(كمية×تكلفة) ÷ Σ(كمية)', () {
      expect(
        weightedAverageCost([
          const PurchaseLot(qtyBase: 10, cost: 100),
          const PurchaseLot(qtyBase: 30, cost: 200),
        ]),
        175,
      );
    });

    test('يتجاهل الكميات غير الموجبة', () {
      expect(
        weightedAverageCost([
          const PurchaseLot(qtyBase: 10, cost: 100),
          const PurchaseLot(qtyBase: 0, cost: 999),
          const PurchaseLot(qtyBase: -5, cost: 999),
        ]),
        100,
      );
    });

    test('يساوي صفراً بدون مشتريات', () {
      expect(weightedAverageCost([]), 0);
    });
  });

  group('resolveUnitCost حسب الطريقة', () {
    const line = ValuationLineInput(
      qtyBase: 4,
      lastPurchaseCost: 250,
      purchases: [
        PurchaseLot(qtyBase: 2, cost: 200),
        PurchaseLot(qtyBase: 2, cost: 300),
      ],
      salePrice: 500,
    );

    test('LAST يعيد آخر سعر شراء', () {
      expect(resolveUnitCost(line, ValuationMethod.last), 250);
    });

    test('WEIGHTED يعيد المتوسط المرجح', () {
      expect(resolveUnitCost(line, ValuationMethod.weighted), 250);
    });

    test('SALES يعيد سعر البيع', () {
      expect(resolveUnitCost(line, ValuationMethod.sales), 500);
    });

    test('الافتراضي LAST', () {
      expect(resolveUnitCost(const ValuationLineInput(qtyBase: 1, lastPurchaseCost: 7)), 7);
    });
  });

  group('اتساق التقييم', () {
    test('قيمة SALES للرصيد 4 = 2000', () {
      final total = calcStockValue(
        [const ValuationLineInput(qtyBase: 4, salePrice: 500)],
        ValuationMethod.sales,
      );
      expect(total.qtyBase, 4);
      expect(total.value, 2000);
    });

    test('القيمة تُقرَّب مالياً (تطابق roundMoney)', () {
      final total = calcStockValue(
        [const ValuationLineInput(qtyBase: 3, lastPurchaseCost: 10.111)],
        ValuationMethod.last,
      );
      expect(total.value, roundMoney(3 * 10.111));
      expect(total.value, 30.33);
    });
  });
}
