import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:bayan_rep/core/api_client.dart';
import 'package:bayan_rep/core/providers.dart';
import 'package:bayan_rep/core/session_store.dart';
import 'package:bayan_rep/features/geo/consent_screen.dart';

http.Response _json(Object body, [int status = 200]) => http.Response.bytes(
      utf8.encode(jsonEncode(body)),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

void main() {
  testWidgets('يتطلب الاسم الكامل والموافقة قبل التوقيع', (tester) async {
    tester.view.physicalSize = const Size(1200, 2600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    SharedPreferences.setMockInitialValues({'device_id': 'dev-7'});
    final session = SessionStore(await SharedPreferences.getInstance());

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionProvider.overrideWithValue(session),
          apiClientProvider.overrideWithValue(
            ApiClient(baseUrl: 'http://test', client: MockClient((_) async => _json({}, 500))),
          ),
        ],
        child: const MaterialApp(home: GeoConsentScreen()),
      ),
    );

    await tester.tap(find.text('توقيع الإقرار والمتابعة'));
    await tester.pump();

    expect(find.text('اكتب اسمك الكامل للتوقيع على الإقرار'), findsOneWidget);
    expect(session.hasCurrentGeoConsent, isFalse);
  });

  testWidgets('التوقيع يرسل الإقرار للخادم ويحفظه محلياً', (tester) async {
    tester.view.physicalSize = const Size(1200, 2600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    SharedPreferences.setMockInitialValues({'device_id': 'dev-7'});
    final session = SessionStore(await SharedPreferences.getInstance());
    final log = <http.Request>[];
    final client = MockClient((req) async {
      log.add(req);
      if (req.method == 'POST' && req.url.path == '/geo/consent') {
        return _json({
          'type': 'GEO_TRACKING',
          'required': true,
          'version': '1.0',
          'accepted': true,
          'satisfied': true,
          'record': {'acceptedAt': '2026-10-16T09:30:00.000Z'},
        });
      }
      return _json({'message': 'not found'}, 404);
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionProvider.overrideWithValue(session),
          apiClientProvider.overrideWithValue(ApiClient(baseUrl: 'http://test', client: client)),
        ],
        child: const MaterialApp(home: GeoConsentScreen()),
      ),
    );

    await tester.enterText(find.byType(TextField), 'أحمد محمد علي');
    await tester.tap(find.byType(CheckboxListTile));
    await tester.pump();
    await tester.tap(find.text('توقيع الإقرار والمتابعة'));
    await tester.pumpAndSettle();

    expect(session.hasCurrentGeoConsent, isTrue);
    expect(session.geoConsent!.signatureName, 'أحمد محمد علي');
    expect(session.geoConsent!.deviceId, 'dev-7');

    final req = log.singleWhere((r) => r.url.path == '/geo/consent');
    final body = (jsonDecode(req.body) as Map).cast<String, dynamic>();
    expect(body['type'], 'GEO_TRACKING');
    expect(body['version'], '1.0');
    expect(body['signatureName'], 'أحمد محمد علي');
  });
}
