import 'dart:ffi';
import 'dart:io';

import 'package:bayan_rep/core/db/database.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqlite3/open.dart';

void _enableSqliteOnWindows() {
  if (Platform.isWindows) {
    open.overrideFor(OperatingSystem.windows, () => DynamicLibrary.open('winsqlite3.dll'));
  }
}

const _expectedIndexes = <String>[
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

Future<List<String>> _secondaryIndexes(AppDatabase db) async {
  final rows = await db
      .customSelect("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name")
      .get();
  return rows.map((r) => r.read<String>('name')).toList();
}

Future<int> _userVersion(AppDatabase db) async {
  final rows = await db.customSelect('PRAGMA user_version').get();
  return rows.first.read<int>('user_version');
}

void main() {
  _enableSqliteOnWindows();

  group('R3-E7 Drift secondary indexes', () {
    test('التنصيب الجديد ينشئ كل الفهارس الثانوية (schema v4)', () async {
      final db = AppDatabase.forTesting(NativeDatabase.memory());
      addTearDown(db.close);

      expect(await _userVersion(db), 4);
      expect(await _secondaryIndexes(db), _expectedIndexes);
    });
  });
}
