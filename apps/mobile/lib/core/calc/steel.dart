/// حاسبة أوزان الحديد — كلون مطابق لـ packages/shared/src/steel.ts.
library;

import 'money.dart';

/// كثافة الحديد الصلب (كجم/م³).
const double steelDensityKgM3 = 7850;

double _areaM2(double diameterMm) {
  final d = diameterMm / 1000;
  return (3.141592653589793 * d * d) / 4;
}

/// وزن سيخ واحد (كجم) = مساحة المقطع × الطول × كثافة الحديد.
double steelBarWeightKg({required double diameterMm, required double lengthM}) {
  if (!diameterMm.isFinite || diameterMm <= 0) {
    throw ArgumentError('diameterMm must be a positive number');
  }
  if (!lengthM.isFinite || lengthM <= 0) {
    throw ArgumentError('lengthM must be a positive number');
  }
  return roundQty(_areaM2(diameterMm) * lengthM * steelDensityKgM3);
}

/// الوزن النظري لعدد من الأسياخ (كجم).
double steelWeightKg({
  required double diameterMm,
  required double lengthM,
  required int count,
}) {
  if (!diameterMm.isFinite || diameterMm <= 0) {
    throw ArgumentError('diameterMm must be a positive number');
  }
  if (!lengthM.isFinite || lengthM <= 0) {
    throw ArgumentError('lengthM must be a positive number');
  }
  if (count <= 0) {
    throw ArgumentError('count must be a positive number');
  }
  final perBar = _areaM2(diameterMm) * lengthM * steelDensityKgM3;
  return roundQty(perBar * count);
}

/// وزن المتر الطولي لسيخ بقطر معيّن (كجم/م).
double steelWeightPerMeterKg(double diameterMm) {
  if (!diameterMm.isFinite || diameterMm <= 0) {
    throw ArgumentError('diameterMm must be a positive number');
  }
  return roundQty(_areaM2(diameterMm) * steelDensityKgM3);
}