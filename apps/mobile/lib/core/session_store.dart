import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

/// تخزين جلسة المندوب محلياً (توكن، هوية، معرّف الجهاز، صندوق الصادر، مؤشر المزامنة).
class SessionStore {
  static const _kToken = 'auth_token';
  static const _kRefresh = 'auth_refresh';
  static const _kUser = 'auth_user';
  static const _kDeviceId = 'device_id';
  static const _kOutbox = 'outbox';
  static const _kLastSync = 'last_sync_at';
  static const _kPrinter = 'last_printer_address';

  final SharedPreferences _prefs;

  SessionStore(this._prefs);

  String? get token => _prefs.getString(_kToken);
  String? get refreshToken => _prefs.getString(_kRefresh);
  bool get isLoggedIn => (token ?? '').isNotEmpty;

  AuthUser? get user {
    final raw = _prefs.getString(_kUser);
    if (raw == null || raw.isEmpty) return null;
    return AuthUser.fromJson((jsonDecode(raw) as Map).cast<String, dynamic>());
  }

  String? get deviceId => _prefs.getString(_kDeviceId);
  String? get outboxJson => _prefs.getString(_kOutbox);
  String? get printerAddress => _prefs.getString(_kPrinter);
  DateTime? get lastSyncAt {
    final raw = _prefs.getString(_kLastSync);
    return raw == null ? null : DateTime.tryParse(raw);
  }

  Future<void> saveAuth(String token, AuthUser user, {String? refreshToken}) async {
    await _prefs.setString(_kToken, token);
    if (refreshToken != null && refreshToken.isNotEmpty) {
      await _prefs.setString(_kRefresh, refreshToken);
    }
    await _prefs.setString(_kUser, jsonEncode(user.toJson()));
  }

  /// يحدّث زوج الرموز بعد التجديد الصامت.
  Future<void> saveTokens(String accessToken, String refreshToken) async {
    await _prefs.setString(_kToken, accessToken);
    await _prefs.setString(_kRefresh, refreshToken);
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
    await _prefs.remove(_kToken);
    await _prefs.remove(_kRefresh);
    await _prefs.remove(_kUser);
    await _prefs.remove(_kOutbox);
    await _prefs.remove(_kLastSync);
  }
}