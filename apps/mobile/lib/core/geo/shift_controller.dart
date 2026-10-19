import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api_client.dart';
import '../geo/location.dart';
import '../geo/tracking_notification.dart';
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

  /// هل يُخفَّف التردد حالياً لأن المندوب ساكن (توفير البطارية، §5.13)؟
  final bool throttled;

  const ShiftState({
    this.shift,
    this.busy = false,
    this.lastPosition,
    this.pushedLocations = 0,
    this.lastPushAt,
    this.lastVisit,
    this.error,
    this.throttled = false,
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
    bool? throttled,
  }) =>
      ShiftState(
        shift: shift ?? this.shift,
        busy: busy ?? this.busy,
        lastPosition: lastPosition ?? this.lastPosition,
        pushedLocations: pushedLocations ?? this.pushedLocations,
        lastPushAt: lastPushAt ?? this.lastPushAt,
        lastVisit: lastVisit ?? this.lastVisit,
        error: error ?? this.error,
        throttled: throttled ?? this.throttled,
      );
}

/// عتبة السكون (بالمتر): إذا كانت المسافة بين موقعين متتاليين أقل منها فالمندوب
/// ساكن ويُخفَّف تردد الإرسال لتوفير البطارية (§5.13).
const kStationaryThresholdMeters = 15.0;

/// معامل تخفيف التردد عند السكون، وسقفه الأقصى (§5.13).
const kIdleThrottleFactor = 2;
const kMaxIdleInterval = Duration(minutes: 5);

/// يحسب المدة التالية بين إرسال موقع — دالة نقية قابلة للاختبار:
/// الفاصل الأساسي عند الحركة، ومضاعفته (بحدٍّ أقصى [kMaxIdleInterval])
/// عند السكون لتوفير البطارية (§5.13).
Duration nextTrackingDelay(Duration base, {required bool stationary}) {
  if (!stationary) return base;
  final ms = base.inMilliseconds * kIdleThrottleFactor;
  final capped = ms > kMaxIdleInterval.inMilliseconds
      ? kMaxIdleInterval.inMilliseconds
      : ms;
  return Duration(milliseconds: capped);
}

/// يدير وردية تتبع الموقع: بدء/إنهاء، إرسال نقاط دورية، وتسجيل الزيارات.
/// يفرض إقراراً موقّعاً على التتبع (§5.13) قبل البدء، ويُظهر مؤشراً مرئياً دائماً
/// أثناء الوردية عبر خدمة مقدمة/إشعار دائم ([TrackingNotifier]).
class ShiftController extends Notifier<ShiftState> {
  static const _notifTitle = 'تتبع الموقع مُفعّل';

  Timer? _timer;
  bool _pushing = false;

  /// هل يُسمح بإعادة الجدولة؟ يُلغى عند الإنهاء حتى لا يستأنف مؤقّت منتهٍ.
  bool _tracking = false;

  @override
  ShiftState build() {
    ref.onDispose(() {
      _tracking = false;
      _timer?.cancel();
    });
    return const ShiftState();
  }

  ApiClient get _api => ref.read(apiClientProvider);
  LocationProvider get _location => ref.read(locationProvider);
  SessionStore get _session => ref.read(sessionProvider);
  Duration get _interval => ref.read(trackingIntervalProvider);
  TrackingNotifier get _notifier => ref.read(trackingNotifierProvider);

  String _notifBody(int points) => 'الوردية نشطة — أُرسلت $points نقطة موقع';

  /// يضبط فاصل إرسال الموقع أثناء الوردية (§5.13: 30–120 ثانية)، يحفظه في
  /// إعدادات الجهاز، ويُعيد جدولة المؤقّت فوراً إن كانت الوردية نشطة.
  Future<void> setInterval(Duration interval) async {
    final seconds = interval.inSeconds.clamp(30, 120).toInt();
    await _session.saveTrackingIntervalSec(seconds);
    ref.invalidate(trackingIntervalProvider);
    if (_tracking && state.shift != null) _scheduleNext();
  }

  /// عند فتح التطبيق: إن تُركت وردية نشطة على الخادم نستأنف التتبع.
  Future<void> syncFromServer() async {
    if (state.shift != null) return;
    try {
      final active = await _api.currentShift();
      if (active != null) {
        state = ShiftState(shift: active);
        _startTimer();
        await _notifier.start(title: _notifTitle, body: _notifBody(0));
      }
    } catch (_) {
      // فشل الشبكة لا يمنع فتح التطبيق — سيُحاول مجدداً عند فتح الشاشة.
    }
  }

  Future<void> startShift() async {
    if (state.shift != null || state.busy) return;
    state = state.copy(busy: true, error: null);
    try {
      if (!_session.hasCurrentGeoConsent) {
        throw const GeoTrackingException(
            'يجب الإقرار على تتبع الموقع أثناء الوردية قبل البدء (§5.13)');
      }
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
      await _notifier.start(title: _notifTitle, body: _notifBody(0));
      if (pos != null) await _push(pos);
    } catch (e) {
      state = state.copy(busy: false, error: _message(e, 'فشل بدء الوردية'));
    }
  }

  Future<void> stopShift() async {
    final active = state.shift;
    _tracking = false;
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
      await _notifier.stop();
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

  /// يبدأ جدولة نقاط الإرسال بفاصل متجدّد: الفاصل الأساسي أثناء الحركة،
  /// ومضاعفته (بحدٍّ أقصى) عند السكون (§5.13).
  void _startTimer() {
    _tracking = true;
    _scheduleNext();
  }

  void _scheduleNext() {
    _timer?.cancel();
    if (!_tracking || state.shift == null) return;
    _timer = Timer(
      nextTrackingDelay(_interval, stationary: state.throttled),
      () => _tick(),
    );
  }

  Future<void> _tick() async {
    if (!_tracking || state.shift == null) return;
    if (_pushing) {
      // إرسال سابق قيد التنفيذ — نؤجّل الدورة فقط دون قطع السلسلة.
      _scheduleNext();
      return;
    }
    final pos = await _location.getCurrentPosition();
    if (!ref.mounted || !_tracking || state.shift == null) return;
    if (pos != null) {
      // قرر التخفيف قبل الإرسال لأن `_push` يحدّث آخر موقع مُرسل.
      final stationary = state.lastPosition != null &&
          distanceMeters(state.lastPosition!, pos) < kStationaryThresholdMeters;
      state = state.copy(throttled: stationary);
      await _push(pos);
    }
    if (!ref.mounted) return;
    _scheduleNext();
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
      await _notifier.update(
        title: _notifTitle,
        body: _notifBody(state.pushedLocations),
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