import 'package:bayan_rep/core/models.dart';
import 'package:bayan_rep/core/scan_resolver.dart';
import 'package:flutter_test/flutter_test.dart';

ItemSummary _item(
  int id,
  String code, {
  String? barcode,
  String? baseUnit = 'KG',
  List<ItemUnitSummary> units = const [],
}) =>
    ItemSummary(
      id: id,
      code: code,
      name: 'صنف $code',
      baseUnit: baseUnit,
      barcode: barcode,
      units: units,
    );

void main() {
  final items = [
    _item(1, 'IR', barcode: '6221000000017', units: const [
      ItemUnitSummary(unitId: 3, unitCode: 'TON', factorToBase: 1000, barcode: 'BOX-1'),
      ItemUnitSummary(unitId: 9, unitCode: 'KG', factorToBase: 1, isPurchase: false),
    ]),
    _item(2, 'PNT', baseUnit: 'GAL'),
  ];

  group('resolveScan (G13 §9)', () {
    test('يطابق باركود الوحدة أولاً ويُعيد الوحدة المطابقة', () {
      final hit = resolveScan('BOX-1', items);
      expect(hit?.item.id, 1);
      expect(hit?.unit?.unitId, 3);
      expect(hit?.kind, ScanMatchKind.unitBarcode);
    });

    test('يطابق باركود الصنف عند عدم مطابقة أي وحدة', () {
      final hit = resolveScan('6221000000017', items);
      expect(hit?.item.id, 1);
      expect(hit?.unit, isNull);
      expect(hit?.kind, ScanMatchKind.itemBarcode);
    });

    test('يطابق كود الصنف بلا حساسية لحالة الأحرف ومع المسافات', () {
      expect(resolveScan('  pnt ', items)?.kind, ScanMatchKind.itemCode);
      expect(resolveScan('  pnt ', items)?.item.id, 2);
    });

    test('الكود يسبق الباركود الفارغ ولا يُطابق نصاً فارغاً', () {
      final withEmptyBarcode = [_item(3, 'X', barcode: '  ')];
      expect(resolveScan('X', withEmptyBarcode)?.kind, ScanMatchKind.itemCode);
      expect(resolveScan('', items), isNull);
      expect(resolveScan('   ', items), isNull);
      expect(resolveScan('UNKNOWN', items), isNull);
    });
  });

  group('saleUnits (§5.2/G14)', () {
    test('يرتب تصاعدياً بعامل التحويل مع الوحدة الأساسية المُدرجة', () {
      final units = saleUnits(items[0]);
      expect(units.map((u) => u.unitCode).toList(), ['KG', 'TON']);
      expect(units.first.unitId, 9, reason: 'وحدة الأساسية موجودة فعلياً');
      expect(units.last.factorToBase, 1000);
    });

    test('يضيف وحدة أساسية مُصنَّعة (عامل 1) عند عدم إدرجتها', () {
      final item = _item(6, 'Z', baseUnit: 'KG', units: const [
        ItemUnitSummary(unitId: 3, unitCode: 'TON', factorToBase: 1000),
      ]);
      final units = saleUnits(item);
      expect(units.length, 2);
      expect(units.first.unitCode, 'KG');
      expect(units.first.unitId, 0, reason: 'وحدة أساسية مُصنَّعة');
      expect(units.first.factorToBase, 1);
    });

    test('لا يكرر الوحدة الأساسية إن كانت مُدرجة كوحدة', () {
      final item = _item(4, 'KG', units: const [
        ItemUnitSummary(unitId: 9, unitCode: 'KG', factorToBase: 1),
      ]);
      final units = saleUnits(item);
      expect(units.length, 1);
      expect(units.single.unitId, 9);
    });

    test('يستثني وحدات البيع الممنوعة وعوامل التحويل غير الموجبة', () {
      final item = _item(5, 'Z', units: const [
        ItemUnitSummary(unitId: 1, unitCode: 'A', factorToBase: 5, isSale: false),
        ItemUnitSummary(unitId: 2, unitCode: 'B', factorToBase: 0),
        ItemUnitSummary(unitId: 3, unitCode: 'C', factorToBase: 2),
      ]);
      final units = saleUnits(item);
      expect(units.map((u) => u.unitCode).toList(), ['KG', 'C'],
          reason: 'الأساس يبقى قابلاً للبيع دائماً — A/B مستثناة');
      expect(units.where((u) => u.unitId == 1 || u.unitId == 2), isEmpty);
    });
  });
}
