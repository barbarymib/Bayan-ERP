import 'dart:ffi';
import 'dart:io';

import 'package:bayan_rep/core/data_store.dart';
import 'package:bayan_rep/core/db/database.dart';
import 'package:bayan_rep/core/models.dart';
import 'package:drift/drift.dart' show Value, Variable;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:sqlite3/open.dart' as sqlite_open;
import 'package:sqlite3/sqlite3.dart';

const _indexesV4 = <String>[
  'idx_customers_code',
  'idx_customers_name',
  'idx_item_prices_item',
  'idx_item_units_barcode',
  'idx_item_units_item',
  'idx_items_code',
  'idx_statement_lines_item',
  'idx_statement_lines_statement',
  'idx_statement_rows_customer',
  'idx_statement_rows_date',
];

/// مخطط الإصدار 3 (قبل G13): بلا عمود `items.barcode` وبلا جدول `item_units`.
const _ddlV3 = <String>[
  'CREATE TABLE "items" ("id" INTEGER NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, '
      '"base_unit" TEXT NULL, "last_price" REAL NULL, "category_code" TEXT NULL, PRIMARY KEY ("id"))',
  'CREATE TABLE "customers" ("id" INTEGER NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, '
      '"phone" TEXT NULL, "balance" REAL NOT NULL DEFAULT 0.0, "lat" REAL NULL, "lng" REAL NULL, '
      '"price_list_id" INTEGER NULL, "last_statement_json" TEXT NULL, PRIMARY KEY ("id"))',
  'CREATE TABLE "price_lists" ("id" INTEGER NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, '
      'PRIMARY KEY ("id"))',
  'CREATE TABLE "item_prices" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "price_list_id" INTEGER NOT NULL, '
      '"item_id" INTEGER NOT NULL, "unit_id" INTEGER NOT NULL, "price" REAL NOT NULL, '
      'UNIQUE ("price_list_id", "item_id", "unit_id"))',
  'CREATE TABLE "statement_rows" ("id" INTEGER NOT NULL, "number" TEXT NOT NULL, "customer_id" INTEGER NOT NULL, '
      '"date" INTEGER NOT NULL, "status" TEXT NOT NULL, "net" REAL NOT NULL, PRIMARY KEY ("id"))',
  'CREATE TABLE "statement_line_rows" ("id" INTEGER NOT NULL, "statement_id" INTEGER NOT NULL, '
      '"item_id" INTEGER NOT NULL, "unit_id" INTEGER NOT NULL, "qty" REAL NOT NULL, "qty_base" REAL NOT NULL, '
      '"unit_price" REAL NOT NULL, "net_line" REAL NOT NULL, PRIMARY KEY ("id"))',
  'CREATE TABLE "meta" ("key" TEXT NOT NULL, "value" TEXT NOT NULL, PRIMARY KEY ("key"))',
  'CREATE INDEX idx_customers_code ON customers (code)',
  'CREATE INDEX idx_customers_name ON customers (name)',
  'CREATE INDEX idx_item_prices_item ON item_prices (item_id)',
  'CREATE INDEX idx_items_code ON items (code)',
  'CREATE INDEX idx_statement_lines_item ON statement_line_rows (item_id)',
  'CREATE INDEX idx_statement_lines_statement ON statement_line_rows (statement_id)',
  'CREATE INDEX idx_statement_rows_customer ON statement_rows (customer_id)',
  'CREATE INDEX idx_statement_rows_date ON statement_rows (date)',
];

/// يبني قاعدة SQLite بحالتها التاريخية (v3) بـ sqlite3 الخام — قبل أن يفتحها Drift.
File _createLegacyV3(String name) {
  final file = File(p.join(Directory.systemTemp.path, name));
  if (file.existsSync()) file.deleteSync();
  final raw = sqlite3.open(file.path);
  for (final stmt in _ddlV3) {
    raw.execute(stmt);
  }
  raw.execute(
    'INSERT INTO items (id, code, name, base_unit, last_price, category_code) '
    "VALUES (1, 'IR', 'حديد', 'KG', 12.5, 'STEEL')",
  );
  raw.execute(
    'INSERT INTO customers (id, code, name, balance) VALUES (1, \'C1\', \'عميل\', 40)',
  );
  raw.execute('PRAGMA user_version = 3');
  raw.dispose();
  return file;
}

Future<List<String>> _indexes(AppDatabase db) async {
  final rows = await db
      .customSelect("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name")
      .get();
  return rows.map((r) => r.read<String>('name')).toList();
}

Future<int> _userVersion(AppDatabase db) async {
  final rows = await db.customSelect('PRAGMA user_version').get();
  return rows.first.read<int>('user_version');
}

Future<List<String>> _columns(AppDatabase db, String table) async {
  final rows = await db.customSelect('PRAGMA table_info("$table")').get();
  return rows.map((r) => r.read<String>('name')).toList();
}

Future<bool> _hasTable(AppDatabase db, String table) async {
  final rows = await db.customSelect(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    variables: [Variable<String>(table)],
  ).get();
  return rows.isNotEmpty;
}

void main() {
  if (Platform.isWindows) {
    sqlite_open.open.overrideFor(
        sqlite_open.OperatingSystem.windows, () => DynamicLibrary.open('winsqlite3.dll'));
  }

  group('ترقية مخطط Drift 3 ← 5 (G13 + R3-F2)', () {
    test('التنصيب الجديد ينشئ barcode وجدول الوحدات وأرصدة المخزون وكل الفهارس', () async {
      final db = AppDatabase.forTesting(NativeDatabase.memory());
      addTearDown(db.close);

      expect(await _userVersion(db), 5);
      expect(await _indexes(db), _indexesV4);
      expect(await _columns(db, 'items'), contains('barcode'));
      expect(await _hasTable(db, 'item_units'), isTrue);
      expect(await _hasTable(db, 'stock_balances'), isTrue);
    });

    test('ترقية قاعدة إصدار 3 تحفظ البيانات وتضيف الحقول الجديدة', () async {
      final file = _createLegacyV3('bayan_v3_upgrade.sqlite');
      addTearDown(() {
        if (file.existsSync()) file.deleteSync();
      });

      final db = AppDatabase.forTesting(NativeDatabase(file));
      addTearDown(db.close);

      expect(await _userVersion(db), 5);
      expect(await _indexes(db), _indexesV4);
      expect(await _columns(db, 'items'), contains('barcode'));
      expect(await _hasTable(db, 'item_units'), isTrue);
      expect(await _hasTable(db, 'stock_balances'), isTrue);

      final store = DataStore(db);
      await store.init();
      final item = store.items.single;
      expect(item.id, 1);
      expect(item.code, 'IR');
      expect(item.categoryCode, 'STEEL');
      expect(item.barcode, isNull);
      expect(item.units, isEmpty);
      expect(store.customers.single.name, 'عميل');
    });

    test('قاعدة إصدار 4 (قبل R3-F2) ترقى لإنشاء جدول الأرصدة دون فقدان البيانات', () async {
      final file = File(p.join(Directory.systemTemp.path, 'bayan_v4_stock_upgrade.sqlite'));
      addTearDown(() {
        if (file.existsSync()) file.deleteSync();
      });
      // بناء حالة v4 الخام مباشرة: مخطط 3 + barcode + جدول الوحدات + الفهارس.
      if (file.existsSync()) file.deleteSync();
      final raw = sqlite3.open(file.path);
      for (final stmt in _ddlV3) {
        raw.execute(stmt);
      }
      raw.execute('ALTER TABLE items ADD COLUMN barcode TEXT');
      raw.execute(
        'CREATE TABLE item_units ("item_id" INTEGER NOT NULL, "unit_id" INTEGER NOT NULL, '
        '"unit_code" TEXT NULL, "factor_to_base" REAL NOT NULL, "allow_decimal" INTEGER NOT NULL DEFAULT 1, '
        '"barcode" TEXT NULL, "is_sale" INTEGER NOT NULL DEFAULT 1, "is_purchase" INTEGER NOT NULL DEFAULT 1, '
        'PRIMARY KEY ("item_id", "unit_id"))',
      );
      raw.execute('CREATE INDEX idx_item_units_item ON item_units (item_id)');
      raw.execute('CREATE INDEX idx_item_units_barcode ON item_units (barcode)');
      raw.execute(
        'INSERT INTO items (id, code, name, base_unit, last_price, category_code, barcode) '
        "VALUES (1, 'IR', 'حديد', 'KG', 12.5, 'STEEL', '6221000000017')",
      );
      raw.execute('PRAGMA user_version = 4');
      raw.dispose();

      final db = AppDatabase.forTesting(NativeDatabase(file));
      addTearDown(db.close);

      expect(await _userVersion(db), 5);
      expect(await _hasTable(db, 'stock_balances'), isTrue);
      expect(await _hasTable(db, 'item_units'), isTrue);

      final store = DataStore(db);
      await store.init();
      expect(store.items.single.code, 'IR');
      expect(store.items.single.barcode, '6221000000017');
      expect(store.stockQty(1), 0);
      await store.saveStock(const [ItemStock(itemId: 1, qty: 4.5)]);
      expect(store.stockQty(1), 4.5);
    });

    test('الوحدات تُضاف على قاعدة مُرقّاة وتُقرأ عبر DataStore', () async {
      final file = _createLegacyV3('bayan_v3_units.sqlite');
      addTearDown(() {
        if (file.existsSync()) file.deleteSync();
      });

      final db = AppDatabase.forTesting(NativeDatabase(file));
      addTearDown(db.close);
      await db.into(db.itemUnits).insert(ItemUnitsCompanion.insert(
            itemId: 1,
            unitId: 3,
            unitCode: const Value('BOX'),
            factorToBase: 12,
            barcode: const Value('BOX-1'),
          ));

      final store = DataStore(db);
      await store.init();
      final item = store.items.single;
      expect(item.units.single.unitCode, 'BOX');
      expect(item.units.single.factorToBase, 12);
      expect(item.units.single.barcode, 'BOX-1');
      expect(await _indexes(db), _indexesV4);
    });
  });
}
