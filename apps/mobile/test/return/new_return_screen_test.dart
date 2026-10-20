import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:drift/native.dart';
import 'package:bayan_rep/core/connectivity.dart';
import 'package:bayan_rep/core/data_store.dart';
import 'package:bayan_rep/core/db/database.dart';
import 'package:bayan_rep/core/models.dart';
import 'package:bayan_rep/core/numbering_store.dart';
import 'package:bayan_rep/core/outbox.dart';
import 'package:bayan_rep/core/providers.dart';
import 'package:bayan_rep/core/session_store.dart';
import 'package:bayan_rep/features/return/new_return_screen.dart';

class _FakeStore extends DataStore {
  final List<CustomerSummary> _customers;
  final List<ItemSummary> _items;
  final List<StatementSummary> _statements;

  _FakeStore(this._customers, this._items, [this._statements = const []])
      : super(AppDatabase.forTesting(NativeDatabase.memory()));

  @override
  List<CustomerSummary> get customers => _customers;

  @override
  List<ItemSummary> get items => _items;

  @override
  List<StatementSummary> get statements => _statements;

  @override
  noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FakeConnectivity implements ConnectivityStatus {
  @override
  Future<bool> isOnline() async => false;

  @override
  Stream<bool> get onChanged => const Stream.empty();
}

void main() {
  final customers = [
    const CustomerSummary(id: 1, code: 'C001', name: 'أحمد محمد', balance: 0),
  ];
  final items = [
    const ItemSummary(
      id: 1,
      code: 'I001',
      name: 'سلعة',
      baseUnit: 'قطعة',
      lastPrice: 100,
      units: [
        ItemUnitSummary(unitId: 10, unitCode: 'can', factorToBase: 1),
      ],
    ),
  ];
  final statements = [
    StatementSummary(
      id: 5,
      number: 'PS-5',
      customerId: 1,
      date: DateTime(2026, 1, 1),
      status: 'APPROVED',
      net: 300,
      lines: const [
        StatementLineSummary(
          id: 50,
          itemId: 1,
          unitId: 10,
          qty: 3,
          qtyBase: 3,
          unitPrice: 100,
          netLine: 300,
        ),
      ],
    ),
  ];

  late Outbox outbox;

  Future<ProviderContainer> pump(
    WidgetTester tester, {
    List<String> permissions = const ['return.create'],
  }) async {
    outbox = Outbox();
    SharedPreferences.setMockInitialValues({
      'auth_token': 'tok',
      'auth_user': jsonEncode({
        'id': 7,
        'name': 'مندوب',
        'phone': '0100',
        'repCode': 'R1',
        'permissions': permissions,
      }),
    });
    final prefs = await SharedPreferences.getInstance();
    final container = ProviderContainer(
      overrides: [
        sessionProvider.overrideWithValue(SessionStore(prefs)),
        dataStoreProvider.overrideWithValue(
            _FakeStore(customers, items, statements)),
        outboxProvider.overrideWithValue(outbox),
        numberingProvider.overrideWithValue(NumberingStore(prefs)),
        connectivityProvider.overrideWithValue(_FakeConnectivity()),
      ],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: NewReturnScreen()),
      ),
    );
    await tester.pumpAndSettle();
    return container;
  }

  testWidgets('يعرض خيار نوع المرتجع (عميل/مندوب) بدل تثبيت BY_REP', (tester) async {
    await pump(tester);
    expect(find.text('نوع المرتجع'), findsOneWidget);
    expect(find.text('حسب العميل'), findsOneWidget);
  });

  testWidgets('يعرض خيار الأثر المالي (تسوية/دائن) افتراضياً BALANCE', (tester) async {
    await pump(tester);
    expect(find.text('الأثر المالي'), findsOneWidget);
    expect(find.text('خصم من رصيد العميل'), findsOneWidget);

    await tester.tap(find.byKey(const Key('returnSettlement')));
    await tester.pumpAndSettle();
    expect(find.text('رصيد دائن للعميل'), findsWidgets);
  });

  testWidgets('يعرض «رد نقدية» فقط مع صلاحية return.cash_refund', (tester) async {
    await pump(tester);
    await tester.tap(find.byKey(const Key('returnSettlement')));
    await tester.pumpAndSettle();
    expect(find.text('رد نقدية من الخزينة'), findsNothing);
    await tester.tap(find.text('خصم من رصيد العميل').last);
    await tester.pumpAndSettle();

    await pump(tester, permissions: const ['return.create', 'return.cash_refund']);
    await tester.tap(find.byKey(const Key('returnSettlement')));
    await tester.pumpAndSettle();
    expect(find.text('رد نقدية من الخزينة'), findsWidgets);
  });

  testWidgets('يعرض خيار «مرتجع بدون بيان» فقط مع صلاحية return.without_statement', (tester) async {
    await pump(tester);
    expect(find.text('مرتجع بدون بيان'), findsNothing);

    await pump(tester, permissions: const ['return.create', 'return.without_statement']);
    expect(find.text('مرتجع بدون بيان'), findsOneWidget);
  });

  testWidgets('الحفظ يرسل mode/settlement وunitCode لكل بند', (tester) async {
    await pump(tester);

    // اختر العميل ثم البيان.
    await tester.tap(find.byType(DropdownButtonFormField<int>).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('أحمد محمد').last);
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('returnStatement')));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('PS-5').last);
    await tester.pumpAndSettle();

    final qtyField = find.widgetWithText(TextField, 'الكمية').first;
    await tester.ensureVisible(qtyField);
    await tester.pumpAndSettle();
    await tester.enterText(qtyField, '2');
    await tester.pumpAndSettle();

    final saveBtn = find.text('حفظ المرتجع محلياً');
    await tester.ensureVisible(saveBtn);
    await tester.pumpAndSettle();
    await tester.tap(saveBtn);
    await tester.pumpAndSettle();

    final item = outbox.pending.single;
    final payload = item.payload;
    expect(item.type, 'return_statement');
    expect(payload['mode'], 'BY_CUSTOMER');
    expect(payload['settlement'], 'BALANCE');
    final lines = (payload['lines'] as List).cast<Map<String, dynamic>>();
    expect(lines.single['unitCode'], 'can');
    expect(lines.single['sourceLineId'], 50);
  });
}
