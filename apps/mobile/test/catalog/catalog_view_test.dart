import 'package:flutter_test/flutter_test.dart';

import 'package:bayan_rep/core/models.dart';
import 'package:bayan_rep/features/catalog/catalog_view.dart';

ItemSummary _item(int id, String code, String name) =>
    ItemSummary(id: id, code: code, name: name);

PriceListSummary _list(int id, String name, Map<int, double> prices) => PriceListSummary(
      id: id,
      code: 'L$id',
      name: name,
      prices: prices.entries
          .map((e) => ItemPriceEntry(itemId: e.key, unitId: 1, price: e.value))
          .toList(),
    );

void main() {
  group('filterItems', () {
    final items = [
      _item(1, 'IT-001', 'حديد تسليح 12'),
      _item(2, 'IT-002', 'أسمنت مقاوم'),
      _item(3, 'BP-010', 'Paint White'),
    ];

    test('فراغ يعيد الكل', () {
      expect(filterItems(items, '   ').length, 3);
    });

    test('يطابق الاسم (عربي)', () {
      final r = filterItems(items, 'أسمنت');
      expect(r.map((i) => i.id), [2]);
    });

    test('يطابق الكود', () {
      expect(filterItems(items, 'BP-010').single.id, 3);
    });

    test('غير حسّاس لحالة الأحرف', () {
      expect(filterItems(items, 'paint').single.id, 3);
    });

    test('بلا نتائج يعيد قائمة فارغة', () {
      expect(filterItems(items, 'zzz'), isEmpty);
    });
  });

  group('pricesForItem', () {
    final lists = [
      _list(1, 'قطاعي', {10: 5.5}),
      _list(2, 'جملة', {10: 4.75, 20: 9}),
      _list(3, 'خاص', {20: 8.5}),
    ];

    test('يجمع السعر من كل قائمة تحتوي الصنف', () {
      final rows = pricesForItem(lists, 10);
      expect(rows.length, 2);
      expect(rows.map((r) => r.priceListName), ['قطاعي', 'جملة']);
      expect(rows.first.price, 5.5);
    });

    test('يتجاهل القوائم التي لا تحتوي الصنف', () {
      expect(pricesForItem(lists, 20).length, 2);
    });

    test('صنف غير مسعّر في أي قائمة', () {
      expect(pricesForItem(lists, 99), isEmpty);
    });
  });

  group('priceInList / priceRange', () {
    final lists = [
      _list(1, 'قطاعي', {10: 5.5}),
      _list(2, 'جملة', {10: 4.75}),
    ];

    test('priceInList من القائمة المختارة', () {
      expect(priceInList(lists[0], 10), 5.5);
      expect(priceInList(lists[1], 10), 4.75);
    });

    test('priceInList بلا قائمة أو صنف غائب يعيد null', () {
      expect(priceInList(null, 10), isNull);
      expect(priceInList(lists[0], 99), isNull);
    });

    test('priceRange يحسب الأدنى والأعلى', () {
      final r = priceRange(lists, 10)!;
      expect(r.min, 4.75);
      expect(r.max, 5.5);
    });

    test('priceRange بلا سعر يعيد null', () {
      expect(priceRange(lists, 99), isNull);
    });
  });

  group('stockLabel (R3-F2 §8.2 #7)', () {
    ItemSummary steel() => ItemSummary(
          id: 1,
          code: 'IR',
          name: 'حديد',
          baseUnit: 'KG',
          units: const [
            ItemUnitSummary(unitId: 3, unitCode: 'BOX', factorToBase: 12),
            ItemUnitSummary(unitId: 9, unitCode: 'KG', factorToBase: 1),
          ],
        );

    test('يفكّك الرصيد المركّب حسب وحدات الصنف', () {
      expect(stockLabel(steel(), 38), '3 BOX + 2 KG');
    });

    test('الرصيد الصفر يُعرض بوحدته الأساسية', () {
      expect(stockLabel(steel(), 0), '0 KG');
    });

    test('الرصيد الكسري يعود بالوحدة الأساسية إن لم يقبل التفكيك', () {
      // 2 لتر < صندوق واحد (4) — يُعرض بالوحدة الأساسية المضافة بعامل 1.
      final paint = ItemSummary(
        id: 2,
        code: 'PNT',
        name: 'دهان',
        baseUnit: 'GLN',
        units: const [ItemUnitSummary(unitId: 4, unitCode: 'BOX', factorToBase: 4, allowDecimal: false)],
      );
      expect(stockLabel(paint, 6), '1 BOX + 2 GLN');
      expect(stockLabel(paint, 0.5), '0.5 GLN');
    });

    test('صنف بلا وحدات مسحوبة يعود بالكمية والوحدة الأساسية', () {
      final plain = ItemSummary(id: 3, code: 'C', name: 'أسمنت', baseUnit: 'BAG');
      expect(stockLabel(plain, 10), '10 BAG');
      expect(stockLabel(plain, 0), '0 BAG');
    });

    test('رصيد سالب (مخزون بالسالب) يُعرض كما هو بلا تفكيك', () {
      expect(stockLabel(steel(), -5), '-5 KG');
    });
  });
}
