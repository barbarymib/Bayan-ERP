import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

/// أوراق الإخراج: حراري 80/58 ملّم أو A5/A4 للتصدير PDF.
///
/// [renderWidthPx] هو عرض الصورة النقطية المطلوب رسمها:
/// 80 ملّم @203dpi ≈ 640px، 58 ملّم ≈ 464px، A5 @150dpi ≈ 874px، A4 ≈ 1240px.
enum ReceiptPaper {
  receipt80(
    'حراري 80 ملّم',
    PdfPageFormat.roll80,
    640,
  ),
  receipt58(
    'حراري 58 ملّم',
    PdfPageFormat.roll57,
    464,
  ),
  a5('ورقة A5', PdfPageFormat.a5, 874),
  a4('ورقة A4', PdfPageFormat.a4, 1240);

  const ReceiptPaper(this.label, this.pageFormat, this.renderWidthPx);

  final String label;
  final PdfPageFormat pageFormat;
  final int renderWidthPx;
}

/// يبني ملف PDF يحوي المستند كصورة نقطية [pngBytes] على الورقة المختارة.
///
/// الاعتماد على الصورة يضمن سلامة التشكيل العربي بصرف النظر عن خطوط القارئ.
/// تنزّل الصورة بعرض الورقة كاملاً (الحواف هامش داخلي ضمن الصورة ذاتها).
Future<Uint8List> buildReceiptPdf(
  Uint8List pngBytes, {
  required ReceiptPaper paper,
}) async {
  final doc = pw.Document();
  doc.addPage(
    pw.Page(
      // الصورة تحمل هوامشها البيضاء الخاصة؛ لذلك صفحة بلا هوامش إضافية
      // (الصفحات الحرارية roll تُحجَّم ذاتياً بارتفاع الصورة).
      pageFormat: paper.pageFormat.copyWith(
        marginTop: 0,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
      ),
      margin: pw.EdgeInsets.zero,
      build: (_) => pw.Image(
        pw.MemoryImage(pngBytes),
        fit: pw.BoxFit.contain,
      ),
    ),
  );
  return doc.save();
}

/// يتضمن السطر الختامي `%%EOF` الخاص بملف PDF صالح.
bool looksLikePdf(Uint8List bytes) {
  if (bytes.length < 5) return false;
  return bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44 && bytes[3] == 0x46;
}