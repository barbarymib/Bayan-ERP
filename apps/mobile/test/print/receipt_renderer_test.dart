import 'package:bayan_rep/core/print/receipt.dart';
import 'package:bayan_rep/core/print/receipt_renderer.dart';
import 'package:flutter_test/flutter_test.dart';

ReceiptDoc _doc({int lines = 1}) => ReceiptDoc(
      title: 'بيان أسعار',
      docNumber: 'BP-1',
      date: DateTime(2026, 10, 9, 12, 30),
      customerName: 'عميل 7',
      customerCode: 'C7',
      customerPhone: '0111',
      repName: 'مندوب',
      lines: [
        for (var i = 0; i < lines; i++)
          ReceiptLine(name: 'صنف $i', qty: 2, unitPrice: 50, net: 100),
      ],
      summary: const [
        ReceiptSummaryRow(label: 'الصافي', value: '100.00', emphasis: true),
      ],
      balanceBefore: 100,
      balanceAfter: 200,
      notes: 'ملاحظة',
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ReceiptRenderer', () {
    test('renderPng يعيد صورة PNG صالحة', () async {
      final png = await ReceiptRenderer.renderPng(_doc(), widthPx: 640);
      expect(png, isNotEmpty);
      expect(png.sublist(0, 4), [0x89, 0x50, 0x4E, 0x47], reason: 'بصمة PNG');
    });

    test('renderRgba يعيد بيانات RGBA بالعرض والحجم المتوقعين', () async {
      final raster = await ReceiptRenderer.renderRgba(_doc(), widthPx: 464);
      expect(raster.width, 464);
      expect(raster.rgba.length, raster.width * raster.height * 4);
      expect(raster.height, greaterThan(30));
    });

    test('كلما زادت البنود زاد ارتفاع الصورة', () async {
      final short = await ReceiptRenderer.renderRgba(_doc(lines: 1), widthPx: 640);
      final tall = await ReceiptRenderer.renderRgba(_doc(lines: 12), widthPx: 640);
      expect(tall.height, greaterThan(short.height));
    });

    test('عرض الرسم يناسب أوراق A4/A5 الحرارية', () async {
      for (final width in const [464, 640, 874, 1240]) {
        final raster = await ReceiptRenderer.renderRgba(_doc(), widthPx: width);
        expect(raster.width, width);
        expect(raster.rgba.length, raster.width * raster.height * 4);
      }
    });
  });
}