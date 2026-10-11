import 'package:geolocator/geolocator.dart';

/// موقع جغرافي تجريدي — مستقل عن قنوات المنصة ليسهل اختباره.
class GeoPosition {
  final double lat;
  final double lng;
  final double? accuracy;
  final DateTime capturedAt;

  const GeoPosition({
    required this.lat,
    required this.lng,
    this.accuracy,
    required this.capturedAt,
  });
}

/// واجهة توفير الموقع — قابل للاستبدال في الاختبارات (لا تُستدعى المنصة هنا).
abstract class LocationProvider {
  /// هل خدمة الموقع مفعّلة على الجهاز؟
  Future<bool> isLocationEnabled();

  /// يضمن الحصول على إذن الموقع (يسأل المستخدم عند الحاجة) ويرجع true عند التمكن.
  Future<bool> ensurePermission();

  /// آخر موقع معروف (يرجع null عند فشل التثبيت).
  Future<GeoPosition?> getCurrentPosition();

  /// فتح إعدادات نظام الموقع مباشرةً (عندما تكون الخدمة موقوفة).
  Future<void> openLocationSettings();

  /// فتح إعدادات التطبيق في النظام (عندما يُرفض إذن الموقع نهائياً).
  Future<void> openAppSettings();
}

/// التنفيذ الحقيقي عبر حزمة `geolocator` (يعمل على أندرويد/iOS).
class GeolocatorLocationProvider implements LocationProvider {
  @override
  Future<bool> isLocationEnabled() async => Geolocator.isLocationServiceEnabled();

  @override
  Future<bool> ensurePermission() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.whileInUse ||
        permission == LocationPermission.always;
  }

  @override
  Future<void> openLocationSettings() async {
    await Geolocator.openLocationSettings();
  }

  @override
  Future<void> openAppSettings() async {
    await Geolocator.openAppSettings();
  }

  @override
  Future<GeoPosition?> getCurrentPosition() async {
    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 15),
      ),
    );
    return GeoPosition(
      lat: position.latitude,
      lng: position.longitude,
      accuracy: position.accuracy,
      capturedAt: position.timestamp,
    );
  }
}