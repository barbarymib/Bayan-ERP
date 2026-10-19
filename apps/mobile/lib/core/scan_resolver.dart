import 'models.dart';

/// نوع مطابقة الفحص (§9/G13).
enum ScanMatchKind { unitBarcode, itemBarcode, itemCode }

/// نتيجة فحص باركود/كود: الصنف + الوحدة إن طابق باركود الوحدة.
class ScanTarget {
  final ItemSummary item;
  final ItemUnitSummary? unit;
  final ScanMatchKind kind;

  const ScanTarget({required this.item, this.unit, required this.kind});
}

/// يطابق نص الفحص بالترتيب: باركود الوحدة ← باركود الصنف ← كود الصنف.
/// المقارنة بعد إزالة المسافات وبدون حساسية لحالة الأحرف.
ScanTarget? resolveScan(String raw, List<ItemSummary> items) {
  final needle = raw.trim().toLowerCase();
  if (needle.isEmpty) return null;

  for (final item in items) {
    for (final unit in item.units) {
      final barcode = unit.barcode?.trim().toLowerCase();
      if (barcode != null && barcode.isNotEmpty && barcode == needle) {
        return ScanTarget(item: item, unit: unit, kind: ScanMatchKind.unitBarcode);
      }
    }
  }
  for (final item in items) {
    final barcode = item.barcode?.trim().toLowerCase();
    if (barcode != null && barcode.isNotEmpty && barcode == needle) {
      return ScanTarget(item: item, kind: ScanMatchKind.itemBarcode);
    }
  }
  for (final item in items) {
    if (item.code.trim().toLowerCase() == needle) {
      return ScanTarget(item: item, kind: ScanMatchKind.itemCode);
    }
  }
  return null;
}

/// يطابق نص فحص QR الزبون (§5.16/G13) بكود الزبون — حمولة QR في الويب هي
/// الكود. المقارنة بعد إزالة المسافات وبدون حساسية لحالة الأحرف.
CustomerSummary? resolveCustomerScan(String raw, List<CustomerSummary> customers) {
  final needle = raw.trim().toLowerCase();
  if (needle.isEmpty) return null;
  for (final customer in customers) {
    if (customer.code.trim().toLowerCase() == needle) return customer;
  }
  return null;
}

/// وحدات البيع المتاحة للصنف مرتّبة تصاعدياً بعامل التحويل (§5.2: التجزئة
/// الكبرى ← الصغرى). تُضاف الوحدة الأساسية (عامل 1) إن لم تكن مُدرجة كوحدة —
/// في موضعها الصارِف ضمن الترتيب (قد يكون العامل 1 أكبر من كسور وحدات أخرى).
List<ItemUnitSummary> saleUnits(ItemSummary item) {
  final units = [
    for (final u in item.units)
      if (u.isSale && u.factorToBase > 0) u,
  ]..sort((a, b) => a.factorToBase.compareTo(b.factorToBase));
  if (!units.any((u) => u.factorToBase == 1)) {
    final at = units.indexWhere((u) => u.factorToBase > 1);
    units.insert(at == -1 ? units.length : at, ItemUnitSummary(unitId: 0, unitCode: item.baseUnit, factorToBase: 1));
  }
  return units;
}

/// الوحدة المختارة لسطر بيان جديد (§5.12/G14): وحدة الفحص إن كانت من وحدات
/// البيع الفعلية، وإلا الوحدة الأساسية (عامل 1) — أو الأصغر عاملًا عند غيابها.
/// مطابقة الفحص بعد المسافات وبدون حساسية لحالة الأحرف.
String? selectLineUnit(List<ItemUnitSummary> units, {String? scannedCode}) {
  final needle = scannedCode?.trim().toLowerCase();
  if (needle != null && needle.isNotEmpty) {
    for (final u in units) {
      final code = u.unitCode;
      if (code != null && code.trim().toLowerCase() == needle && u.isSale && u.factorToBase > 0) {
        return code;
      }
    }
  }
  for (final u in units) {
    if (u.factorToBase == 1) return u.unitCode;
  }
  return units.isNotEmpty ? units.first.unitCode : null;
}
