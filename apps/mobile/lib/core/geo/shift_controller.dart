import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api_client.dart';
import '../geo/location.dart';
import '../models.dart';
import '../providers.dart';
import '../session_store.dart';

class ShiftState {
  /// الوردية النشطة الحالية (null قبل البدء/بعد الإنهاء).
  final ActiveShift? shift;

  /// عملية بدء/إنهاء قيد التنفيذ.
  final bool busy;

  final GeoPosition? lastPosition;
  final int pushedLocations;
  final DateTime? lastPushAt;
  final VisitResult? lastVisit;
  final String? error;

  const ShiftState({
    this.shift,
    this.busy = false,
    this.lastPosition,
    this.pushedLocations = 0,
    this.lastPushAt,
    this.lastVisit,
    this.error,
  });

  bool get isTracking => shift != null;

  ShiftState copy({
    ActiveShift? shift,
    bool? busy,
    GeoPosition? lastPosition,
    int? pushedLocations,
    DateTime? lastPushAt,
    VisitResult? lastVisit,
    String? error,
  }) =>
      ShiftState(
        shift: shift ?? this.shift,
        busy: busy ?? this.busy,
        lastPosition: lastPosition ?? this.lastPosition,
        pushedLocations: pushedLocations ?? this.pushedLocations,
        lastPushAt: lastPushAt ?? this.lastPushAt,
        lastVisit: lastVisit ?? this.lastVisit,
        error: error ?? this.error,
      );
}

/// يدير وردية تتبع الموقع: بدء/إنهاء، إرسال نقاط دورية، وتسجيل الزيارات.
/// «الخلفية» هنا تعني استمرار المؤقّت ما دام تطبيق المندوب حيّاً (تتبع قريب
/// من حقيقي عبر geolocator؛ الردم على خدمة أندرويد الفعلية موثّق في README/memory).
class ShiftController extends Notifier<ShiftState> {
  Timer? _timer;
  bool _pushing = false;

  @override
  ShiftState build() {
    ref.onDispose(() => _timer?.cancel());
    return const ShiftState();
  }

  ApiClient get _api => ref.read(apiClientProvider);
  LocationProvider get _location => ref.read(locationProvider);
  SessionStore get _session => ref.read(sessionProvider);
  Duration get _interval => ref.read(trackingIntervalProvider);

  /// عند فتح التطبيق: إن تُركت وردية نشطة على الخادم نستأنف التتبع.
  Future<void> syncFromServer() async {
    if (state.shift != null) return;
    try {
      final active = await _api.currentShift();
      if (active != null) {
        state = ShiftState(shift: active);
        _startTimer();
      }
    } catch (_) {
      // فشل الشبكة لا يمنع فتح التطبيق — سيُحاول مجدداً عند فتح الشاشة.
    }
  }

  Future<void> startShift() async {
    if (state.shift != null || state.busy) return;
    state = state.copy(busy: true, error: null);
    try {
      if (!await _location.isLocationEnabled()) {
        throw const GeoTrackingException('خدمة الموقع غير مفعّلة — فعّلها ثم أعد المحاولة');
      }
      if (!await _location.ensurePermission()) {
        throw const GeoTrackingException('أذِن لاستخدام الموقع أولاً من إعدادات الجهاز');
      }
      final pos = await _location.getCurrentPosition();
      final shift = await _api.startShift(
        lat: pos?.lat,
        lng: pos?.lng,
        deviceId: _session.deviceId,
      );
      state = ShiftState(shift: shift, lastPosition: pos);
      _startTimer();
      if (pos != null) await _push(pos);
    } catch (e) {
      state = state.copy(busy: false, error: _message(e, 'فشل بدء الوردية'));
    }
  }

  Future<void> stopShift() async {
    final active = state.shift;
    _timer?.cancel();
    _timer = null;
    if (active == null || state.busy) return;
    state = state.copy(busy: true, error: null);
    GeoPosition? pos;
    try {
      pos = await _location.getCurrentPosition();
    } catch (_) {}
    if (pos != null) {
      try {
        await _push(pos);
      } catch (_) {}
    }
    try {
      await _api.endShift(shiftId: active.id, lat: pos?.lat, lng: pos?.lng);
      state = const ShiftState();
    } catch (e) {
      state = state.copy(busy: false, error: _message(e, 'فشل إنهاء الوردية'));
    }
  }

  /// يسجّل زيارة عميل بموقع الوجهة الحالية (الخادم يفحص القرب 150م).
  Future<VisitResult?> recordVisit({
    required int customerId,
    required bool missed,
    String? reason,
  }) async {
    if (state.shift == null) return null;
    state = state.copy(error: null);
    GeoPosition? pos;
    try {
      pos = await _location.getCurrentPosition();
    } catch (_) {}
    try {
      final result = await _api.recordVisit(
        customerId: customerId,
        status: missed ? 'MISSED' : 'DONE',
        reason: missed && (reason == null || reason.trim().isEmpty) ? null : reason?.trim(),
        lat: pos?.lat,
        lng: pos?.lng,
      );
      state = state.copy(lastVisit: result, error: null);
      return result;
    } catch (e) {
      state = state.copy(error: _message(e, 'فشل تسجيل الزيارة'));
      return null;
    }
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(_interval, (_) => _tick());
  }

  Future<void> _tick() async {
    if (state.shift == null || _pushing) return;
    final pos = await _location.getCurrentPosition();
    if (!ref.mounted) return;
    if (pos != null) await _push(pos);
  }

  Future<void> _push(GeoPosition pos) async {
    if (_pushing) return;
    _pushing = true;
    try {
      await _api.pushLocation(
        lat: pos.lat,
        lng: pos.lng,
        accuracy: pos.accuracy,
        capturedAt: pos.capturedAt,
      );
      if (!ref.mounted) return;
      state = state.copy(
        lastPosition: pos,
        pushedLocations: state.pushedLocations + 1,
        lastPushAt: pos.capturedAt,
        error: null,
      );
    } catch (e) {
      // لا نقطع التتبع لفشل نقطة واحدة — نعرض الخطأ ونعيد المحاولة في الدورة القادمة.
      if (ref.mounted) {
        state = state.copy(lastPosition: pos, error: _message(e, 'تعذّر إرسال الموقع'));
      }
    } finally {
      _pushing = false;
    }
  }

  String _message(Object e, String fallback) {
    if (e is GeoTrackingException) return e.message;
    if (e is ApiException) return e.message;
    return fallback;
  }
}

class GeoTrackingException implements Exception {
  final String message;
  const GeoTrackingException(this.message);
  @override
  String toString() => message;
}

final shiftControllerProvider =
    NotifierProvider<ShiftController, ShiftState>(ShiftController.new);