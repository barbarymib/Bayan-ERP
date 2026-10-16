import 'dart:convert';

/// نسخة نص الإقرار الحالية على تتبع الموقع.
///
/// يجب أن تُطابق `CONSENT_VERSION` في الخادم (`geo.service.ts`). عند تغيير
/// النص في العقد/سياسة الشركة تُرفع النسخة فيُطلب إقرار جديد (§5.13).
const geoConsentVersion = '1.0';

/// إقرار موقّع على تتبع الموقع محفوظ محلياً على الجهاز.
class GeoConsent {
  final String version;
  final String signatureName;
  final DateTime acceptedAt;
  final String? deviceId;

  const GeoConsent({
    required this.version,
    required this.signatureName,
    required this.acceptedAt,
    this.deviceId,
  });

  /// هل الإقرار موقّع على النسخة الحالية من النص؟
  bool get isCurrent => version == geoConsentVersion;

  Map<String, dynamic> toJson() => {
        'version': version,
        'signatureName': signatureName,
        'acceptedAt': acceptedAt.toUtc().toIso8601String(),
        if (deviceId != null) 'deviceId': deviceId,
      };

  factory GeoConsent.fromJson(Map<String, dynamic> json) => GeoConsent(
        version: (json['version'] ?? '').toString(),
        signatureName: (json['signatureName'] ?? '').toString(),
        acceptedAt:
            DateTime.tryParse((json['acceptedAt'] ?? '').toString())?.toUtc() ??
                DateTime.now().toUtc(),
        deviceId: json['deviceId']?.toString(),
      );

  static GeoConsent? decode(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      return GeoConsent.fromJson((jsonDecode(raw) as Map).cast<String, dynamic>());
    } catch (_) {
      return null;
    }
  }

  String encode() => jsonEncode(toJson());
}
