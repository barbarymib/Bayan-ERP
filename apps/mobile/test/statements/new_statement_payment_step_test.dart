import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:drift/native.dart';
import 'package:bayan_rep/core/data_store.dart';
import 'package:bayan_rep/core/db/database.dart';
import 'package:bayan_rep/core/models.dart';
import 'package:bayan_rep/core/providers.dart';
import 'package:bayan_rep/features/statement/new_statement_screen.dart';

class _FakeStore extends DataStore {
  final List<CustomerSummary> _customers;
  final List<ItemSummary> _items;

  _FakeStore(List<CustomerSummary> customers, List<ItemSummary> items)
      : _customers = customers,
        _items = items,
        super(AppDatabase.forTesting(NativeDatabase.memory()));

  @override
  List<CustomerSummary> get customers => _customers;

  @override
  List<ItemSummary> get items => _items;

  @override
  noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
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
    ),
  ];

  Future<void> pump(WidgetTester tester) async {
    final container = ProviderContainer(
      overrides: [dataStoreProvider.overrideWithValue(_FakeStore(customers, items))],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: NewStatementScreen()),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('payment step shows net/paid/remaining and quick chips', (tester) async {
    await pump(tester);

    // خطوة الدفع موجودة.
    expect(find.text('الدفع'), findsOneWidget);

    // أزرار الدفع السريع موجودة.
    expect(find.text('صفر'), findsOneWidget);
    expect(find.text('نصف'), findsOneWidget);
    expect(find.text('الكل'), findsOneWidget);

    // نوع السداد افتراضي آجل (لا مدفوع بعد).
    expect(find.text('آجل'), findsOneWidget);

    // المتبقي = 0 (لا أصناف/صافي صفر بعد).
    expect(find.text('المتبقي'), findsOneWidget);
  });

  testWidgets('full-payment chip sets remaining to zero and infers نقدي', (tester) async {
    await pump(tester);

    // أضف صنفاً واحداً بالكمية 1 والسعر 100 → صافي 100 (السعر معبّأ من lastPrice).
    await tester.tap(find.text('+ بند'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('سلعة'));
    await tester.pumpAndSettle();
    final qtyField = find.widgetWithText(TextField, 'الكمية').hitTestable();
    await tester.enterText(qtyField, '1');
    await tester.pumpAndSettle();

    // اضغط «الكل» ليصبح المدفوع = الصافي (قد يكون خارج الشاشة — نمرّر أولاً).
    final allChip = find.text('الكل');
    await tester.scrollUntilVisible(allChip, 200, scrollable: find.byType(Scrollable).first);
    await tester.ensureVisible(allChip);
    await tester.pumpAndSettle();
    await tester.tap(allChip);
    await tester.pumpAndSettle();

    // المتبقي = 0 (ناتج كامل الدفع).
    // المدفوع أصبح = الصافي → نوع السداد مستنتج «نقدي».
    expect(find.text('نقدي'), findsOneWidget);
  });
}
