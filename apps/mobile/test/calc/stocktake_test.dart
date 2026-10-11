import 'package:bayan_rep/core/calc/stocktake.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('diffOfStocktakeLine', () {
    test('زيادة', () {
      final r = diffOfStocktakeLine(const StocktakeLineInput(systemQtyBase: 100, countedQtyBase: 103, lastCost: 25));
      expect(r.diffQty, 3);
      expect(r.diffValue, 75);
    });

    test('عجز', () {
      final r = diffOfStocktakeLine(const StocktakeLineInput(systemQtyBase: 1000, countedQtyBase: 999.5, lastCost: 25));
      expect(r.diffQty, -0.5);
      expect(r.diffValue, -12.5);
    });

    test('بلا سعر', () {
      final r = diffOfStocktakeLine(const StocktakeLineInput(systemQtyBase: 4, countedQtyBase: 5));
      expect(r.diffQty, 1);
      expect(r.diffValue, 0);
    });

    test('غير مُعدّ', () {
      final r = diffOfStocktakeLine(const StocktakeLineInput(systemQtyBase: 30));
      expect(r.diffQty, 0);
      expect(r.diffValue, 0);
    });
  });

  group('summarizeStocktake', () {
    const sample = [
      StocktakeLineInput(systemQtyBase: 100, countedQtyBase: 110, lastCost: 2), // +10 → 20
      StocktakeLineInput(systemQtyBase: 50, countedQtyBase: 45, lastCost: 4), // -5 → -20
      StocktakeLineInput(systemQtyBase: 4), // غير مُعدّ
      StocktakeLineInput(systemQtyBase: 3, countedQtyBase: 3, lastCost: 9), // صفر
    ];

    test('الأعداد', () {
      final s = summarizeStocktake(sample);
      expect(s.lines, 4);
      expect(s.countedLines, 3);
      expect(s.uncountedLines, 1);
    });

    test('الزيادة والعجز', () {
      final s = summarizeStocktake(sample);
      expect(s.surplusLines, 1);
      expect(s.surplusQty, 10);
      expect(s.surplusValue, 20);
      expect(s.deficitLines, 1);
      expect(s.deficitQty, 5);
      expect(s.deficitValue, 20);
      expect(s.totalDiffQty, 5);
      expect(s.totalDiffValue, 0);
    });

    test('بنود بلا سعر', () {
      final s = summarizeStocktake(const [StocktakeLineInput(systemQtyBase: 4, countedQtyBase: 5)]);
      expect(s.noCostLines, 1);
    });
  });
}