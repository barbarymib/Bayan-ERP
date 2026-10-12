import 'dart:convert';

import 'package:bayan_rep/core/api_client.dart';
import 'package:bayan_rep/core/providers.dart';
import 'package:bayan_rep/core/session_store.dart';
import 'package:bayan_rep/features/auth/auth_controller.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

http.Response _json(Object body, [int status = 200]) => http.Response.bytes(
      utf8.encode(jsonEncode(body)),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

Map<String, dynamic> _loginBody() => {
      'accessToken': 'A1',
      'refreshToken': 'R1',
      'user': {
        'id': 1,
        'name': 'مندوب',
        'roleCode': 'SALES_REP',
        'repCode': 'M03',
        'permissions': ['sync.use'],
      },
    };

Future<SessionStore> _session() async {
  SharedPreferences.setMockInitialValues({});
  FlutterSecureStorage.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final session = SessionStore(prefs);
  await session.init();
  return session;
}

ProviderContainer _container(SessionStore session, http.Client client) => ProviderContainer(
      overrides: [
        sessionProvider.overrideWithValue(session),
        apiClientProvider.overrideWithValue(ApiClient(baseUrl: 'http://test', client: client)),
      ],
    );

void main() {
  test('login registers the device then authenticates', () async {
    final session = await _session();
    final client = MockClient((req) async {
      if (req.url.path == '/auth/login') return _json(_loginBody());
      if (req.url.path == '/sync/device/register') {
        final body = jsonDecode(req.body) as Map<String, dynamic>;
        expect(body['deviceId'], isNotEmpty);
        expect(req.headers['X-Device-Id'] ?? req.headers['x-device-id'], body['deviceId']);
        return _json({'id': 1, 'active': true}, 201);
      }
      return _json({'message': 'not found'}, 404);
    });
    final container = _container(session, client);
    addTearDown(container.dispose);

    await container.read(authControllerProvider.notifier).login(phone: '011', password: 'pw');

    final state = container.read(authControllerProvider);
    expect(state.status, AuthStatus.authenticated);
    expect(session.isLoggedIn, isTrue);
    expect(session.deviceId, isNotEmpty);
    expect(container.read(apiClientProvider).deviceId, session.deviceId);
  });

  test('login fails loudly when device registration fails', () async {
    final session = await _session();
    final client = MockClient((req) async {
      if (req.url.path == '/auth/login') return _json(_loginBody());
      if (req.url.path == '/sync/device/register') {
        return _json({'message': 'Device already registered to another user'}, 403);
      }
      return _json({'message': 'not found'}, 404);
    });
    final container = _container(session, client);
    addTearDown(container.dispose);

    await container.read(authControllerProvider.notifier).login(phone: '011', password: 'pw');

    final state = container.read(authControllerProvider);
    expect(state.status, AuthStatus.unauthenticated);
    expect(state.error, contains('فشل تسجيل الجهاز'));
    expect(session.isLoggedIn, isFalse);
    expect(container.read(apiClientProvider).token, isNull);
  });
}
