import 'money.dart';

class UnitDef {
  final String id;
  final String name;
  final double factorToBase;
  final bool allowDecimal;
  const UnitDef({
    required this.id,
    required this.name,
    required this.factorToBase,
    required this.allowDecimal,
  });
}

double toBaseQty(double qty, UnitDef unit) {
  if (qty < 0) throw ArgumentError('qty cannot be negative');
  if (!unit.allowDecimal && qty != qty.roundToDouble()) {
    throw ArgumentError('Unit ${unit.name} does not accept fractional quantities');
  }
  return roundQty(qty * unit.factorToBase);
}

double fromBaseQty(double qtyBase, UnitDef unit) {
  if (qtyBase < 0) throw ArgumentError('qtyBase cannot be negative');
  if (unit.factorToBase <= 0) throw ArgumentError('factorToBase must be positive');
  final converted = roundQty(qtyBase / unit.factorToBase);
  if (!unit.allowDecimal && converted != converted.roundToDouble()) {
    throw ArgumentError('Quantity $qtyBase cannot be expressed as whole units of ${unit.name}');
  }
  return converted;
}

double convertQty(double qty, UnitDef from, UnitDef to) =>
    fromBaseQty(toBaseQty(qty, from), to);

class UnitQty {
  final UnitDef unit;
  final double qty;
  const UnitQty(this.unit, this.qty);
}

/// عرض مركب للرصيد: خوارزمية جشعة على الوحدات من الأكبر للأصغر.
List<UnitQty> decomposeQty(double qtyBase, List<UnitDef> units) {
  if (qtyBase < 0) throw ArgumentError('qtyBase cannot be negative');
  final sorted = [...units]..sort((a, b) => b.factorToBase.compareTo(a.factorToBase));
  var remaining = roundQty(qtyBase);
  final result = <UnitQty>[];
  for (final unit in sorted) {
    if (unit.factorToBase <= 0) continue;
    final count = (remaining / unit.factorToBase).floor();
    if (count > 0) {
      result.add(UnitQty(unit, count.toDouble()));
      remaining = roundQty(remaining - count * unit.factorToBase);
    }
  }
  if (remaining > 0) {
    UnitDef? base;
    for (final u in sorted) {
      if (u.factorToBase == 1) {
        base = u;
        break;
      }
    }
    base ??= sorted.isNotEmpty ? sorted.last : null;
    if (base != null) {
      if (result.isNotEmpty && result.last.unit.id == base.id) {
        final last = result.removeLast();
        result.add(UnitQty(base, roundQty(last.qty + remaining)));
      } else {
        result.add(UnitQty(base, remaining));
      }
    }
  }
  return result.where((r) => r.qty > 0).toList();
}