import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:drift/native.dart';
import 'package:bayan_rep/core/data_store.dart';
import 'package:bayan_rep/core/db/database.dart';
import 'package:bayan_rep/core/models.dart';
import 'package:bayan_rep/core/geo/shift_controller.dart' as shift;
import 'package:bayan_rep/core/providers.dart';
import 'package:bayan_rep/features/customers/customers_screen.dart';

class _FakeStore extends DataStore {
  final List<CustomerSummary> _customers;

  _FakeStore(this._customers) : super(AppDatabase.forTesting(NativeDatabase.memory()));

  @override
  List<CustomerSummary> get customers => _customers;

  @override
  noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FakeShiftNotifier extends shift.ShiftController {
  @override
  shift.ShiftState get state => const shift.ShiftState();

  @override
  noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  testWidgets('CustomersScreen: search + filter + distance', (WidgetTester tester) async {
    final customers = [
      CustomerSummary(
        id: 1,
        code: 'C001',
        name: 'أحمد محمد',
        phone: '0111111111',
        balance: 100.0,
        lat: 31.2001,
        lng: 29.9187,
        priceListId: 1,
      ),
      CustomerSummary(
        id: 2,
        code: 'C002',
        name: 'محمود علي',
        phone: '0222222222',
        balance: -50.0,
        lat: null,
        lng: null,
        priceListId: 1,
      ),
      CustomerSummary(
        id: 3,
        code: 'C003',
        name: 'سارة حسن',
        phone: '0333333333',
        balance: 0.0,
        lat: 31.2050,
        lng: 29.9200,
        priceListId: 1,
      ),
    ];

    final container = ProviderContainer(
      overrides: [
        dataStoreProvider.overrideWithValue(_FakeStore(customers)),
        shift.shiftControllerProvider.overrideWith(() => _FakeShiftNotifier()),
      ],
    );

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(
          home: CustomersScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('أحمد محمد'), findsOneWidget);
    expect(find.text('محمود علي'), findsOneWidget);
    expect(find.text('سارة حسن'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'محمود');
    await tester.pumpAndSettle();
    expect(find.text('محمود علي'), findsOneWidget);
    expect(find.text('أحمد محمد'), findsNothing);

    await tester.enterText(find.byType(TextField), '');
    await tester.pumpAndSettle();

    await tester.tap(find.text('لديهم إحداثيات فقط'));
    await tester.pumpAndSettle();
    expect(find.text('محمود علي'), findsNothing);
    expect(find.text('أحمد محمد'), findsOneWidget);
    expect(find.text('سارة حسن'), findsOneWidget);
  });
}
