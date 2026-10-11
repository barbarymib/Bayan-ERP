import 'money.dart';

/// سعر وحدة المرتجع الأساسي = صافي البند الأصلي ÷ الكمية المباعة.
/// يُحتفظ به دقيقاً ويُقرَّب عند العرض فقط (قيمته = القيمة النهائية ÷ الكمية).
double calcReturnUnitNetPrice(double lineNetFinal, double originalQty) {
  if (originalQty <= 0) throw ArgumentError('originalQty must be positive');
  return lineNetFinal / originalQty;
}

/// قيمة المرتجع = كمية المرتجع × سعر الوحدة الأساسي، تُقرَّب مرة واحدة على القيمة
/// (يبقى المرتجع الكامل مطابقاً لصافي البند حرفياً).
double calcReturnLineValue(double lineNetFinal, double originalQty, double returnQty) {
  if (returnQty <= 0) throw ArgumentError('returnQty must be positive');
  if (originalQty <= 0) throw ArgumentError('originalQty must be positive');
  if (returnQty > originalQty) throw ArgumentError('returnQty cannot exceed originalQty');
  return roundMoney((lineNetFinal * returnQty) / originalQty);
}

void validateReturnQty({
  required double originalQty,
  required double alreadyReturnedQty,
  required double requestedQty,
}) {
  final remaining = roundQty(originalQty - alreadyReturnedQty);
  if (requestedQty <= 0) throw ArgumentError('requestedQty must be positive');
  if (roundQty(requestedQty) > remaining) {
    throw ArgumentError('Return qty $requestedQty exceeds returnable qty $remaining');
  }
}