import 'money.dart';

class StocktakeLineInput {
  final double systemQtyBase;
  final double? countedQtyBase;
  final double? lastCost;
  const StocktakeLineInput({required this.systemQtyBase, this.countedQtyBase, this.lastCost});
}

class StocktakeLineDiff {
  final double diffQty;
  final double diffValue;
  const StocktakeLineDiff(this.diffQty, this.diffValue);
}

StocktakeLineDiff diffOfStocktakeLine(StocktakeLineInput input) {
  final counted = input.countedQtyBase ?? input.systemQtyBase;
  final diffQty = roundQty(counted - input.systemQtyBase);
  final diffValue = roundMoney(diffQty * (input.lastCost ?? 0));
  return StocktakeLineDiff(diffQty, diffValue);
}

class StocktakeSummary {
  final int lines;
  final int countedLines;
  final int uncountedLines;
  final double totalDiffQty;
  final double totalDiffValue;
  final int surplusLines;
  final int deficitLines;
  final double surplusQty;
  final double deficitQty;
  final double surplusValue;
  final double deficitValue;
  final int noCostLines;
  const StocktakeSummary({
    required this.lines,
    required this.countedLines,
    required this.uncountedLines,
    required this.totalDiffQty,
    required this.totalDiffValue,
    required this.surplusLines,
    required this.deficitLines,
    required this.surplusQty,
    required this.deficitQty,
    required this.surplusValue,
    required this.deficitValue,
    required this.noCostLines,
  });
}

StocktakeSummary summarizeStocktake(List<StocktakeLineInput> inputs) {
  var countedLines = 0;
  var uncountedLines = 0;
  var totalDiffQty = 0.0;
  var totalDiffValue = 0.0;
  var surplusLines = 0;
  var deficitLines = 0;
  var surplusQty = 0.0;
  var deficitQty = 0.0;
  var surplusValue = 0.0;
  var deficitValue = 0.0;
  var noCostLines = 0;

  for (final input in inputs) {
    if (input.countedQtyBase == null) {
      uncountedLines++;
      continue;
    }
    countedLines++;
    final r = diffOfStocktakeLine(input);
    totalDiffQty = roundQty(totalDiffQty + r.diffQty);
    totalDiffValue = roundMoney(totalDiffValue + r.diffValue);
    if (r.diffQty > 0) {
      surplusLines++;
      surplusQty = roundQty(surplusQty + r.diffQty);
      surplusValue = roundMoney(surplusValue + r.diffValue);
    } else if (r.diffQty < 0) {
      deficitLines++;
      deficitQty = roundQty(deficitQty - r.diffQty);
      deficitValue = roundMoney(deficitValue - r.diffValue);
    }
    if (input.lastCost == null) noCostLines++;
  }

  return StocktakeSummary(
    lines: inputs.length,
    countedLines: countedLines,
    uncountedLines: uncountedLines,
    totalDiffQty: totalDiffQty,
    totalDiffValue: totalDiffValue,
    surplusLines: surplusLines,
    deficitLines: deficitLines,
    surplusQty: surplusQty,
    deficitQty: deficitQty,
    surplusValue: surplusValue,
    deficitValue: deficitValue,
    noCostLines: noCostLines,
  );
}