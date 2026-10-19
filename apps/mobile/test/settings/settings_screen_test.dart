import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:bayan_rep/core/api_client.dart';
import 'package:bayan_rep/core/connectivity.dart';
import 'package:bayan_rep/core/outbox.dart';
import 'package:bayan_rep/core/providers.dart';
import 'package:bayan_rep/core/session_store.dart';
import 'package:bayan_rep/features/settings/settings_screen.dart';

class _FakeConnectivity implements ConnectivityStatus {
  @override
  Future<bool> isOnline() async => true;

  @override
  Stream<bool> get onChanged => const Stream<bool>.empty();
}

void main() {
  testWidgets('SettingsScreen: account + device + tracking + lock', (tester) async {
    SharedPreferences.setMockInitialValues({
      'auth_user': jsonEncode({
        'id': 7,
        'name': 'مندوب المبيعات',
        'roleCode': 'SALES_REP',
        'repCode': 'M03',
        'permissions': <String>[],
        'maxItemDiscountPct': 5,
        'maxInvoiceDiscountPct': 10,
        'companyId': 1,
        'companyCurrency': 'EGP',
      }),
      'device_id': 'test-device-1',
      'tracking_interval_sec': 90,
      'device_lock_enabled': true,
    });
    final prefs = await SharedPreferences.getInstance();
    final session = SessionStore(prefs);

    final container = ProviderContainer(
      overrides: [
        sessionProvider.overrideWithValue(session),
        apiClientProvider.overrideWithValue(ApiClient(baseUrl: 'http://test.local/api')),
        outboxProvider.overrideWithValue(Outbox()),
        connectivityProvider.overrideWithValue(_FakeConnectivity()),
      ],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: SettingsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('المزامنة والإعدادات'), findsOneWidget);
    expect(find.text('مندوب المبيعات'), findsOneWidget);
    expect(find.text('M03'), findsOneWidget);
    expect(find.text('test-device-1'), findsOneWidget);
    expect(find.text('http://test.local/api'), findsOneWidget);
    expect(find.text('جنيه مصري'), findsOneWidget);

    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
        find.text('فترة إرسال الموقع: 90 ثانية'), 200, scrollable: scrollable);
    await tester.pumpAndSettle();
    expect(find.text('فترة إرسال الموقع: 90 ثانية'), findsOneWidget);

    await tester.scrollUntilVisible(find.text('تسجيل الخروج'), 200, scrollable: scrollable);
    await tester.pumpAndSettle();
    expect(find.text('تسجيل الخروج'), findsOneWidget);

    final lock = tester.widget<SwitchListTile>(find.byType(SwitchListTile));
    expect(lock.value, isTrue);
  });
}
