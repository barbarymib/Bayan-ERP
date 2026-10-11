import 'discount.dart';
import 'money.dart';

class StatementLineInput {
  final double qty;
  final double unitPrice;
  final Discount? discount;
  const StatementLineInput({required this.qty, required this.unitPrice, this.discount});
}

class StatementTotalsInput {
  final List<StatementLineInput> lines;
  final Discount? headerDiscount;
  final double? shipping;
  final double? taxPercent;
  const StatementTotalsInput({
    required this.lines,
    this.headerDiscount,
    this.shipping,
    this.taxPercent,
  });
}

class StatementLineTotals {
  final double gross;
  final double lineDiscountAmount;
  final double netAfterLineDiscount;
  final double allocatedHeaderDiscount;
  final double netFinal;
  const StatementLineTotals({
    required this.gross,
    required this.lineDiscountAmount,
    required this.netAfterLineDiscount,
    required this.allocatedHeaderDiscount,
    required this.netFinal,
  });
}

class StatementTotals {
  final List<StatementLineTotals> lines;
  final double subtotal;
  final double headerDiscountAmount;
  final double shipping;
  final double tax;
  final double net;
  const StatementTotals({
    required this.lines,
    required this.subtotal,
    required this.headerDiscountAmount,
    required this.shipping,
    required this.tax,
    required this.net,
  });
}

/// حساب إجماليات بيان الأسعار وفق §7.4:
/// خصم البند ← خصم البيان على الصافي ← توزيع نصيب البند ← نقل ← ضريبة.
StatementTotals calcStatementTotals(StatementTotalsInput input) {
  final headerDiscount = input.headerDiscount ?? Discount.none;
  final shipping = roundMoney(input.shipping ?? 0);
  final taxPercent = input.taxPercent ?? 0;
  if (taxPercent < 0 || taxPercent > 100) {
    throw ArgumentError('taxPercent must be between 0 and 100');
  }

  final lineNets = input.lines.map((line) {
    if (line.qty <= 0) throw ArgumentError('Line qty must be positive');
    if (line.unitPrice < 0) throw ArgumentError('Line unit price cannot be negative');
    final gross = roundMoney(line.qty * line.unitPrice);
    final lineDiscountAmount = calcLineDiscount(gross, line.discount ?? Discount.none);
    return _LineNet(gross, lineDiscountAmount, roundMoney(gross - lineDiscountAmount));
  }).toList();

  final subtotal = roundMoney(lineNets.fold<double>(0, (s, l) => s + l.net));
  final headerDiscountAmount = calcHeaderDiscount(subtotal, headerDiscount);
  final allocations = allocateHeaderDiscount(lineNets.map((l) => l.net).toList(), headerDiscountAmount);

  final lines = <StatementLineTotals>[];
  for (var i = 0; i < lineNets.length; i++) {
    final l = lineNets[i];
    final alloc = i < allocations.length ? allocations[i] : 0.0;
    lines.add(StatementLineTotals(
      gross: l.gross,
      lineDiscountAmount: l.lineDiscountAmount,
      netAfterLineDiscount: l.net,
      allocatedHeaderDiscount: alloc,
      netFinal: roundMoney(l.net - alloc),
    ));
  }

  final taxable = roundMoney(subtotal - headerDiscountAmount + shipping);
  final tax = roundMoney((taxable * taxPercent) / 100);
  final net = roundMoney(taxable + tax);

  return StatementTotals(
    lines: lines,
    subtotal: subtotal,
    headerDiscountAmount: headerDiscountAmount,
    shipping: shipping,
    tax: tax,
    net: net,
  );
}

class _LineNet {
  final double gross;
  final double lineDiscountAmount;
  final double net;
  const _LineNet(this.gross, this.lineDiscountAmount, this.net);
}