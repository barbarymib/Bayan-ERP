import '../../core/models.dart';

/// صفّ سعر صنف في قائمة أسعار معيّنة (لعرض أسعار الصنف عبر القوائم).
class ItemPriceRow {
  final int priceListId;
  final String priceListName;
  final double price;

  const ItemPriceRow({
    required this.priceListId,
    required this.priceListName,
    required this.price,
  });
}

/// يرشّح الأصناف بالاسم أو الكود (بحث غير حسّاس لحالة الأحرف؛ فراغ = الكل).
List<ItemSummary> filterItems(List<ItemSummary> items, String query) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return List<ItemSummary>.of(items);
  return items
      .where((i) => i.name.toLowerCase().contains(q) || i.code.toLowerCase().contains(q))
      .toList();
}

/// سعر صنف في قائمة أسعار محددة (أول وحدة مطابقة)، أو null إن لم يوجد.
double? priceInList(PriceListSummary? list, int itemId) => list?.priceFor(itemId);

/// أسعار صنف عبر كل قوائم الأسعار (التي لها سعر فقط).
List<ItemPriceRow> pricesForItem(List<PriceListSummary> lists, int itemId) {
  final rows = <ItemPriceRow>[];
  for (final l in lists) {
    final p = l.priceFor(itemId);
    if (p != null) {
      rows.add(ItemPriceRow(priceListId: l.id, priceListName: l.name, price: p));
    }
  }
  return rows;
}

/// مدى أسعار صنف عبر القوائم (`$min - $max`)؛ null إن لم يكن له سعر في أي قائمة.
({double min, double max})? priceRange(List<PriceListSummary> lists, int itemId) {
  final prices = pricesForItem(lists, itemId).map((r) => r.price).toList();
  if (prices.isEmpty) return null;
  prices.sort();
  return (min: prices.first, max: prices.last);
}
