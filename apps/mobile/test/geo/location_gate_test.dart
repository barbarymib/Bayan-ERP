import 'package:bayan_rep/core/geo/location.dart';
import 'package:bayan_rep/core/geo/location_gate.dart';
import 'package:bayan_rep/core/providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeLoc implements LocationProvider {
  bool serviceEnabled;
  bool permissionGranted;
  int locationSettingsOpened = 0;
  int appSettingsOpened = 0;

  _FakeLoc({this.serviceEnabled = true, this.permissionGranted = true});

  @override
  Future<bool> isLocationEnabled() async => serviceEnabled;

  @override
  Future<bool> ensurePermission() async => permissionGranted;

  @override
  Future<GeoPosition?> getCurrentPosition() async => null;

  @override
  Future<void> openLocationSettings() async => locationSettingsOpened++;

  @override
  Future<void> openAppSettings() async => appSettingsOpened++;
}

Widget _app(LocationProvider loc) => ProviderScope(
      overrides: [locationProvider.overrideWithValue(loc)],
      child: const MaterialApp(
        home: LocationGate(child: Text('المحتوى المحمي')),
      ),
    );

void main() {
  testWidgets('يمرر إلى المحتوى عند توفّر الإذن والخدمة', (tester) async {
    await tester.pumpWidget(_app(_FakeLoc()));
    await tester.pumpAndSettle();

    expect(find.text('المحتوى المحمي'), findsOneWidget);
    expect(find.text('الوصول للموقع مطلوب'), findsNothing);
  });

  testWidgets('يحجب التطبيق عند رفض الإذن ثم يمرر بعد منحه', (tester) async {
    final loc = _FakeLoc(permissionGranted: false);
    await tester.pumpWidget(_app(loc));
    await tester.pumpAndSettle();

    expect(find.text('المحتوى المحمي'), findsNothing);
    expect(find.text('الوصول للموقع مطلوب'), findsOneWidget);
    expect(find.text('فتح إعدادات التطبيق'), findsOneWidget);

    await tester.tap(find.text('فتح إعدادات التطبيق'));
    await tester.pump();
    expect(loc.appSettingsOpened, 1);

    loc.permissionGranted = true;
    await tester.tap(find.text('إعادة المحاولة'));
    await tester.pumpAndSettle();
    expect(find.text('المحتوى المحمي'), findsOneWidget);
  });

  testWidgets('يحجب عند إيقاف خدمة الموقع ويعرض زر تفعيلها', (tester) async {
    final loc = _FakeLoc(serviceEnabled: false);
    await tester.pumpWidget(_app(loc));
    await tester.pumpAndSettle();

    expect(find.text('المحتوى المحمي'), findsNothing);
    expect(find.text('تفعيل الموقع'), findsOneWidget);

    await tester.tap(find.text('تفعيل الموقع'));
    await tester.pump();
    expect(loc.locationSettingsOpened, 1);

    loc.serviceEnabled = true;
    await tester.tap(find.text('إعادة المحاولة'));
    await tester.pumpAndSettle();
    expect(find.text('المحتوى المحمي'), findsOneWidget);
  });
}