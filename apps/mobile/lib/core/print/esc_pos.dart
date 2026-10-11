import 'dart:typed_data';

/// بانِي أوامر ESC/POS خام بنسخة Dart نقية (بدون قنوات منصة) قابلة للاختبار مباشرة.
///
/// تُطبع البيانات النصية العربية كصورة نقطية (`GS v 0`) لتفادي مشكلات صفحات
/// الترميز غير المدعومة على الطابعات الحرارية.
class EscPos {
  final BytesBuilder _out = BytesBuilder();

  /// تهيئة الطابعة.
  EscPos init() {
    _out.add(<int>[0x1B, 0x40]);
    return this;
  }

  /// محاذاة لليسار.
  EscPos alignLeft() {
    _out.add(<int>[0x1B, 0x61, 0x00]);
    return this;
  }

  /// محاذاة للوسط.
  EscPos alignCenter() {
    _out.add(<int>[0x1B, 0x61, 0x01]);
    return this;
  }

  /// محاذاة لليمين.
  EscPos alignRight() {
    _out.add(<int>[0x1B, 0x61, 0x02]);
    return this;
  }

  /// تغذية [lines] أسطر فارغة (0–255).
  EscPos feedLines(int lines) {
    final n = lines < 0 ? 0 : (lines > 255 ? 255 : lines);
    _out.add(<int>[0x1B, 0x64, n]);
    return this;
  }

  /// طباعة صورة نقطية بتنسيق `GS v 0` (الوضع الافتراضي 0).
  ///
  /// [data] بيانات أحادية البت (بايت لكل 8 نقاط، البت الأعلى أولاً) جاهزة من
  /// [rasterFromRgba]. [widthDots] عرض الصورة بالنقاط، [heightDots] ارتفاعها.
  EscPos imageRaster(
    Uint8List data, {
    required int widthDots,
    required int heightDots,
  }) {
    final widthBytes = (widthDots + 7) >> 3;
    _out.add(<int>[
      0x1D, 0x76, 0x30, 0x00,
      widthBytes & 0xFF, (widthBytes >> 8) & 0xFF,
      heightDots & 0xFF, (heightDots >> 8) & 0xFF,
    ]);
    _out.add(data);
    return this;
  }

  /// قطع الورق (جزئي).
  EscPos cut() {
    _out.add(<int>[0x1D, 0x56, 0x42, 0x00]);
    return this;
  }

  /// الأمر النهائي.
  Uint8List get bytes => _out.takeBytes();
}

/// يحوّل صورة RGBA إلى صورة أحادية البت جاهزة لأمر `GS v 0`.
///
/// تُعدّ النقطة سوداء إذا كانت شبه شفافة أو سطوعها دون [threshold].
Uint8List rasterFromRgba(
  Uint8List rgba, {
  required int width,
  required int height,
  int threshold = 128,
}) {
  final widthBytes = (width + 7) >> 3;
  final out = Uint8List(widthBytes * height);
  for (var y = 0; y < height; y++) {
    final rowBase = y * width;
    for (var x = 0; x < width; x++) {
      final i = (rowBase + x) * 4;
      final alpha = rgba[i + 3];
      final luma = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) ~/ 1000;
      if (alpha < 128 || luma < threshold) {
        out[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }
  return out;
}
