import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'geo/tracking_consent.dart';
import 'models.dart';

/// تخزين جلسة المندوب محلياً.
///
/// - رموز الدخول (access/refresh) في [FlutterSecureStorage] (Keystore/Keychain)
///   داخل التخزين الآمن (§9) مع نسخة مؤقتة في الذاكرة للقراءة السريعة.
/// - بقية بيانات الجلسة (هوية المستخدم، معرّف الجهاز، صندوق الصادر، مؤشر
///   المزامنة) في SharedPreferences.
class SessionStore {
  static const _kSecureToken = 'bayan.session.token.v1';
  static const _kSecureRefresh = 'bayan.session.refresh.v1';

  // مفاتيح SharedPreferences القديمة — مصدر الترحيل للتثبيتات السابقة.
  static const _kLegacyToken = 'auth_token';
  static const _kLegacyRefresh = 'auth_refresh';

  static const _kUser = 'auth_user';
  static const _kDeviceId = 'device_id';
  static const _kOutbox = 'outbox';
  static const _kLastSync = 'last_sync_at';
  static const _kPrinter = 'last_printer_address';
  static const _kDeviceLock = 'device_lock_enabled';
  static const _kGeoConsent = 'geo_consent';
  static const _kTrackingInterval = 'tracking_interval_sec';

  final SharedPreferences _prefs;
  final FlutterSecureStorage _secure;

  String? _cachedToken;
  String? _cachedRefresh;

  SessionStore(this._prefs, [FlutterSecureStorage? secure])
      : _secure = secure ?? const FlutterSecureStorage();

  String? get token => _cachedToken;
  String? get refreshToken => _cachedRefresh;
  bool get isLoggedIn => (token ?? '').isNotEmpty;

  AuthUser? get user {
    final raw = _prefs.getString(_kUser);
    if (raw == null || raw.isEmpty) return null;
    return AuthUser.fromJson((jsonDecode(raw) as Map).cast<String, dynamic>());
  }

  String? get deviceId => _prefs.getString(_kDeviceId);
  String? get outboxJson => _prefs.getString(_kOutbox);
  String? get printerAddress => _prefs.getString(_kPrinter);

  /// هل قفل الجهاز (مصادقة بيومترية/بيانات الجهاز) مُفعّل؟ (§9/G4)
  bool get deviceLockEnabled => _prefs.getBool(_kDeviceLock) ?? false;
  Future<void> saveDeviceLockEnabled(bool enabled) => _prefs.setBool(_kDeviceLock, enabled);

  /// فاصل إرسال نقاط الموقع أثناء الوردية بالثواني (§5.13: قابل للضبط
  /// بين 30 و120 ثانية، والقيمة الافتراضية 60).
  int get trackingIntervalSec {
    final raw = _prefs.getInt(_kTrackingInterval) ?? 60;
    if (raw < 30) return 30;
    if (raw > 120) return 120;
    return raw;
  }

  Future<void> saveTrackingIntervalSec(int seconds) {
    var value = seconds;
    if (value < 30) value = 30;
    if (value > 120) value = 120;
    return _prefs.setInt(_kTrackingInterval, value);
  }

  /// الإقرار الموقّع على تتبع الموقع المحفوظ محلياً (§5.13)، أو null إن لم يوجد.
  GeoConsent? get geoConsent => GeoConsent.decode(_prefs.getString(_kGeoConsent));

  /// هل يوجد إقرار موقّع على النسخة الحالية من نص الإقرار؟
  bool get hasCurrentGeoConsent => geoConsent?.isCurrent ?? false;

  Future<void> saveGeoConsent(GeoConsent consent) => _prefs.setString(_kGeoConsent, consent.encode());

  Future<void> clearGeoConsent() => _prefs.remove(_kGeoConsent);

  DateTime? get lastSyncAt {
    final raw = _prefs.getString(_kLastSync);
    return raw == null ? null : DateTime.tryParse(raw);
  }

  /// يقرأ الرموز من التخزين الآمن عند الإقلاع، ويهاجر أي رموز قديمة كانت
  /// مخزنة بنصّ صريح في SharedPreferences من الإصدارات السابقة.
  ///
  /// يجب استدعاؤه قبل استخدام [token]/[refreshToken] (بمثابة جزء من الإقلاع).
  Future<void> init() async {
    _cachedToken = await _secure.read(key: _kSecureToken);
    _cachedRefresh = await _secure.read(key: _kSecureRefresh);

    final legacyToken = _prefs.getString(_kLegacyToken);
    if (legacyToken != null && legacyToken.isNotEmpty) {
      if (_cachedToken == null || _cachedToken!.isEmpty) {
        await _secure.write(key: _kSecureToken, value: legacyToken);
        _cachedToken = legacyToken;
      }
      final legacyRefresh = _prefs.getString(_kLegacyRefresh);
      if (legacyRefresh != null && legacyRefresh.isNotEmpty &&
          (_cachedRefresh == null || _cachedRefresh!.isEmpty)) {
        await _secure.write(key: _kSecureRefresh, value: legacyRefresh);
        _cachedRefresh = legacyRefresh;
      }
      await _prefs.remove(_kLegacyToken);
      await _prefs.remove(_kLegacyRefresh);
    }
  }

  Future<void> saveAuth(String token, AuthUser user,
      {String? refreshToken}) async {
    await _secure.write(key: _kSecureToken, value: token);
    _cachedToken = token;
    if (refreshToken != null && refreshToken.isNotEmpty) {
      await _secure.write(key: _kSecureRefresh, value: refreshToken);
      _cachedRefresh = refreshToken;
    }
    await _prefs.setString(_kUser, jsonEncode(user.toJson()));
  }

  /// يحدّث زوج الرموز بعد التجديد الصامت.
  Future<void> saveTokens(String accessToken, String refreshToken) async {
    await _secure.write(key: _kSecureToken, value: accessToken);
    await _secure.write(key: _kSecureRefresh, value: refreshToken);
    _cachedToken = accessToken;
    _cachedRefresh = refreshToken;
  }

  Future<void> saveDeviceId(String id) => _prefs.setString(_kDeviceId, id);
  Future<void> saveOutbox(String json) => _prefs.setString(_kOutbox, json);
  Future<void> savePrinterAddress(String? address) async {
    if (address == null || address.isEmpty) {
      await _prefs.remove(_kPrinter);
    } else {
      await _prefs.setString(_kPrinter, address);
    }
  }
  Future<void> saveLastSync(DateTime at) async {
    await _prefs.setString(_kLastSync, at.toIso8601String());
  }

  Future<void> clear() async {
    await _secure.delete(key: _kSecureToken);
    await _secure.delete(key: _kSecureRefresh);
    _cachedToken = null;
    _cachedRefresh = null;
    await _prefs.remove(_kUser);
    await _prefs.remove(_kOutbox);
    await _prefs.remove(_kLastSync);
    await _prefs.remove(_kGeoConsent);
  }
}