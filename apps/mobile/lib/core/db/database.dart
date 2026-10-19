import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import 'db_security.dart';

part 'database.g.dart';

/// الأصناف المرجعية القادمة من خادم المزامنة.
@TableIndex(name: 'idx_items_code', columns: {#code})
class Items extends Table {
  IntColumn get id => integer()();
  TextColumn get code => text()();
  TextColumn get name => text()();
  TextColumn get baseUnit => text().nullable()();
  RealColumn get lastPrice => real().nullable()();
  TextColumn get categoryCode => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

/// العملاء المرجعيون مع رصيدهم وقائمة الأسعار وآخر بيان.
@TableIndex(name: 'idx_customers_code', columns: {#code})
@TableIndex(name: 'idx_customers_name', columns: {#name})
class Customers extends Table {
  IntColumn get id => integer()();
  TextColumn get code => text()();
  TextColumn get name => text()();
  TextColumn get phone => text().nullable()();
  RealColumn get balance => real().withDefault(const Constant(0))();
  RealColumn get lat => real().nullable()();
  RealColumn get lng => real().nullable()();
  IntColumn get priceListId => integer().nullable()();
  TextColumn get lastStatementJson => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

/// قوائم الأسعار المرجعية.
class PriceLists extends Table {
  IntColumn get id => integer()();
  TextColumn get code => text()();
  TextColumn get name => text()();

  @override
  Set<Column> get primaryKey => {id};
}

/// أسعار الأصناف داخل كل قائمة (سعر الوحدة الأساسية/التحويلية).
@TableIndex(name: 'idx_item_prices_item', columns: {#itemId})
class ItemPrices extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get priceListId => integer()();
  IntColumn get itemId => integer()();
  IntColumn get unitId => integer()();
  RealColumn get price => real()();

  @override
  List<Set<Column>> get uniqueKeys => [
        {priceListId, itemId, unitId},
      ];
}

/// بيانات الأسعار المعتمدة (لإصدار المرتجعات أوفلاين).
@TableIndex(name: 'idx_statement_rows_customer', columns: {#customerId})
@TableIndex(name: 'idx_statement_rows_date', columns: {#date})
class StatementRows extends Table {
  IntColumn get id => integer()();
  TextColumn get number => text()();
  IntColumn get customerId => integer()();
  DateTimeColumn get date => dateTime()();
  TextColumn get status => text()();
  RealColumn get net => real()();

  @override
  Set<Column> get primaryKey => {id};
}

/// بنود بيانات الأسعار.
@TableIndex(name: 'idx_statement_lines_statement', columns: {#statementId})
@TableIndex(name: 'idx_statement_lines_item', columns: {#itemId})
class StatementLineRows extends Table {
  IntColumn get id => integer()();
  IntColumn get statementId =>
      integer().references(StatementRows, #id, onDelete: KeyAction.cascade)();
  IntColumn get itemId => integer()();
  IntColumn get unitId => integer()();
  RealColumn get qty => real()();
  RealColumn get qtyBase => real()();
  RealColumn get unitPrice => real()();
  RealColumn get netLine => real()();

  @override
  Set<Column> get primaryKey => {id};
}

/// زوج مفتاح/قيمة (مؤشر المزامنة التفاضلية).
class Meta extends Table {
  TextColumn get key => text()();
  TextColumn get value => text()();

  @override
  Set<Column> get primaryKey => {key};
}

@DriftDatabase(
  tables: [
    Items,
    Customers,
    PriceLists,
    ItemPrices,
    StatementRows,
    StatementLineRows,
    Meta,
  ],
)
class AppDatabase extends _$AppDatabase {
  /// مفتوحة عبر `NativeDatabase` (مسار تطبيق + مكتبة sqlite المحلية).
  /// على الأجهزة تُشفَّر القاعدة بـ SQLCipher ومفتاح داخل التخزين الآمن (§9).
  AppDatabase([QueryExecutor? executor, FlutterSecureStorage? secure])
      : super(executor ?? _openConnection(secure));

  /// قاعدة بيانات على تنفيذ داخلي (للاختبارات: ذاكرة أو ملف مؤقت).
  AppDatabase.forTesting(super.executor);

  static LazyDatabase _openConnection([FlutterSecureStorage? secure]) {
    return LazyDatabase(() async {
      await configureDbCipher();
      final dir = await getApplicationDocumentsDirectory();
      final file = File(p.join(dir.path, 'bayan_rep.sqlite'));

      if (!dbCipherSupported) {
        return NativeDatabase(file);
      }

      final key = await ensureDbKey(secure ?? const FlutterSecureStorage());
      await migrateLegacyFileIfNeeded(file, key);
      return NativeDatabase(
        file,
        setup: (db) => db.execute(cipherKeyPragma(key)),
      );
    });
  }

  @override
  int get schemaVersion => 3;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onUpgrade: (m, from, to) async {
          if (from < 2) {
            // R3-A6 §5.2: تصنيف الصنف (لتمييز أصناف الحديد) — عمود اختياري.
            await m.addColumn(items, items.categoryCode);
          }
          if (from < 3) {
            // R3-E7 §11: فهارس ثانوية لأعمدة الاستعلام الساخنة (ترتيب/ربط/حذف تتابعي).
            for (final index in [
              idxItemsCode,
              idxCustomersCode,
              idxCustomersName,
              idxItemPricesItem,
              idxStatementRowsCustomer,
              idxStatementRowsDate,
              idxStatementLinesStatement,
              idxStatementLinesItem,
            ]) {
              await m.createIndex(index);
            }
          }
        },
      );
}