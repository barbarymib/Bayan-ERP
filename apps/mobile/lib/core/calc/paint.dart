import 'money.dart';

/// حاسبة كميات الدهانات — اللترات = المساحة × الوجوه ÷ التغطية،
/// ثم عدد العبوات = تقريب لأعلى.
class PaintResult {
  final double liters;
  final int packs;
  final double purchasedLiters;
  const PaintResult({
    required this.liters,
    required this.packs,
    required this.purchasedLiters,
  });
}

void _assertPositive(double value, String name) {
  if (!value.isFinite || value <= 0) {
    throw ArgumentError('$name must be a positive number');
  }
}

double paintLiters({
  required double areaM2,
  required int coats,
  required double coverageM2PerL,
}) {
  _assertPositive(areaM2, 'areaM2');
  if (coats <= 0) throw ArgumentError('coats must be a positive number');
  _assertPositive(coverageM2PerL, 'coverageM2PerL');
  return roundQty((areaM2 * coats) / coverageM2PerL);
}

PaintResult calcPaint({
  required double areaM2,
  required int coats,
  required double coverageM2PerL,
  required double packSizeL,
}) {
  _assertPositive(packSizeL, 'packSizeL');
  final liters = paintLiters(
    areaM2: areaM2,
    coats: coats,
    coverageM2PerL: coverageM2PerL,
  );
  final packs = (liters / packSizeL).ceil();
  return PaintResult(
    liters: liters,
    packs: packs,
    purchasedLiters: roundQty(packs * packSizeL),
  );
}