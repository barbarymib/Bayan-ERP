/// تقييم المخزون (§7.4) — كلون Dart مطابق لـ `packages/shared/src/valuation.ts`.
///
/// قيمة المخزون = Σ (رصيد الصنف بالوحدة الأساسية × تكلفة الوحدة الأساسية).
/// ثلاث طرق تقييم مطابقة للسيرفر: LAST (آخر شراء)، WEIGHTED (متوسط مرجح)،
/// SALES (سعر البيع).
library;

import 'money.dart';

enum ValuationMethod { last, weighted, sales }

class PurchaseLot {
  const PurchaseLot({required this.qtyBase, required this.cost});

  final double qtyBase;
  final double cost;
}

class ValuationLineInput {
  const ValuationLineInput({
    required this.qtyBase,
    this.lastPurchaseCost,
    this.purchases = const [],
    this.salePrice,
  });

  final double qtyBase;
  final double? lastPurchaseCost;
  final List<PurchaseLot> purchases;
  final double? salePrice;
}

class StockValueTotals {
  const StockValueTotals({required this.qtyBase, required this.value});

  final double qtyBase;
  final double value;

  @override
  bool operator ==(Object other) =>
      other is StockValueTotals && other.qtyBase == qtyBase && other.value == value;

  @override
  int get hashCode => Object.hash(qtyBase, value);
}

/// متوسط التكلفة المرجح = Σ(كمية موجبة × تكلفة) ÷ Σ(كمية موجبة).
/// صفر إذا لم تكن هناك كميات موجبة (يطابق تجميع السيرفر).
double weightedAverageCost(List<PurchaseLot> purchases) {
  var qty = 0.0;
  var value = 0.0;
  for (final lot in purchases) {
    if (lot.qtyBase > 0) {
      qty += lot.qtyBase;
      value += lot.qtyBase * lot.cost;
    }
  }
  return qty > 0 ? roundMoney(value / qty) : 0;
}

/// تكلفة الوحدة الأساسية حسب طريقة التقييم (صفر عند غياب المصدر).
double resolveUnitCost(ValuationLineInput line, [ValuationMethod method = ValuationMethod.last]) {
  switch (method) {
    case ValuationMethod.weighted:
      return weightedAverageCost(line.purchases);
    case ValuationMethod.sales:
      return line.salePrice ?? 0;
    case ValuationMethod.last:
      return line.lastPurchaseCost ?? 0;
  }
}

/// قيمة بند مخزون = رصيد الأساس × تكلفة الوحدة الأساسية، يُقرَّب مالياً.
double calcStockLineValue(double qtyBase, double unitCost) =>
    roundMoney(roundQty(qtyBase) * unitCost);

/// إجمالي قيمة المخزون = Σ قيمة البنود (§7.4).
/// يُجمَع الرصيد بالتدوير الكميّ والقيمة بالتدوير المالي بنداً بنداً
/// (يطابق تجميع السيرفر فيتجنب فرق التقريب المتراكم).
StockValueTotals calcStockValue(
  List<ValuationLineInput> rows, [
  ValuationMethod method = ValuationMethod.last,
]) {
  var qtyBase = 0.0;
  var value = 0.0;
  for (final row in rows) {
    final qty = roundQty(row.qtyBase);
    qtyBase = roundQty(qtyBase + qty);
    value = roundMoney(value + calcStockLineValue(qty, resolveUnitCost(row, method)));
  }
  return StockValueTotals(qtyBase: qtyBase, value: value);
}
