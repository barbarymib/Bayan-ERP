import 'package:bayan_rep/core/calc/numbering.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('الترقيم الآمن أوفلاين', () {
    test('BP-M03-000127', () {
      expect(formatDocNumber(DocKind.priceStatement, 'M03', 127), 'BP-M03-000127');
    });

    test('بدون كود مندوب: PR-000042', () {
      expect(formatDocNumber(DocKind.purchaseStatement, '', 42), 'PR-000042');
    });

    test('يرفض تسلسلاً غير صالح', () {
      expect(() => formatDocNumber(DocKind.priceStatement, 'M03', 0), throwsArgumentError);
    });

    test('حجز كتلة بعد آخر كتلة', () {
      final b = reserveNextBlock(DocKind.priceStatement, 'M03', 500);
      expect(b.from, 501);
      expect(b.to, 600);
      expect(b.repCode, 'M03');
    });

    test('الكتلة التالية', () {
      final b = nextSequenceInBlock(reserveNextBlock(DocKind.receipt, 'A', 0, size: 10), 0);
      expect(b, 1);
    });

    test('isSequenceInBlock', () {
      final b = reserveNextBlock(DocKind.priceStatement, 'M03', 500);
      expect(isSequenceInBlock(b, 501), isTrue);
      expect(isSequenceInBlock(b, 601), isFalse);
    });
  });
}