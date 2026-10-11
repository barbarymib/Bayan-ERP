import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:bayan_rep/core/api_client.dart';
import 'package:bayan_rep/core/geo/location.dart';
import 'package:bayan_rep/core/geo/shift_controller.dart';
import 'package:bayan_rep/core/providers.dart';
import 'package:bayan_rep/core/session_store.dart';

GeoPosition _pos({double lat = 31.235, double lng = 35.1, double? accuracy = 11.0}) =>
    GeoPosition(
      lat: lat,
      lng: lng,
      accuracy: accuracy,
      capturedAt: DateTime.utc(2026, 10, 9, 12, 0, 0),
    );

http.Response _json(Object body, [int status = 200]) => http.Response.bytes(
      utf8.encode(jsonEncode(body)),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

class FakeLocationProvider implements LocationProvider {
  bool serviceEnabled = true;
  bool permissionGranted = true;
  GeoPosition? next;

  FakeLocationProvider([this.next]);

  @override
  Future<bool> isLocationEnabled() async => serviceEnabled;

  @override
  Future<bool> ensurePermission() async {
    if (permissionGranted) return true;
    throw const GeoTrackingException('أذِن لاستخدام الموقع أولاً من إعدادات الجهاز');
  }

  @override
  Future<GeoPosition?> getCurrentPosition() async => next;

  @override
  Future<void> openLocationSettings() async {}

  @override
  Future<void> openAppSettings() async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late ProviderContainer container;
  late FakeLocationProvider fake;
  late List<http.Request> log;
  late Map<String, bool> flags;

  const shiftJson = {
    'id': 5,
    'startedAt': '2026-10-09T12:00:00.000Z',
    '_count': {'locations': 1, 'visits': 0},
  };

  MockClient buildMock() => MockClient((request) async {
        log.add(request);
        final path = request.url.path;
        final method = request.method;

        if (method == 'GET' && path == '/geo/shifts/current') {
          if (flags['activeOnServer'] == true) {
            return _json({
              ...shiftJson,
              '_count': {'locations': 3, 'visits': 0},
            });
          }
          return _json({});
        }
        if (method == 'POST' && path == '/geo/shifts/start') {
          return _json({...shiftJson, '_count': {'locations': 0, 'visits': 0}});
        }
        if (method == 'POST' && path == '/geo/locations') {
          return _json({'id': log.length});
        }
        if (method == 'POST' && path == '/geo/visits') {
          final b = (jsonDecode(request.body) as Map).cast<String, dynamic>();
          return _json({
            'id': 9,
            'customer': {'nameAr': 'عميل اختبار'},
            'status': b['status'],
            'reason': b['reason'],
            'proximity': {'outOfRange': false, 'distanceM': 120},
          });
        }
        if (method == 'POST' && path == '/geo/shifts/end') {
          if (flags['endFails'] == true) {
            return _json({'message': 'وردية غير نشطة'}, 400);
          }
          return _json({
            ...shiftJson,
            'endedAt': '2026-10-09T12:05:00.000Z',
          });
        }
        return _json({'message': 'not found'}, 404);
      });

  Future<void> setUpContainer() async {
    log = [];
    flags = {};
    fake = FakeLocationProvider(_pos());
    SharedPreferences.setMockInitialValues({
      'device_id': 'test-device',
      'auth_token': 'tok',
    });
    final session = SessionStore(await SharedPreferences.getInstance());
    container = ProviderContainer(
      overrides: [
        sessionProvider.overrideWithValue(session),
        apiClientProvider.overrideWithValue(
          ApiClient(baseUrl: 'http://test', client: buildMock()),
        ),
        locationProvider.overrideWithValue(fake),
        trackingIntervalProvider.overrideWithValue(const Duration(milliseconds: 20)),
      ],
    );
    addTearDown(container.dispose);
  }

  Future<void> waitUntil(bool Function() ok, {int timeoutMs = 3000}) async {
    final end = DateTime.now().add(Duration(milliseconds: timeoutMs));
    while (!ok()) {
      if (DateTime.now().isAfter(end)) fail('انقضت المهلة دون بلوغ الحالة المطلوبة');
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }
  }

  Map<String, dynamic> bodyOf(http.Request r) =>
      (jsonDecode(r.body) as Map).cast<String, dynamic>();

  Iterable<http.Request> byPath(String path) =>
      log.where((r) => r.url.path == path);

  group('ShiftController', () {
    test('بدء الوردية يبدأ التتبع ويرسل الموقع الأول فوراً', () async {
      await setUpContainer();
      final controller = container.read(shiftControllerProvider.notifier);

      await controller.startShift();

      expect(container.read(shiftControllerProvider).isTracking, isTrue);
      expect(container.read(shiftControllerProvider).pushedLocations, 1);
      final start = bodyOf(byPath('/geo/shifts/start').single);
      expect(start['deviceId'], 'test-device');
      final push = bodyOf(byPath('/geo/locations').single);
      expect(push['lat'], 31.235);
      expect(push['lng'], 35.1);
      expect(push['accuracy'], 11.0);
    });

    test('يرفض البدء عندما تكون الخدمة أو الصلاحية غير متاحة', () async {
      await setUpContainer();
      fake.serviceEnabled = false;
      final controller = container.read(shiftControllerProvider.notifier);

      await controller.startShift();

      expect(container.read(shiftControllerProvider).isTracking, isFalse);
      expect(container.read(shiftControllerProvider).error, contains('الموقع'));
      expect(byPath('/geo/shifts/start'), isEmpty);

      fake.serviceEnabled = true;
      fake.permissionGranted = false;
      await controller.startShift();
      expect(container.read(shiftControllerProvider).error, contains('أذِن'));
      expect(byPath('/geo/shifts/start'), isEmpty);
    });

    test('يستأنف وردية نشطة على الخادم ويستمر بإرسال النقاط دورياً', () async {
      await setUpContainer();
      flags['activeOnServer'] = true;
      final controller = container.read(shiftControllerProvider.notifier);

      await controller.syncFromServer();

      expect(container.read(shiftControllerProvider).isTracking, isTrue);
      await waitUntil(
        () => container.read(shiftControllerProvider).pushedLocations >= 3,
      );
      expect(byPath('/geo/locations').length, greaterThanOrEqualTo(3));
    });

    test('إنهاء الوردية يرسل الإنهاء ويوقف المؤقّت', () async {
      await setUpContainer();
      final controller = container.read(shiftControllerProvider.notifier);
      await controller.startShift();
      await waitUntil(() => byPath('/geo/locations').isNotEmpty);

      await controller.stopShift();

      expect(container.read(shiftControllerProvider).shift, isNull);
      final endBody = bodyOf(byPath('/geo/shifts/end').single);
      expect(endBody['shiftId'], 5);
      final countAfterStop = byPath('/geo/locations').length;
      await Future<void>.delayed(const Duration(milliseconds: 150));
      expect(byPath('/geo/locations').length, countAfterStop);
    });

    test('فشل الإنهاء يُبقي الوردية ويوقف المؤقّت مع عرض خطأ', () async {
      await setUpContainer();
      flags['endFails'] = true;
      final controller = container.read(shiftControllerProvider.notifier);
      await controller.startShift();
      await waitUntil(() => byPath('/geo/locations').isNotEmpty);

      await controller.stopShift();

      final state = container.read(shiftControllerProvider);
      expect(state.shift, isNotNull);
      expect(state.error, isNotNull);
      final countAfterStop = byPath('/geo/locations').length;
      await Future<void>.delayed(const Duration(milliseconds: 150));
      expect(byPath('/geo/locations').length, countAfterStop);
    });

    test('تسجيل الزيارة يرسل الحالة والمكان ويُظهر نتيجة القرب', () async {
      await setUpContainer();
      final controller = container.read(shiftControllerProvider.notifier);
      await controller.startShift();

      final result = await controller.recordVisit(customerId: 2, missed: false);

      expect(result, isNotNull);
      expect(result!.status, 'DONE');
      expect(result.outOfRange, isFalse);
      expect(result.distanceM, 120);
      final v = bodyOf(byPath('/geo/visits').single);
      expect(v['customerId'], 2);
      expect(v['status'], 'DONE');
      expect(v['lat'], 31.235);
      expect(container.read(shiftControllerProvider).lastVisit?.customerName, 'عميل اختبار');
    });

    test('تسجيل الزيارة خارج وردية نشطة لا يُرسل شيئاً', () async {
      await setUpContainer();
      final controller = container.read(shiftControllerProvider.notifier);

      final result = await controller.recordVisit(customerId: 1, missed: true);

      expect(result, isNull);
      expect(byPath('/geo/visits'), isEmpty);
    });
  });
}