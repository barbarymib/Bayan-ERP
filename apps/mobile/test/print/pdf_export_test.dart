import 'dart:typed_data';

import 'package:bayan_rep/core/print/pdf_export.dart';
import 'package:bayan_rep/core/print/receipt.dart';
import 'package:bayan_rep/core/print/receipt_renderer.dart';
import 'package:flutter_test/flutter_test.dart';

ReceiptDoc _doc() => ReceiptDoc(
      title: 'بيان أسعار',
      docNumber: 'BP-1',
      date: DateTime(2026, 10, 9, 12, 30),
      customerName: 'عميل 7',
      lines: const [
        ReceiptLine(name: 'صنف', qty: 1, unitPrice: 10, net: 10),
      ],
      summary: const [
        ReceiptSummaryRow(label: 'الصافي', value: '10.00', emphasis: true),
      ],
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('buildReceiptPdf', () {
    late List<int> png;

    setUp(() async {
      png = await ReceiptRenderer.renderPng(_doc(), widthPx: ReceiptPaper.receipt80.renderWidthPx);
    });

    test('كل الأوراق تنتج ملف PDF صالحاً', () async {
      for (final paper in ReceiptPaper.values) {
        final pdf = await buildReceiptPdf(Uint8List.fromList(png), paper: paper);
        expect(looksLikePdf(pdf), isTrue, reason: paper.label);
        expect(pdf.length, greaterThan(500), reason: paper.label);
        expect(String.fromCharCodes(pdf).contains('/MediaBox'), isTrue, reason: paper.label);
      }
    });

    test('عرض ورقة 80 ملّم ≈ 226.8 نقطة PDF', () async {
      final pdf = await buildReceiptPdf(
        Uint8List.fromList(png),
        paper: ReceiptPaper.receipt80,
      );
      final text = String.fromCharCodes(pdf);
      expect(text.contains('226.7'), isTrue, reason: '80mm @72dpi');
    });

    test('عرض A4 أكبر بوضوح من ورقة حرارية', () async {
      final a4 = await buildReceiptPdf(Uint8List.fromList(png), paper: ReceiptPaper.a4);
      final receipt = await buildReceiptPdf(
        Uint8List.fromList(png),
        paper: ReceiptPaper.receipt80,
      );
      expect(String.fromCharCodes(a4).contains('595.'), isTrue, reason: 'A4 عرض 210mm');
      expect(a4.length, greaterThan(receipt.length));
    });
  });
}