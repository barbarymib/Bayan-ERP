/// محرك الحسابات المشترك — كلون Dart مطابق لـ packages/shared (ADR-2).
///
/// التدوير المالي آمن: نستخدم نفس أسلوب التحويل النصي-الأُسّي المستخدم في
/// نسخة TypeScript لتفادي أخطاء الفاصلة العائمة، مع تقريب half-up (بعيداً عن الصفر).
library;

const int kDecimalPlaces = 2;
const int qtyDecimalPlaces = 3;

/// النطاق الآمن للتحويل النصي-الأُسّي (أقل من 10^15).
const double _safeMagnitude = 1e15;

double _roundTo(double value, int places) {
  if (!value.isFinite) {
    throw ArgumentError('Non-finite numeric value: $value');
  }
  if (value.abs() >= _safeMagnitude) {
    throw ArgumentError('Value $value exceeds safe rounding magnitude');
  }
  final shifted = _shiftDecimal(value, places);
  final sign = shifted < 0 ? -1.0 : 1.0;
  final rounded = sign * (shifted.abs() + 0.5).floorToDouble();
  return _shiftDecimal(rounded, -places);
}

/// إزاحة عشرية عبر تمثيل نصي لتفادي (x * 10^places) العائم.
double _shiftDecimal(double value, int places) {
  final s = value.toString();
  if (s.contains('e') || s.contains('E')) {
    return value * _pow10(places);
  }
  final exp = places >= 0 ? 'e+$places' : 'e$places';
  return double.parse('$s$exp');
}

double _pow10(int places) {
  final p = places.abs();
  var r = 1.0;
  for (var i = 0; i < p; i++) {
    r *= 10;
  }
  return places >= 0 ? r : 1 / r;
}

/// تدوير مالي إلى خانتين عشريتين (half-up بعيداً عن الصفر).
double roundMoney(double value) => _roundTo(value, 2);

/// تدوير كمية إلى 3 خانات عشرية (الكميات الوزنية).
double roundQty(double value) => _roundTo(value, 3);

bool isZero(num value, [double epsilon = 1e-9]) => value.abs() < epsilon;