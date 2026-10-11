# ADR-0013: عارض الطباعة الموحّد (Canvas ← حرارية + PDF)

- **الحالة:** مقبول ✅ (مُنفَّذ)
- **التاريخ:** 6 أكتوبر 2026

## السياق
التعليمات القبض: طباعة بلوتوث حرارية (80/58مم) ومشاركة PDF من Flutter على Android، بنفس المستند العربي الصحيح الشكل. مكتبات أبسط تنسيقات تُنتج نتائج متقطعة للحروف العربية المتصلة.

## القرار
- **عارض واحد (`dart:ui` Canvas مع TextPainter)** = «مصدر حقيقة» واحد للمستند: يُرسم `ReceiptDoc` لـ PNG (تشكيل عربي صحيح تلقائياً).
- **استخدامات متعددة لنفس PNG:**
  - الطباعة الحرارية: مسار `EscPos` يبني bytes (init/align/feed/raster `GS v 0`/cut) بتحويل RGBA→1bit.
  - PDF للمشاركة: يضمّن PNG في صفحة متناسبة (أحجام A4/A5/roll80/roll57؛ حواف صفرية).
- **عرضات الرسم** ثابتة لكل تنسيق (80=640, 58=464, A5=874, A4=1240).
- `PrintController` يدير الدوران: scan/select/paper/connect/print/sharePdf، و`BluetoothPrinter` مجرّد مع اتصال بلوتوث `bluetooth_print_plus` وسجل `session_store.printerAddress`.

## العواقب
- ✅ مستند واحد مُسَلّس نحو الأمام للتطبيق الحراري وPDF (بلا انحراف).
- ✅ تغطية اختبارية باختبارات Rendering من دون مكتبات مادية (شكّل/أبعاد).
- ⚠️ لا يوجد طابعة فعلية للتحقق هنا — اختبارات الوحدة فقط للتحقق هنا.

## المراجع
- `apps/mobile/lib/core/print/{receipt,esc_pos,receipt_renderer,pdf_export,printer}.dart`, `apps/mobile/lib/features/print/*`.
- E3 في `../memory.md`, `../bayan-design.md` §5.12.