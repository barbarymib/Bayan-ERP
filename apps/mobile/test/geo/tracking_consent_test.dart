import 'package:bayan_rep/core/geo/tracking_consent.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('GeoConsent', () {
    test('يقبل النسخة الحالية ويشير أن الإقرار ساري', () {
      final c = GeoConsent(
        version: geoConsentVersion,
        signatureName: 'أحمد محمد',
        acceptedAt: DateTime.utc(2026, 10, 16, 9, 30),
      );

      expect(c.isCurrent, isTrue);
      expect(c.encode(), contains('"version":"$geoConsentVersion"'));
    });

    test('يرفض نسخة قديمة من النص (يُطلب إقرار جديد)', () {
      final c = GeoConsent(
        version: '0.9',
        signatureName: 'أحمد محمد',
        acceptedAt: DateTime.utc(2026, 1, 1),
      );

      expect(c.isCurrent, isFalse);
    });

    test('يستعيد الإقرار من JSON بما فيه معرّف الجهاز', () {
      final raw = GeoConsent(
        version: geoConsentVersion,
        signatureName: 'سارة علي',
        acceptedAt: DateTime.utc(2026, 10, 16, 9, 30),
        deviceId: 'dev-42',
      ).encode();

      final decoded = GeoConsent.decode(raw);

      expect(decoded, isNotNull);
      expect(decoded!.signatureName, 'سارة علي');
      expect(decoded.deviceId, 'dev-42');
      expect(decoded.acceptedAt, DateTime.utc(2026, 10, 16, 9, 30));
      expect(decoded.isCurrent, isTrue);
    });

    test('يعيد null للنص الفارغ أو غير الصالح', () {
      expect(GeoConsent.decode(null), isNull);
      expect(GeoConsent.decode(''), isNull);
      expect(GeoConsent.decode('not-json'), isNull);
    });
  });
}
