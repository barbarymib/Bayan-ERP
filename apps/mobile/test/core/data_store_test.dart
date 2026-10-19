import 'dart:ffi';
import 'dart:io';

import 'package:bayan_rep/core/data_store.dart';
import 'package:bayan_rep/core/db/database.dart';
import 'package:bayan_rep/core/models.dart';
import 'package:bayan_rep/core/scan_resolver.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:sqlite3/open.dart';

void _enableSqliteOnWindows() {
  if (Platform.isWindows) {
    open.overrideFor(OperatingSystem.windows, () => DynamicLibrary.open('winsqlite3.dll'));
  }
}

Future<DataStore> _memoryStore() async {
  final db = AppDatabase.forTesting(NativeDatabase.memory());
  final store = DataStore(db);
  await store.init();
  return store;
}

ItemSummary _item(int id, String code, {String? lastPrice, String? barcode, List<ItemUnitSummary> units = const []}) =>
    ItemSummary(
      id: id,
      code: code,
      name: 'صنف $code',
      baseUnit: 'ton',
      lastPrice: lastPrice == null ? null : double.parse(lastPrice),
      barcode: barcode,
      units: units,
    );

CustomerSummary _customer(
  int id, {
  int? priceListId,
  LastStatement? last,
}) =>
    CustomerSummary(
      id: id,
      code: 'C$id',
      name: 'عميل $id',
      phone: '011$id',
      balance: 100.5,
      priceListId: priceListId,
      lastStatement: last,
    );

void main() {
  _enableSqliteOnWindows();

  group('DataStore (Drift/SQLite)', () {
    test('الأصناف تُدمج بالمعرف لا تُستبدل', () async {
      final s = await _memoryStore();
      await s.saveItems([_item(1, 'A'), _item(2, 'B')]);
      expect(s.items.length, 2);

      await s.saveItems([_item(1, 'A', lastPrice: '12.5')]);
      expect(s.items.length, 2, reason: 'التزامن التفاضلي يدمج ولا يحذف');
      expect(s.items.firstWhere((i) => i.id == 1).lastPrice, 12.5);
      expect(s.items.firstWhere((i) => i.id == 1).name, 'صنف A');
      await s.close();
    });

    test('العملاء يحتفظون برصيدهم وقائمة الأسعار وآخر بيانهم', () async {
      final s = await _memoryStore();
      final last = LastStatement(
        id: 7,
        number: 'BP-000001',
        date: DateTime(2026, 10, 7),
        net: 423770.5,
        status: 'APPROVED',
      );
      await s.saveCustomers([_customer(1, priceListId: 3, last: last)]);
      expect(s.customers.length, 1);
      expect(s.customers.first.balance, 100.5);
      expect(s.customers.first.priceListId, 3);
      expect(s.customers.first.lastStatement?.number, 'BP-000001');
      expect(s.customers.first.lastStatement?.net, 423770.5);

      // تحديث يمسح آخر بيان تعييناً صراحةً.
      await s.saveCustomers([_customer(1, priceListId: 3, last: null)]);
      expect(s.customers.first.lastStatement, isNull);
      await s.close();
    });

    test('priceForCustomer يقرأ من قائمة الأسعار المخزنة', () async {
      final s = await _memoryStore();
      await s.saveCustomers([_customer(1, priceListId: 3)]);
      await s.savePriceLists([
        PriceListSummary(
          id: 3,
          code: 'RETAIL',
          name: 'تجزئة',
          prices: const [
            ItemPriceEntry(itemId: 42, unitId: 1, price: 250),
            ItemPriceEntry(itemId: 42, unitId: 2, price: 240),
          ],
        ),
      ]);
      expect(s.priceForCustomer(1, 42), 250);
      expect(s.priceForCustomer(1, 42, unitId: 2), 240);
      expect(s.priceForCustomer(1, 999), isNull);
      await s.saveCustomers([_customer(2)]); // بلا قائمة
      expect(s.priceForCustomer(2, 42), isNull);
      await s.close();
    });

    test('البيانات مع بنودها حفظ واسترجاع كامل', () async {
      final s = await _memoryStore();
      await s.saveStatements([
        StatementSummary(
          id: 9,
          number: 'BP-000001',
          customerId: 1,
          date: DateTime(2026, 10, 7),
          status: 'APPROVED',
          net: 1000,
          lines: const [
            StatementLineSummary(
              id: 91,
              itemId: 42,
              unitId: 1,
              qty: 5,
              qtyBase: 5000,
              unitPrice: 200,
              netLine: 1000,
            ),
          ],
        ),
      ]);
      expect(s.statements.length, 1);
      final st = s.statements.first;
      expect(st.number, 'BP-000001');
      expect(st.net, 1000);
      expect(st.lines.length, 1);
      expect(st.lines.first.qtyBase, 5000);
      expect(st.lines.first.itemId, 42);
      await s.close();
    });

    test('مؤشر المزامنة التفاضلية يُخزَّن ويُقرأ', () async {
      final s = await _memoryStore();
      expect(s.lastDelta, isNull);
      final at = DateTime.utc(2026, 10, 9, 12, 0, 0);
      await s.saveLastDelta(at);
      expect(s.lastDelta, at);
      await s.close();

      final s2 = await _memoryStore();
      expect(s2.lastDelta, isNull);
      await s2.close();
    });

    test('باركود الصنف ووحداته يُحفظان ويُسترجعان ويُستبدلان بالكامل (G13)', () async {
      final s = await _memoryStore();
      await s.saveItems([
        _item(1, 'IR', barcode: '6221000000017', units: const [
          ItemUnitSummary(
              unitId: 3,
              unitCode: 'TON',
              factorToBase: 1000,
              allowDecimal: false,
              barcode: 'BOX-1',
              isPurchase: false),
          ItemUnitSummary(unitId: 9, unitCode: 'KG', factorToBase: 1),
        ]),
        _item(2, 'PNT', units: const [
          ItemUnitSummary(unitId: 4, unitCode: 'GAL', factorToBase: 3.785),
        ]),
      ]);

      final ir = s.items.firstWhere((i) => i.id == 1);
      expect(ir.barcode, '6221000000017');
      expect(ir.units.length, 2);
      expect(ir.units.first.barcode, 'BOX-1');
      expect(ir.units.first.allowDecimal, isFalse);
      expect(ir.units.first.isPurchase, isFalse);
      expect(ir.units[1].factorToBase, 1);

      final hit = resolveScan('box-1', s.items);
      expect(hit?.item.id, 1);
      expect(hit?.unit?.unitId, 3);
      expect(hit?.kind, ScanMatchKind.unitBarcode);
      expect(resolveScan('6221000000017', s.items)?.item.id, 1);
      expect(resolveScan('pnt', s.items)?.kind, ScanMatchKind.itemCode);
      expect(resolveScan('NOPE', s.items), isNull);

      // إعادة مزامنة الصنف 1 بلا وحدات تستبدل وحداته وتُبقي وحدات الصنف 2.
      await s.saveItems([_item(1, 'IR', barcode: '999')]);
      final ir2 = s.items.firstWhere((i) => i.id == 1);
      expect(ir2.barcode, '999');
      expect(ir2.units, isEmpty);
      expect(s.items.firstWhere((i) => i.id == 2).units.single.unitCode, 'GAL');
      await s.close();
    });

    test('أرصدة الأصناف تُدمج بالمعرف وتُقرأ عبر stockQty (R3-F2)', () async {
      final s = await _memoryStore();
      expect(s.stockQty(1), 0, reason: 'بلا رصيد مخزّن = صفر');
      expect(s.stock, isEmpty);

      await s.saveStock(const [
        ItemStock(itemId: 1, qty: 12.5),
        ItemStock(itemId: 2, qty: 0),
      ]);
      expect(s.stockQty(1), 12.5);
      expect(s.stockQty(2), 0);
      expect(s.stockQty(999), 0);

      // دمج تفاضلي: تحديث صنف 1 لا يمسّ صنف 2.
      await s.saveStock(const [ItemStock(itemId: 1, qty: 3)]);
      expect(s.stockQty(1), 3);
      expect(s.stockQty(2), 0);
      await s.close();
    });

    test('الأرصدة تبقى عبر إعادة فتح قاعدة الملف (R3-F2)', () async {
      final dir = await Directory.systemTemp.createTemp('bayan_stock_test');
      final file = File(p.join(dir.path, 'bayan_test.sqlite'));
      try {
        final db1 = AppDatabase.forTesting(NativeDatabase(file));
        final s1 = DataStore(db1);
        await s1.init();
        await s1.saveStock(const [ItemStock(itemId: 7, qty: 4.5)]);
        await s1.close();

        final db2 = AppDatabase.forTesting(NativeDatabase(file));
        final s2 = DataStore(db2);
        await s2.init();
        expect(s2.stockQty(7), 4.5);
        await s2.close();
      } finally {
        if (dir.existsSync()) dir.deleteSync(recursive: true);
      }
    });

    test('الصبر عبر قاعدة ملف حقيقي (SQLite دائم)', () async {
      final dir = await Directory.systemTemp.createTemp('bayan_ds_test');
      final file = File(p.join(dir.path, 'bayan_test.sqlite'));
      try {
        final db1 = AppDatabase.forTesting(NativeDatabase(file));
        final s1 = DataStore(db1);
        await s1.init();
        await s1.saveItems([_item(1, 'DURABLE', lastPrice: '9')]);
        await s1.saveLastDelta(DateTime.utc(2026, 10, 9));
        await s1.close();

        final db2 = AppDatabase.forTesting(NativeDatabase(file));
        final s2 = DataStore(db2);
        await s2.init();
        expect(s2.items.length, 1);
        expect(s2.items.first.code, 'DURABLE');
        expect(s2.lastDelta, DateTime.utc(2026, 10, 9));
        await s2.close();
      } finally {
        if (dir.existsSync()) dir.deleteSync(recursive: true);
      }
    });
  });
}