import 'dart:convert';

import 'package:drift/drift.dart' hide isNull;

import 'db/database.dart';
import 'models.dart';

/// تخزين مرجعي (أصناف/عملاء/قوائم أسعار/بيانات) مبنيّ على SQLite عبر Drift،
/// مع ذاكرة قراءة تخدّم الواجهة تحافظ على واجهة المزامنة التفاضلية.
///
/// المرجعية تُدمج (upsert) بالمعرف: التزامن التفاضلي يرسل التغيّرات فقط ولا
/// يحذف السجلات الغائبة.
class DataStore {
  static const _lastDeltaKey = 'last_delta';

  final AppDatabase _db;
  late List<ItemSummary> _items;
  late List<CustomerSummary> _customers;
  late List<PriceListSummary> _priceLists;
  late List<StatementSummary> _statements;
  final Map<int, double> _stock = {};
  DateTime? _lastDelta;

  DataStore(this._db);

  List<ItemSummary> get items => _items;
  List<CustomerSummary> get customers => _customers;
  List<PriceListSummary> get priceLists => _priceLists;
  List<StatementSummary> get statements => _statements;

  DateTime? get lastDelta => _lastDelta;

  /// يهيّئ الأقراص للقراءة من قاعدة SQLite (يُستدعى عند إقلاع التطبيق).
  Future<void> init() async {
    _items = await _loadItems();
    _customers = await _loadCustomers();
    _priceLists = await _loadPriceLists();
    _statements = await _loadStatements();
    final meta = await (_db.select(_db.meta)..where((t) => t.key.equals(_lastDeltaKey)))
        .getSingleOrNull();
    _lastDelta = meta == null ? null : DateTime.tryParse(meta.value);
    await _loadStock();
  }

  Future<void> _loadStock() async {
    final rows = await _db.select(_db.stockBalances).get();
    _stock
      ..clear()
      ..addEntries(rows.map((r) => MapEntry(r.itemId, r.qty)));
  }

  /// رصيد الصنف بالكمية الأساس عبر كل المخازن (0 إن لم يصلك رصيده بعد).
  double stockQty(int itemId) => _stock[itemId] ?? 0;

  /// أرصدة الأصناف المخزنة (للعرض/الاختبارات).
  Map<int, double> get stock => Map.unmodifiable(_stock);

  Future<List<ItemSummary>> _loadItems() async {
    final rows = await (_db.select(_db.items)..orderBy([(t) => OrderingTerm.asc(t.code)]))
        .get();
    final unitRows = await _db.select(_db.itemUnits).get();
    final byItem = <int, List<ItemUnitSummary>>{};
    for (final u in unitRows) {
      byItem.putIfAbsent(u.itemId, () => []).add(ItemUnitSummary(
            unitId: u.unitId,
            unitCode: u.unitCode,
            factorToBase: u.factorToBase,
            allowDecimal: u.allowDecimal,
            barcode: u.barcode,
            isSale: u.isSale,
            isPurchase: u.isPurchase,
          ));
    }
    return rows
        .map((r) => ItemSummary(
              id: r.id,
              code: r.code,
              name: r.name,
              baseUnit: r.baseUnit,
              lastPrice: r.lastPrice,
              categoryCode: r.categoryCode,
              barcode: r.barcode,
              units: byItem[r.id] ?? const [],
            ))
        .toList();
  }

  Future<List<CustomerSummary>> _loadCustomers() async {
    final rows = await _db.select(_db.customers).get();
    return rows.map(_customerFromRow).toList();
  }

  Future<List<PriceListSummary>> _loadPriceLists() async {
    final lists = await _db.select(_db.priceLists).get();
    final prices = await (_db.select(_db.itemPrices)
          ..orderBy([(t) => OrderingTerm.asc(t.itemId)]))
        .get();
    final byList = <int, List<ItemPrice>>{};
    for (final p in prices) {
      byList.putIfAbsent(p.priceListId, () => []).add(p);
    }
    return lists
        .map((l) => PriceListSummary(
              id: l.id,
              code: l.code,
              name: l.name,
              prices: (byList[l.id] ?? const [])
                  .map((p) => ItemPriceEntry(itemId: p.itemId, unitId: p.unitId, price: p.price))
                  .toList(),
            ))
        .toList();
  }

  Future<List<StatementSummary>> _loadStatements() async {
    final rows = await _db.select(_db.statementRows).get();
    final lines = await (_db.select(_db.statementLineRows)
          ..orderBy([(t) => OrderingTerm.asc(t.id)]))
        .get();
    final byStatement = <int, List<StatementLineRow>>{};
    for (final l in lines) {
      byStatement.putIfAbsent(l.statementId, () => []).add(l);
    }
    return rows
        .map((r) => StatementSummary(
              id: r.id,
              number: r.number,
              customerId: r.customerId,
              date: r.date,
              status: r.status,
              net: r.net,
              lines: (byStatement[r.id] ?? const [])
                  .map((l) => StatementLineSummary(
                        id: l.id,
                        itemId: l.itemId,
                        unitId: l.unitId,
                        qty: l.qty,
                        qtyBase: l.qtyBase,
                        unitPrice: l.unitPrice,
                        netLine: l.netLine,
                      ))
                  .toList(),
            ))
        .toList();
  }

  /// سعر الصنف لعميل محدد انطلاقاً من قائمة أسعاره المخزنة.
  double? priceForCustomer(int customerId, int itemId, {int? unitId}) {
    CustomerSummary? customer;
    for (final c in _customers) {
      if (c.id == customerId) customer = c;
    }
    if (customer?.priceListId == null) return null;
    for (final pl in _priceLists) {
      if (pl.id == customer!.priceListId) return pl.priceFor(itemId, unitId: unitId);
    }
    return null;
  }

  /// يدمج تصنيفات الأصناف في قاعدة SQLite (upsert بالمعرف).
  /// الوحدات الواردة لصنف تُستبدل بالكامل (المزامنة ترسلها كاملة مع الصنف).
  Future<void> saveItems(List<ItemSummary> v) async {
    if (v.isEmpty) return;
    await _db.transaction(() async {
      for (final i in v) {
        await _db.into(_db.items).insertOnConflictUpdate(ItemsCompanion.insert(
              id: Value(i.id),
              code: i.code,
              name: i.name,
              baseUnit: Value(i.baseUnit),
              lastPrice: Value(i.lastPrice),
              categoryCode: Value(i.categoryCode),
              barcode: Value(i.barcode),
            ));
        await _db.batch((batch) {
          batch.deleteWhere(_db.itemUnits, (t) => t.itemId.equals(i.id));
          for (final u in i.units) {
            batch.insert(
              _db.itemUnits,
              ItemUnitsCompanion.insert(
                itemId: i.id,
                unitId: u.unitId,
                unitCode: Value(u.unitCode),
                factorToBase: u.factorToBase,
                allowDecimal: Value(u.allowDecimal),
                barcode: Value(u.barcode),
                isSale: Value(u.isSale),
                isPurchase: Value(u.isPurchase),
              ),
              mode: InsertMode.insertOrReplace,
            );
          }
        });
      }
    });
    _items = await _loadItems();
  }

  /// يدمج العملاء (بما فيه الرصيد وقائمة الأسعار وآخر بيان).
  Future<void> saveCustomers(List<CustomerSummary> v) async {
    if (v.isEmpty) return;
    await _db.transaction(() async {
      for (final c in v) {
        await _db.into(_db.customers).insertOnConflictUpdate(CustomersCompanion.insert(
              id: Value(c.id),
              code: c.code,
              name: c.name,
              phone: Value(c.phone),
              balance: Value(c.balance),
              lat: Value(c.lat),
              lng: Value(c.lng),
              priceListId: Value(c.priceListId),
              lastStatementJson: Value(c.lastStatement == null ? null : jsonEncode(c.lastStatement!.toJson())),
            ));
      }
    });
    _customers = await _loadCustomers();
  }

  /// يدمج قوائم الأسعار ويستبدل أسعار القوائم الواردة فقط.
  Future<void> savePriceLists(List<PriceListSummary> v) async {
    if (v.isEmpty) return;
    await _db.transaction(() async {
      await _db.batch((batch) {
        for (final pl in v) {
          batch.deleteWhere(_db.itemPrices, (t) => t.priceListId.equals(pl.id));
          for (final p in pl.prices) {
            batch.insert(
              _db.itemPrices,
              ItemPricesCompanion.insert(
                priceListId: pl.id,
                itemId: p.itemId,
                unitId: p.unitId,
                price: p.price,
              ),
            );
          }
        }
      });
      for (final pl in v) {
        await _db.into(_db.priceLists).insertOnConflictUpdate(
              PriceListsCompanion.insert(id: Value(pl.id), code: pl.code, name: pl.name),
            );
      }
    });
    _priceLists = await _loadPriceLists();
  }

  /// يدمج البيانات المعتمَدة مع بنودها (إعادة استبدال بنود كل بيان وارد).
  Future<void> saveStatements(List<StatementSummary> v) async {
    if (v.isEmpty) return;
    await _db.transaction(() async {
      for (final s in v) {
        await _db.into(_db.statementRows).insertOnConflictUpdate(StatementRowsCompanion.insert(
              id: Value(s.id),
              number: s.number,
              customerId: s.customerId,
              date: s.date,
              status: s.status,
              net: s.net,
            ));
      }
      await _db.batch((batch) {
        for (final s in v) {
          batch.deleteWhere(_db.statementLineRows, (t) => t.statementId.equals(s.id));
          for (final l in s.lines) {
            batch.insert(
              _db.statementLineRows,
              StatementLineRowsCompanion.insert(
                id: Value(l.id),
                statementId: s.id,
                itemId: l.itemId,
                unitId: l.unitId,
                qty: l.qty,
                qtyBase: l.qtyBase,
                unitPrice: l.unitPrice,
                netLine: l.netLine,
              ),
            );
          }
        }
      });
    });
    _statements = await _loadStatements();
  }

  /// يدمج أرصدة الأصناف الواردة بالمعرف (المزامنة التفاضلية ترسل المتغيّر فقط — R3-F2).
  Future<void> saveStock(List<ItemStock> v) async {
    if (v.isEmpty) return;
    await _db.transaction(() async {
      await _db.batch((batch) {
        for (final s in v) {
          batch.insert(
            _db.stockBalances,
            StockBalancesCompanion.insert(itemId: Value(s.itemId), qty: Value(s.qty)),
            mode: InsertMode.insertOrReplace,
          );
        }
      });
    });
    await _loadStock();
  }

  Future<void> saveLastDelta(DateTime at) async {
    await _db.into(_db.meta).insertOnConflictUpdate(MetaCompanion.insert(
          key: _lastDeltaKey,
          value: at.toIso8601String(),
        ));
    _lastDelta = at;
  }

  Future<void> close() => _db.close();

  /// يقرأ قيمة نصية عامة من جدول Meta (تخزين مؤقت أوفلاين، مثل جلسات الجرد).
  Future<String?> readMeta(String key) async {
    final row = await (_db.select(_db.meta)..where((t) => t.key.equals(key)))
        .getSingleOrNull();
    return row?.value;
  }

  /// يكتب قيمة نصية عامة في جدول Meta (upsert بمفتاح واحد).
  Future<void> writeMeta(String key, String value) async {
    await _db.into(_db.meta).insertOnConflictUpdate(
          MetaCompanion.insert(key: key, value: value),
        );
  }

  static CustomerSummary _customerFromRow(Customer r) => CustomerSummary(
        id: r.id,
        code: r.code,
        name: r.name,
        phone: r.phone,
        balance: r.balance,
        lat: r.lat,
        lng: r.lng,
        priceListId: r.priceListId,
        lastStatement: _decodeLastStatement(r.lastStatementJson),
      );

  static LastStatement? _decodeLastStatement(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      return LastStatement.fromJson((jsonDecode(raw) as Map).cast<String, dynamic>());
    } catch (_) {
      return null;
    }
  }
}