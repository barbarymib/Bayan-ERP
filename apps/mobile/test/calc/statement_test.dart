import 'package:bayan_rep/core/calc/calc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('calcStatementTotals — المثال المرجعي (§13)', () {
    final result = calcStatementTotals(StatementTotalsInput(
      lines: const [
        StatementLineInput(qty: 10, unitPrice: 40000, discount: Discount(DiscountType.percent, 1)),
        StatementLineInput(qty: 20, unitPrice: 1500, discount: Discount(DiscountType.amount, 100)),
      ],
      headerDiscount: const Discount(DiscountType.percent, 0.5),
    ));

    test('البند 1: إجمالي 400000 خصم 4000 صافي 396000 نصيب 1980 نهائي 394020', () {
      final l = result.lines[0];
      expect(l.gross, 400000);
      expect(l.lineDiscountAmount, 4000);
      expect(l.netAfterLineDiscount, 396000);
      expect(l.allocatedHeaderDiscount, 1980);
      expect(l.netFinal, 394020);
    });

    test('البند 2: إجمالي 30000 خصم 100 صافي 29900 نصيب 149.5 نهائي 29750.5', () {
      final l = result.lines[1];
      expect(l.gross, 30000);
      expect(l.lineDiscountAmount, 100);
      expect(l.netAfterLineDiscount, 29900);
      expect(l.allocatedHeaderDiscount, 149.5);
      expect(l.netFinal, 29750.5);
    });

    test('الإجماليات: فرعي 425900 — خصم 2129.5 — صافي 423770.5', () {
      expect(result.subtotal, 425900);
      expect(result.headerDiscountAmount, 2129.5);
      expect(result.net, 423770.5);
      expect(result.tax, 0);
      expect(result.shipping, 0);
    });

    test('مجموع الصافي النهائي للبنود = صافي البيان', () {
      final sum = result.lines.fold<double>(0, (s, l) => s + l.netFinal);
      expect(roundMoney(sum), result.net);
    });
  });

  group('خصم البيان — القيمة الثابتة والنسبة', () {
    test('خصم ثابت يُوزَّع مع تصحيح التقريب', () {
      final t = calcStatementTotals(StatementTotalsInput(
        lines: const [
          StatementLineInput(qty: 1, unitPrice: 100),
          StatementLineInput(qty: 1, unitPrice: 200),
          StatementLineInput(qty: 1, unitPrice: 300),
        ],
        headerDiscount: const Discount(DiscountType.amount, 100),
      ));
      final allocated = t.lines.fold<double>(0, (s, l) => s + l.allocatedHeaderDiscount);
      expect(roundMoney(allocated), 100);
      expect(t.net, 500);
    });

    test('خصم 100% يصفّر الصافي', () {
      final t = calcStatementTotals(StatementTotalsInput(
        lines: const [StatementLineInput(qty: 5, unitPrice: 10)],
        headerDiscount: const Discount(DiscountType.percent, 100),
      ));
      expect(t.net, 0);
      expect(t.lines[0].netFinal, 0);
    });

    test('بند بخصم 100% لا يحصل على نصيب', () {
      final t = calcStatementTotals(StatementTotalsInput(
        lines: const [
          StatementLineInput(qty: 1, unitPrice: 100, discount: Discount(DiscountType.percent, 100)),
          StatementLineInput(qty: 1, unitPrice: 100),
        ],
        headerDiscount: const Discount(DiscountType.amount, 20),
      ));
      expect(t.lines[0].allocatedHeaderDiscount, 0);
      expect(t.lines[1].allocatedHeaderDiscount, 20);
    });

    test('نقل وضريبة بعد خصم البيان', () {
      final t = calcStatementTotals(StatementTotalsInput(
        lines: const [StatementLineInput(qty: 1, unitPrice: 1000, discount: Discount(DiscountType.percent, 10))],
        headerDiscount: const Discount(DiscountType.percent, 10),
        shipping: 50,
        taxPercent: 14,
      ));
      expect(t.subtotal, 900);
      expect(t.headerDiscountAmount, 90);
      expect(t.shipping, 50);
      expect(t.tax, 120.4);
      expect(t.net, 980.4);
    });

    test('يرفض الكمية/السعر السالب', () {
      expect(
        () => calcStatementTotals(StatementTotalsInput(lines: const [StatementLineInput(qty: -1, unitPrice: 10)])),
        throwsArgumentError,
      );
      expect(
        () => calcStatementTotals(StatementTotalsInput(lines: const [StatementLineInput(qty: 1, unitPrice: -10)])),
        throwsArgumentError,
      );
    });
  });

  group('allocateHeaderDiscount', () {
    test('خصم صفري → أصفار', () => expect(allocateHeaderDiscount([100, 200], 0), [0, 0]));
    test('بنود فارغة → []', () => expect(allocateHeaderDiscount([], 50), isEmpty));
  });
}