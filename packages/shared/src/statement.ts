import {
  Discount,
  NO_DISCOUNT,
  allocateHeaderDiscount,
  calcHeaderDiscount,
  calcLineDiscount,
} from './discount.js';
import { roundMoney } from './money.js';

export interface StatementLineInput {
  /** الكمية بوحدة البيع */
  qty: number;
  /** سعر الوحدة بوحدة البيع */
  unitPrice: number;
  /** خصم البند (نسبة على البند أو قيمة ثابتة) */
  discount?: Discount;
}

export interface StatementTotalsInput {
  lines: readonly StatementLineInput[];
  /** خصم البيان: يُحسب على مجموع البنود بعد خصوماتها */
  headerDiscount?: Discount;
  /** مصاريف نقل/تحميل */
  shipping?: number;
  /** ضريبة % (0-100) */
  taxPercent?: number;
}

export interface StatementLineTotals {
  gross: number;
  lineDiscountAmount: number;
  netAfterLineDiscount: number;
  allocatedHeaderDiscount: number;
  netFinal: number;
}

export interface StatementTotals {
  lines: StatementLineTotals[];
  subtotal: number;
  headerDiscountAmount: number;
  shipping: number;
  tax: number;
  net: number;
}

/**
 * حساب إجماليات بيان الأسعار وفق §7.4:
 * خصم البند أولاً ← خصم البيان على الصافي ← توزيع نصيب البند من خصم البيان
 * (لأغراض المرتجعات والربحية) ← نقل ← ضريبة.
 * فرق التقريب يُصحَّح على آخر بند غير صفري.
 */
export function calcStatementTotals(input: StatementTotalsInput): StatementTotals {
  const headerDiscount = input.headerDiscount ?? NO_DISCOUNT;
  const shipping = roundMoney(input.shipping ?? 0);
  const taxPercent = input.taxPercent ?? 0;
  if (taxPercent < 0 || taxPercent > 100) {
    throw new Error('taxPercent must be between 0 and 100');
  }

  const lineNets = input.lines.map((line) => {
    if (line.qty <= 0) throw new Error('Line qty must be positive');
    if (line.unitPrice < 0) throw new Error('Line unit price cannot be negative');
    const gross = roundMoney(line.qty * line.unitPrice);
    const lineDiscountAmount = calcLineDiscount(gross, line.discount ?? NO_DISCOUNT);
    return { gross, lineDiscountAmount, net: roundMoney(gross - lineDiscountAmount) };
  });

  const subtotal = roundMoney(lineNets.reduce((sum, l) => sum + l.net, 0));
  const headerDiscountAmount = calcHeaderDiscount(subtotal, headerDiscount);
  const allocations = allocateHeaderDiscount(
    lineNets.map((l) => l.net),
    headerDiscountAmount,
  );

  const lines: StatementLineTotals[] = lineNets.map((l, i) => ({
    gross: l.gross,
    lineDiscountAmount: l.lineDiscountAmount,
    netAfterLineDiscount: l.net,
    allocatedHeaderDiscount: allocations[i] ?? 0,
    netFinal: roundMoney(l.net - (allocations[i] ?? 0)),
  }));

  const taxable = roundMoney(subtotal - headerDiscountAmount + shipping);
  const tax = roundMoney((taxable * taxPercent) / 100);
  const net = roundMoney(taxable + tax);

  return { lines, subtotal, headerDiscountAmount, shipping, tax, net };
}
