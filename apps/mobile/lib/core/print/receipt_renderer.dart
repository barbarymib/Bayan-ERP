import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import 'receipt.dart';

/// صورة نقطية جاهزة للطباعة الحرارية (بيانات RGBA خام).
class ReceiptRaster {
  final int width;
  final int height;
  final Uint8List rgba;

  const ReceiptRaster({
    required this.width,
    required this.height,
    required this.rgba,
  });
}

/// يرسم [ReceiptDoc] على قماش MVC واحد بأي عرض نقطي (دقة طابعة/PDF).
///
/// كل نصوص العربية تُرسم عبر `TextPainter` (تشكيل عربي صحيح من أندرويد) ثم
/// تُصدَّر صورة PNG (للتصدير) أو RGBA (للطباعة الحرارية). لا توجد خطوات
/// تبعث رموز تحكم عند الطابعة — النص أجزاء من الصورة النقطية.
class ReceiptRenderer {
  static const double logicalWidth = 360;
  static const double margin = 14;
  static const double _contentWidth = logicalWidth - 2 * margin;
  static const Color black = Color(0xFF000000);

  /// يرسم المستند ويعيد صورته PNG.
  static Future<Uint8List> renderPng(ReceiptDoc doc, {required int widthPx}) async {
    final image = await renderImage(doc, widthPx: widthPx);
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    return data!.buffer.asUint8List();
  }

  /// يرسم المستند ويعيد بيانات RGBA الخام (للتحويل إلى أحادية البت).
  static Future<ReceiptRaster> renderRgba(ReceiptDoc doc, {required int widthPx}) async {
    final image = await renderImage(doc, widthPx: widthPx);
    final data = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
    return ReceiptRaster(
      width: image.width,
      height: image.height,
      rgba: data!.buffer.asUint8List(),
    );
  }

  static Future<ui.Image> renderImage(ReceiptDoc doc, {required int widthPx}) async {
    final scale = widthPx / logicalWidth;
    final ops = _buildOps(doc);
    var logicalHeight = 10.0;
    for (final op in ops) {
      logicalHeight += op.height;
    }
    logicalHeight += 12;
    final heightPx = (logicalHeight * scale).ceil();

    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    canvas.scale(scale);
    canvas.drawRect(
      Rect.fromLTWH(0, 0, logicalWidth, logicalHeight),
      Paint()..color = const Color(0xFFFFFFFF),
    );

    var y = 10.0;
    for (final op in ops) {
      op.paint(canvas, y);
      y += op.height;
    }
    final picture = recorder.endRecording();
    return picture.toImage(widthPx, heightPx);
  }

  static List<_Op> _buildOps(ReceiptDoc doc) {
    final ops = <_Op>[];
    TextPainter tp(String s, double size, [FontWeight w = FontWeight.normal]) {
      return TextPainter(
        text: TextSpan(
          text: s,
          style: TextStyle(color: black, fontSize: size, fontWeight: w),
        ),
        textDirection: TextDirection.rtl,
        maxLines: 1,
        ellipsis: '…',
      )..layout(maxWidth: _contentWidth);
    }

    void center(String? s, double size, [FontWeight w = FontWeight.normal]) {
      if (s == null || s.isEmpty) return;
      ops.add(_TextOp(tp(s, size, w), _Align.center));
    }

    void rule() => ops.add(_RuleOp());

    void pair(String right, String? left,
        {double size = 13, FontWeight weight = FontWeight.normal}) {
      ops.add(_PairOp(
        right: tp(right, size, weight),
        left: left == null || left.isEmpty ? null : tp(left, size, weight),
      ));
    }

    center(doc.title, 24, FontWeight.bold);
    center('رقم: ${doc.docNumber ?? '—'}', 13);
    center(doc.dateLabel, 11, FontWeight.w400);
    if (doc.repName != null && doc.repName!.isNotEmpty) {
      center('المندوب: ${doc.repName}', 11, FontWeight.w400);
    }
    rule();
    if (doc.customerName != null && doc.customerName!.isNotEmpty) {
      center(doc.customerName!, 15, FontWeight.bold);
      final codePhone = [
        if (doc.customerCode != null && doc.customerCode!.isNotEmpty) doc.customerCode!,
        if (doc.customerPhone != null && doc.customerPhone!.isNotEmpty) doc.customerPhone!,
      ].join(' · ');
      if (codePhone.isNotEmpty) center(codePhone, 11, FontWeight.w400);
    }
    ops.add(_SpacerOp(4));

    if (doc.lines.isNotEmpty) {
      pair('الصنف', 'القيمة', size: 12, weight: FontWeight.bold);
      rule();
      for (final l in doc.lines) {
        pair(l.name, fmtMoney(l.net));
        final details = [
          '${fmtQty(l.qty)} × ${fmtMoney(l.unitPrice)}',
          if (l.condition != null && l.condition!.isNotEmpty) l.condition!,
        ].join(' · ');
        pair(details, null, size: 11, weight: FontWeight.w400);
        ops.add(_SpacerOp(1));
      }
      ops.add(_SpacerOp(2));
    }

    for (final row in doc.summary) {
      pair(row.label, row.value,
          size: row.emphasis ? 15 : 13, weight: row.emphasis ? FontWeight.bold : FontWeight.normal);
    }

    if (doc.balanceBefore != null && doc.balanceAfter != null) {
      ops.add(_SpacerOp(2));
      pair('رصيد سابق', fmtMoney(doc.balanceBefore!));
      pair('الرصيد بعد', fmtMoney(doc.balanceAfter!), weight: FontWeight.bold);
    }

    if (doc.notes != null && doc.notes!.isNotEmpty) {
      ops.add(_SpacerOp(2));
      center(doc.notes!, 11, FontWeight.w400);
    }

    ops.add(_SpacerOp(6));
    center(doc.footer, 13, FontWeight.bold);

    return ops;
  }
}

enum _Align { left, center, right }

abstract class _Op {
  double get height;
  void paint(Canvas canvas, double y);
}

class _SpacerOp implements _Op {
  final double h;
  _SpacerOp(this.h);
  @override
  double get height => h;
  @override
  void paint(Canvas canvas, double y) {}
}

class _RuleOp implements _Op {
  @override
  double get height => 6;
  @override
  void paint(Canvas canvas, double y) {
    canvas.drawLine(
      Offset(ReceiptRenderer.margin, y + 3),
      Offset(ReceiptRenderer.logicalWidth - ReceiptRenderer.margin, y + 3),
      Paint()
        ..color = ReceiptRenderer.black
        ..strokeWidth = 0.5,
    );
  }
}

class _TextOp implements _Op {
  final TextPainter tp;
  final _Align align;
  _TextOp(this.tp, this.align);

  @override
  double get height => tp.height;

  @override
  void paint(Canvas canvas, double y) {
    final x = switch (align) {
      _Align.left => ReceiptRenderer.margin,
      _Align.center => (ReceiptRenderer.logicalWidth - tp.width) / 2,
      _Align.right => ReceiptRenderer.logicalWidth - ReceiptRenderer.margin - tp.width,
    };
    tp.paint(canvas, Offset(x, y));
  }
}

class _PairOp implements _Op {
  final TextPainter right;
  final TextPainter? left;
  _PairOp({required this.right, this.left});

  @override
  double get height =>
      math.max(right.height, left?.height ?? 0) + 1;

  @override
  void paint(Canvas canvas, double y) {
    final l = left;
    if (l != null) {
      l.paint(canvas, Offset(ReceiptRenderer.margin, y));
    }
    right.paint(
      canvas,
      Offset(ReceiptRenderer.logicalWidth - ReceiptRenderer.margin - right.width, y),
    );
  }
}