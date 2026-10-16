import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// المؤشر المرئي للتتبع (§5.13): أثناء الوردية يجب أن يظهر للمندوب أن التطبيق
/// يتبعه — على أندرويد عبر خدمة مقدمة (Foreground Service) وإشعار دائم لا يمكن
/// إخفاؤه، ويتوقف تلقائياً عند إنهاء الوردية.
abstract class TrackingNotifier {
  /// يبدأ (أو يستأنف) التتبع المرئي مع نص الإشعار المعروض.
  Future<void> start({required String title, required String body});

  /// يُحدّث نص الإشعار (مثلاً عدد النقاط المُرسلة) دون إيقاف الخدمة.
  Future<void> update({required String title, required String body});

  /// يوقف المؤشر المرئي والخدمة المقدمة.
  Future<void> stop();
}

/// نسخة لا تفعل شيئاً — تُستخدم في الاختبارات وعلى المنصّات غير المدعومة.
class NoopTrackingNotifier implements TrackingNotifier {
  const NoopTrackingNotifier();

  @override
  Future<void> start({required String title, required String body}) async {}

  @override
  Future<void> update({required String title, required String body}) async {}

  @override
  Future<void> stop() async {}
}

/// تنفيذ المؤشر المرئي على أندرويد عبر `flutter_local_notifications`.
///
/// لا يُسقط أي خطأ العملية الأساسية (بدء/إنهاء الوردية): المؤشر «أفضل جهد».
class AndroidTrackingNotifier implements TrackingNotifier {
  static const _channelId = 'bayan_tracking';
  static const _channelName = 'تتبع الموقع أثناء الوردية';
  static const _notificationId = 8013;

  final FlutterLocalNotificationsPlugin _plugin;

  bool _ready = false;

  AndroidTrackingNotifier([FlutterLocalNotificationsPlugin? plugin])
      : _plugin = plugin ?? FlutterLocalNotificationsPlugin();

  bool get _supported => !kIsWeb && Platform.isAndroid;

  AndroidFlutterLocalNotificationsPlugin? get _android =>
      _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

  Future<void> _init() async {
    if (_ready) return;
    const settings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    );
    await _plugin.initialize(settings);
    await _android?.requestNotificationsPermission();
    _ready = true;
  }

  AndroidNotificationDetails get _details => const AndroidNotificationDetails(
        _channelId,
        _channelName,
        channelDescription: 'يُظهر أن التطبيق يتبع موقعك أثناء وردية العمل',
        importance: Importance.low,
        priority: Priority.low,
        ongoing: true,
        autoCancel: false,
        showWhen: false,
        onlyAlertOnce: true,
        category: AndroidNotificationCategory.service,
      );

  Future<void> _show({required String title, required String body}) async {
    await _init();
    await _android?.startForegroundService(
      _notificationId,
      title,
      body,
      notificationDetails: _details,
      foregroundServiceTypes: const {
        AndroidServiceForegroundType.foregroundServiceTypeLocation,
      },
    );
  }

  @override
  Future<void> start({required String title, required String body}) async {
    if (!_supported) return;
    try {
      await _show(title: title, body: body);
    } catch (_) {
      // المؤشر المرئي لا يُسقط بدء الوردية.
    }
  }

  @override
  Future<void> update({required String title, required String body}) async {
    if (!_supported) return;
    try {
      await _show(title: title, body: body);
    } catch (_) {}
  }

  @override
  Future<void> stop() async {
    if (!_supported) return;
    try {
      await _android?.stopForegroundService();
    } catch (_) {}
  }
}
