import '../../core/calc/units.dart';
import '../../core/models.dart';
import '../../core/print/receipt.dart';

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

/// تحويل وحدات الصنف المُزامَنة إلى تعريفات التفكيك (تُسقط الوحدات بلا عامل موجب،
/// وتُضاف وحدة أساس بعامل 1 إن لم تكن ضمن الوحدات — كما يفعل فاحص الباركود G13).
List<UnitDef> _unitDefs(ItemSummary item) {
  final defs = [
    for (final u in item.units)
      if (u.factorToBase > 0)
        UnitDef(
          id: '${u.unitId}',
          name: u.unitCode ?? item.baseUnit ?? '',
          factorToBase: u.factorToBase,
          allowDecimal: u.allowDecimal,
        ),
  ];
  if (!defs.any((u) => u.factorToBase == 1) && (item.baseUnit?.isNotEmpty ?? false)) {
    defs.add(UnitDef(id: 'base', name: item.baseUnit!, factorToBase: 1, allowDecimal: true));
  }
  return defs;
}

/// تسمية رصيد الصنف بالعرض المركّب «3 كرتونة + 500 كغ» أو الأساسي عند تعذّر التفكيك (G12/R3-F2 §8.2 #7).
String stockLabel(ItemSummary item, double qty) {
  final defs = _unitDefs(item);
  if (qty >= 0 && defs.isNotEmpty) {
    final parts = decomposeQty(qty, defs);
    if (parts.isNotEmpty) return parts.map((p) => '${fmtQty(p.qty)} ${p.unit.name}').join(' + ');
    if (qty == 0) return '0 ${item.baseUnit ?? ''}'.trim();
  }
  final unit = item.baseUnit == null ? '' : ' ${item.baseUnit}';
  return '${fmtQty(qty)}$unit';
}
