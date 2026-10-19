import 'dart:ffi';
import 'dart:io';

import 'package:bayan_rep/core/db/database.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
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
    test('التنصيب الجديد ينشئ كل الفهارس الثانوية (schema v3)', () async {
      final db = AppDatabase.forTesting(NativeDatabase.memory());
      addTearDown(db.close);

      expect(await _userVersion(db), 3);
      expect(await _secondaryIndexes(db), _expectedIndexes);
    });

    test('الترقية 2 ← 3 تعيد إنشاء الفهارس الثانوية', () async {
      final file = File(p.join(Directory.systemTemp.path, 'bayan_idx_${DateTime.now().microsecondsSinceEpoch}.sqlite'));
      addTearDown(() {
        if (file.existsSync()) file.deleteSync();
      });

      final first = AppDatabase.forTesting(NativeDatabase(file));
      expect(await _userVersion(first), 3);
      expect(await _secondaryIndexes(first), _expectedIndexes);

      for (final name in _expectedIndexes) {
        await first.customStatement('DROP INDEX $name');
      }
      await first.customStatement('PRAGMA user_version = 2');
      await first.close();

      final upgraded = AppDatabase.forTesting(NativeDatabase(file));
      addTearDown(upgraded.close);

      expect(await _userVersion(upgraded), 3);
      expect(await _secondaryIndexes(upgraded), _expectedIndexes);
    });
  });
}
