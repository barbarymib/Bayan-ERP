import 'package:bayan_rep/core/device_lock.dart';
import 'package:bayan_rep/core/models.dart';
import 'package:bayan_rep/core/providers.dart';
import 'package:bayan_rep/core/session_store.dart';
import 'package:bayan_rep/features/auth/device_lock_gate.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeLock implements DeviceLock {
  _FakeLock({this.available = true, this.result = true});
  bool available;
  bool result;
  int calls = 0;

  @override
  Future<bool> isAvailable() async => available;

  @override
  Future<bool> authenticate({String reason = ''}) async {
    calls++;
    return result;
  }
}

Future<SessionStore> _session({required bool loggedIn, required bool lock}) async {
  SharedPreferences.setMockInitialValues({});
  FlutterSecureStorage.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final session = SessionStore(prefs);
  await session.init();
  await session.saveDeviceLockEnabled(lock);
  if (loggedIn) {
    await session.saveAuth(
      'tok',
      const AuthUser(id: 1, name: 'مندوب', roleCode: 'SALES_REP'),
      refreshToken: 'r',
    );
  }
  return session;
}

Widget _app(SessionStore session, DeviceLock lock) => ProviderScope(
      overrides: [
        sessionProvider.overrideWithValue(session),
        deviceLockProvider.overrideWithValue(lock),
      ],
      child: const MaterialApp(home: DeviceLockGate(child: Text('المحتوى المحمي'))),
    );

void main() {
  group('shouldLockOnStart', () {
    test('يقفل فقط عند وجود جلسة والقفل مُفعّل', () {
      expect(shouldLockOnStart(isLoggedIn: true, lockEnabled: true), isTrue);
      expect(shouldLockOnStart(isLoggedIn: true, lockEnabled: false), isFalse);
      expect(shouldLockOnStart(isLoggedIn: false, lockEnabled: true), isFalse);
      expect(shouldLockOnStart(isLoggedIn: false, lockEnabled: false), isFalse);
    });
  });

  group('DeviceLockGate', () {
    testWidgets('يمرر إلى المحتوى عند تعطيل القفل', (tester) async {
      final session = await _session(loggedIn: true, lock: false);
      final lock = _FakeLock();
      await tester.pumpWidget(_app(session, lock));
      await tester.pumpAndSettle();

      expect(find.text('المحتوى المحمي'), findsOneWidget);
      expect(find.text('التطبيق مقفل'), findsNothing);
      expect(lock.calls, 0);
    });

    testWidgets('يفتح عند نجاح المصادقة', (tester) async {
      final session = await _session(loggedIn: true, lock: true);
      final lock = _FakeLock(result: true);
      await tester.pumpWidget(_app(session, lock));
      await tester.pumpAndSettle();

      expect(find.text('المحتوى المحمي'), findsOneWidget);
      expect(lock.calls, 1);
    });

    testWidgets('يبقى مقفلاً عند فشل المصادقة', (tester) async {
      final session = await _session(loggedIn: true, lock: true);
      final lock = _FakeLock(result: false);
      await tester.pumpWidget(_app(session, lock));
      await tester.pumpAndSettle();

      expect(find.text('التطبيق مقفل'), findsOneWidget);
      expect(find.text('المحتوى المحمي'), findsNothing);
      expect(find.text('تعذّر التحقق — أعد المحاولة'), findsOneWidget);
    });

    testWidgets('لا يحبس المستخدم عند غياب وسيلة تحقق', (tester) async {
      final session = await _session(loggedIn: true, lock: true);
      final lock = _FakeLock(available: false);
      await tester.pumpWidget(_app(session, lock));
      await tester.pumpAndSettle();

      expect(find.text('المحتوى المحمي'), findsOneWidget);
      expect(lock.calls, 0);
    });

    testWidgets('لا يقفل عند عدم وجود جلسة', (tester) async {
      final session = await _session(loggedIn: false, lock: true);
      final lock = _FakeLock();
      await tester.pumpWidget(_app(session, lock));
      await tester.pumpAndSettle();

      expect(find.text('المحتوى المحمي'), findsOneWidget);
      expect(lock.calls, 0);
    });
  });
}
