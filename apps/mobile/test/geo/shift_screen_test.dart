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
import 'package:bayan_rep/features/geo/shift_screen.dart';

http.Response _json(Object body, [int status = 200]) => http.Response.bytes(
      utf8.encode(jsonEncode(body)),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  /// تضخّم الشاشة حتى يظهر محتوى البطاقة كاملة للسحب.
  void widen(WidgetTester tester) {
    tester.view.physicalSize = const Size(1200, 2600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  testWidgets('منفذ ضبط فاصل تحديث الموقع 30–120 ثانية (R3-D3، §5.13)',
      (tester) async {
    widen(tester);
    SharedPreferences.setMockInitialValues({'device_id': 'dev-7'});
    final session = SessionStore(await SharedPreferences.getInstance());

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionProvider.overrideWithValue(session),
          apiClientProvider.overrideWithValue(
            ApiClient(
              baseUrl: 'http://test',
              client: MockClient((_) async => _json({})),
            ),
          ),
        ],
        child: const MaterialApp(home: ShiftScreen()),
      ),
    );
    await tester.pump();

    // القيمة الافتراضيّة 60 ثانية معروضة على المنزلق.
    expect(session.trackingIntervalSec, 60);
    final slider = tester.widget<Slider>(find.byType(Slider));
    expect(slider.min, 30);
    expect(slider.max, 120);
    expect(slider.divisions, 9);
    expect(slider.value, 60);
    expect(find.textContaining('60 ثانية'), findsWidgets);

    // سحب المنزلق يغيّر الفاصل ويُحفظ فوراً في إعدادات الجهاز.
    await tester.drag(find.byType(Slider), const Offset(500, 0));
    await tester.pump();
    await tester.pump();

    expect(session.trackingIntervalSec, isNot(60));
    expect(session.trackingIntervalSec, inInclusiveRange(30, 120));
    final updated = tester.widget<Slider>(find.byType(Slider));
    expect(updated.value, session.trackingIntervalSec.toDouble());
  });
}
