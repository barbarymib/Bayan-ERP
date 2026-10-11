import 'money.dart';

enum DiscountType { percent, amount }

class Discount {
  final DiscountType type;
  final double value;
  const Discount(this.type, this.value);

  static const none = Discount(DiscountType.amount, 0);
}

void validateDiscount(Discount d) {
  if (d.value < 0) throw ArgumentError('Discount value cannot be negative');
  if (d.type == DiscountType.percent && d.value > 100) {
    throw ArgumentError('Percent discount cannot exceed 100');
  }
}

/// خصم البند: نسبة على إجمالي البند، أو قيمة ثابتة لا تتجاوز الإجمالي.
double calcLineDiscount(double lineTotal, Discount discount) {
  validateDiscount(discount);
  final gross = roundMoney(lineTotal);
  if (discount.type == DiscountType.percent) {
    return roundMoney((gross * discount.value) / 100);
  }
  return roundMoney(discount.value < gross ? discount.value : gross);
}

/// خصم البيان: يُحسب على مجموع البنود بعد خصوماتها.
double calcHeaderDiscount(double subtotalAfterLineDiscounts, Discount discount) =>
    calcLineDiscount(subtotalAfterLineDiscounts, discount);

/// توزيع خصم البيان على البنود نسبياً لصافي كل بند،
/// مع تصحيح فرق التقريب على آخر بند غير صفري.
List<double> allocateHeaderDiscount(List<double> lineNets, double headerDiscountTotal) {
  final subtotal = roundMoney(lineNets.fold<double>(0, (s, n) => s + n));
  final total = roundMoney(headerDiscountTotal);
  if (lineNets.isEmpty) return [];
  if (subtotal == 0 || total == 0) return List<double>.filled(lineNets.length, 0);

  final allocations =
      lineNets.map((net) => net == 0 ? 0.0 : roundMoney((total * net) / subtotal)).toList();

  final allocatedSum = allocations.fold<double>(0, (s, a) => s + a);
  final diff = roundMoney(total - allocatedSum);
  if (diff != 0) {
    for (var i = allocations.length - 1; i >= 0; i--) {
      if (lineNets[i] != 0) {
        allocations[i] = roundMoney(allocations[i] + diff);
        break;
      }
    }
  }
  return allocations;
}