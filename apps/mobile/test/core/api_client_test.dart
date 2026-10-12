import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:bayan_rep/core/api_client.dart';

http.Response _json(Object body, [int status = 200]) => http.Response.bytes(
      utf8.encode(jsonEncode(body)),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

void main() {
  group('ApiClient token refresh', () {
    test('login stores access + refresh tokens', () async {
      final client = MockClient((req) async {
        expect(req.url.path, '/auth/login');
        return _json({
          'accessToken': 'A1',
          'refreshToken': 'R1',
          'user': {
            'id': 1,
            'name': 'مندوب',
            'roleCode': 'SALES_REP',
            'repCode': 'M03',
            'permissions': ['statement.create'],
          },
        });
      });
      final api = ApiClient(baseUrl: 'http://test', client: client);
      final user = await api.login(phone: '011', password: 'pw');
      expect(user.id, 1);
      expect(api.token, 'A1');
      expect(api.refreshToken, 'R1');
    });

    test('on 401 refreshes the token pair and retries once', () async {
      var deltaCalls = 0;
      final client = MockClient((req) async {
        if (req.url.path == '/sync/delta') {
          deltaCalls++;
          if (req.headers['Authorization'] == 'Bearer OLD') {
            return _json({'message': 'expired'}, 401);
          }
          return _json({
            'serverTime': '2026-01-01T00:00:00.000Z',
            'items': [],
            'customers': [],
            'blocks': [],
            'priceLists': [],
            'statements': [],
          });
        }
        if (req.url.path == '/auth/refresh') {
          final body = jsonDecode(req.body) as Map<String, dynamic>;
          expect(body['refreshToken'], 'R1');
          return _json({'accessToken': 'NEW', 'refreshToken': 'R2'});
        }
        return _json({'message': 'not found'}, 404);
      });

      String? savedAccess;
      String? savedRefresh;
      final api = ApiClient(baseUrl: 'http://test', client: client)
        ..token = 'OLD'
        ..refreshToken = 'R1'
        ..onRefreshed = (a, r) async {
          savedAccess = a;
          savedRefresh = r;
        };

      final delta = await api.delta();
      expect(delta.items, isEmpty);
      expect(deltaCalls, 2);
      expect(api.token, 'NEW');
      expect(api.refreshToken, 'R2');
      expect(savedAccess, 'NEW');
      expect(savedRefresh, 'R2');
    });

    test('keeps the 401 when refresh is unavailable', () async {
      final client = MockClient((req) async {
        if (req.url.path == '/auth/refresh') return _json({'message': 'nope'}, 401);
        return _json({'message': 'expired'}, 401);
      });
      final api = ApiClient(baseUrl: 'http://test', client: client)
        ..token = 'OLD'
        ..refreshToken = 'R1';

      await expectLater(api.delta(), throwsA(isA<ApiException>()));
    });

    test('sends X-Device-Id on sync calls only when a device id is set', () async {
      String? seen;
      final client = MockClient((req) async {
        seen = req.headers['X-Device-Id'] ?? req.headers['x-device-id'];
        return _json({
          'serverTime': '2026-01-01T00:00:00.000Z',
          'items': [],
          'customers': [],
          'blocks': [],
          'priceLists': [],
          'statements': [],
        });
      });
      final api = ApiClient(baseUrl: 'http://test', client: client)..token = 'A1';

      await api.delta();
      expect(seen, isNull);

      api.deviceId = 'dev-9';
      await api.delta();
      expect(seen, 'dev-9');
    });
  });
}
