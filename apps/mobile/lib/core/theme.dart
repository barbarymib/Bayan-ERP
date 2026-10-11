import 'package:flutter/material.dart';

import 'models.dart';

/// لوحة ألوان ثابتة + حالة المزامنة بلغة واضحة للمندوب.
class BayanTheme {
  static const seed = Color(0xFF16653A);
  static const localColor = Color(0xFF78716C);
  static const uploadingColor = Color(0xFF2563EB);
  static const uploadedColor = Color(0xFF16A34A);
  static const pendingReviewColor = Color(0xFFF59E0B);
  static const rejectedColor = Color(0xFFDC2626);

  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(seedColor: seed);
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      visualDensity: VisualDensity.comfortable,
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
        isDense: true,
      ),
    );
  }

  static Color statusColor(SyncStatus s) {
    switch (s) {
      case SyncStatus.local:
        return localColor;
      case SyncStatus.uploading:
        return uploadingColor;
      case SyncStatus.uploaded:
        return uploadedColor;
      case SyncStatus.pendingReview:
        return pendingReviewColor;
      case SyncStatus.approved:
        return uploadedColor;
      case SyncStatus.rejected:
        return rejectedColor;
    }
  }

  static String statusLabel(SyncStatus s) {
    switch (s) {
      case SyncStatus.local:
        return 'محلي';
      case SyncStatus.uploading:
        return 'جارٍ الرفع';
      case SyncStatus.uploaded:
        return 'مرفوع';
      case SyncStatus.pendingReview:
        return 'بانتظار المراجعة';
      case SyncStatus.approved:
        return 'معتمد';
      case SyncStatus.rejected:
        return 'مرفوض';
    }
  }
}