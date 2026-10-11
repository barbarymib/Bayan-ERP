import 'dart:typed_data';

import 'package:bayan_rep/core/print/esc_pos.dart';
import 'package:flutter_test/flutter_test.dart';

Uint8List _rgba({required int width, required int height, bool transparent = false}) {
  final data = Uint8List(width * height * 4);
  for (var i = 0; i < width * height; i++) {
    // خلفية بيضاء (255) إلا إذا شُفّفت الصورة.
    data[i * 4] = transparent ? 0 : 255;
    data[i * 4 + 1] = transparent ? 0 : 255;
    data[i * 4 + 2] = transparent ? 0 : 255;
    data[i * 4 + 3] = transparent ? 0 : 255;
  }
  return data;
}

void main() {
  group('EscPos', () {
    test('أمر التهيئة ESC @', () {
      expect(EscPos().init().bytes, [0x1B, 0x40]);
    });

    test('المحاذاة ESC a n', () {
      expect(EscPos().alignLeft().bytes, [0x1B, 0x61, 0x00]);
      expect(EscPos().alignCenter().bytes, [0x1B, 0x61, 0x01]);
      expect(EscPos().alignRight().bytes, [0x1B, 0x61, 0x02]);
    });

    test('التغذية مقيّدة 0–255', () {
      expect(EscPos().feedLines(3).bytes, [0x1B, 0x64, 3]);
      expect(EscPos().feedLines(-1).bytes, [0x1B, 0x64, 0]);
      expect(EscPos().feedLines(300).bytes, [0x1B, 0x64, 255]);
    });

    test('القطع جزئي GS V B 0', () {
      expect(EscPos().cut().bytes, [0x1D, 0x56, 0x42, 0x00]);
    });

    test('صورة GS v 0: رأس 8 بايتات ثم البيانات', () {
      final bitmap = rasterFromRgba(_rgba(width: 8, height: 2), width: 8, height: 2);
      final esc = EscPos()..imageRaster(bitmap, widthDots: 8, heightDots: 2);
      final b = esc.bytes;
      expect(b.sublist(0, 4), [0x1D, 0x76, 0x30, 0x00], reason: 'GS v 0 mode 0');
      // عرض البايت (xl,xh) والارتفاع (yl,yh).
      expect(b[4], 1); // 8 نقاط = 1 بايت
      expect(b[5], 0);
      expect(b[6], 2); // ارتفاع نقطتان
      expect(b[7], 0);
      expect(b.length, 8 + bitmap.length);
    });

    test('سلاسل كاملة: تهيئة + صورة + تغذية + قطع', () {
      final bitmap = rasterFromRgba(_rgba(width: 8, height: 1), width: 8, height: 1);
      final b = (EscPos()
            ..init()
            ..imageRaster(bitmap, widthDots: 8, heightDots: 1)
            ..feedLines(4)
            ..cut())
          .bytes;
      expect(b.sublist(0, 2), [0x1B, 0x40]);
      expect(b.sublist(2, 6), [0x1D, 0x76, 0x30, 0x00]);
      final dataStart = 2 + 8;
      final dataEnd = dataStart + bitmap.length;
      expect(b.sublist(dataEnd, dataEnd + 3), [0x1B, 0x64, 4]);
      expect(b.sublist(dataEnd + 3), [0x1D, 0x56, 0x42, 0x00]);
    });

    test('عرض يتجاوز 255 بايت يستخدم xl+xh', () {
      final bitmap =
          rasterFromRgba(_rgba(width: 2032, height: 1), width: 2032, height: 1);
      final b = (EscPos()..imageRaster(bitmap, widthDots: 2032, heightDots: 1)).bytes;
      // 2032 نقطة = 254 بايتاً.
      expect(b[4], 254);
      expect(b[5], 0);
    });
  });

  group('rasterFromRgba', () {
    test('تُحدَّد النقاط السوداء في البت الأعلى أولاً', () {
      final rgba = _rgba(width: 8, height: 2);
      // اجعل x=0 وx=7 في الصف الأول أسود.
      void black(int x, int y) {
        final i = (y * 8 + x) * 4;
        rgba[i] = 0;
        rgba[i + 1] = 0;
        rgba[i + 2] = 0;
        rgba[i + 3] = 255;
      }

      black(0, 0);
      black(7, 0);
      final out = rasterFromRgba(rgba, width: 8, height: 2);
      expect(out.length, 2, reason: 'بايت لكل صف');
      expect(out[0], 0x81);
      expect(out[1], 0x00);
    });

    test('البكسلات الشفافة تُعدّ سوداء', () {
      final rgba = _rgba(width: 8, height: 1, transparent: true);
      final out = rasterFromRgba(rgba, width: 8, height: 1);
      expect(out[0], 0xFF);
    });

    test('عتبة السطوع قابلة للضبط', () {
      final rgba = _rgba(width: 1, height: 1);
      rgba[0] = 100;
      rgba[1] = 100;
      rgba[2] = 100;
      rgba[3] = 255;
      expect(rasterFromRgba(rgba, width: 1, height: 1)[0] & 0x80, 0x80, reason: '100 < 128');
      expect(
        rasterFromRgba(rgba, width: 1, height: 1, threshold: 50)[0] & 0x80,
        0x00,
        reason: '100 > 50 ⇒ أبيض',
      );
    });
  });
}