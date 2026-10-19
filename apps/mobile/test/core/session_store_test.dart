import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:bayan_rep/core/models.dart';
import 'package:bayan_rep/core/session_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('يرحّل الرموز القديمة من التفضيلات إلى التخزين الآمن عند init', () async {
    SharedPreferences.setMockInitialValues({
      'auth_token': 'legacy-tok',
      'auth_refresh': 'legacy-ref',
      'auth_user': '{"id":1,"name":"م","roleCode":"SALES_REP","permissions":[]}',
    });
    FlutterSecureStorage.setMockInitialValues({});

    final prefs = await SharedPreferences.getInstance();
    final session = SessionStore(prefs);
    expect(session.token, isNull);
    expect(session.isLoggedIn, isFalse);

    await session.init();

    expect(session.token, 'legacy-tok');
    expect(session.refreshToken, 'legacy-ref');
    expect(session.isLoggedIn, isTrue);
    expect(prefs.getString('auth_token'), isNull);
    expect(prefs.getString('auth_refresh'), isNull);

    const secure = FlutterSecureStorage();
    expect(await secure.read(key: 'bayan.session.token.v1'), 'legacy-tok');
    expect(await secure.read(key: 'bayan.session.refresh.v1'), 'legacy-ref');
  });

  test('saveAuth/saveTokens يحفظان في التخزين الآمن وclear يمسحهما', () async {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});

    final session = SessionStore(await SharedPreferences.getInstance());

    await session.saveAuth(
      'tok1',
      const AuthUser(
        id: 1,
        name: 'مندوب',
        roleCode: 'SALES_REP',
        permissions: ['cash.handover'],
      ),
      refreshToken: 'r1',
    );
    expect(session.token, 'tok1');
    expect(session.refreshToken, 'r1');

    const secure = FlutterSecureStorage();
    expect(await secure.read(key: 'bayan.session.token.v1'), 'tok1');
    expect(await secure.read(key: 'bayan.session.refresh.v1'), 'r1');

    await session.saveTokens('tok2', 'r2');
    expect(session.token, 'tok2');
    expect(session.refreshToken, 'r2');
    expect(await secure.read(key: 'bayan.session.token.v1'), 'tok2');
    expect(await secure.read(key: 'bayan.session.refresh.v1'), 'r2');

    await session.clear();
    expect(session.token, isNull);
    expect(session.isLoggedIn, isFalse);
    expect(await secure.read(key: 'bayan.session.token.v1'), isNull);
    expect(await secure.read(key: 'bayan.session.refresh.v1'), isNull);
  });

  test('فاصل تتبع الموقع: افتراضي 60 ثانية ويُقيَّد بين 30 و120 (§5.13)', () async {
    SharedPreferences.setMockInitialValues({});
    final session = SessionStore(await SharedPreferences.getInstance());
    expect(session.trackingIntervalSec, 60);

    await session.saveTrackingIntervalSec(90);
    expect(session.trackingIntervalSec, 90);

    await session.saveTrackingIntervalSec(5);
    expect(session.trackingIntervalSec, 30);

    await session.saveTrackingIntervalSec(500);
    expect(session.trackingIntervalSec, 120);
  });

  test('قراءة خام لفاصل التتبع من التفضيلات تُقيَّد أيضاً بين 30 و120', () async {
    SharedPreferences.setMockInitialValues({'tracking_interval_sec': 999});
    final session = SessionStore(await SharedPreferences.getInstance());
    expect(session.trackingIntervalSec, 120);

    SharedPreferences.setMockInitialValues({'tracking_interval_sec': 1});
    final session2 = SessionStore(await SharedPreferences.getInstance());
    expect(session2.trackingIntervalSec, 30);
  });
}