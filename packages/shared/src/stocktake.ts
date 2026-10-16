import { roundMoney, roundQty } from './money.js';

/**
 * حساب فرق الجرد لسطر واحد:
 * الفرق = (الكمية الفعلية − كمية النظام) بالوحدات الأساسية.
 * القيمة = الفرق × آخر سعر شراء (تقييم الجرد بالمخزون).
 * السطر غير المُعدّ يُعامل كانفر=0 ولا يحتسب في الإجمالي.
 */
export interface StocktakeLineCalc {
  systemQtyBase: number;
  countedQtyBase: number | null;
  lastCost: number | null;
}

export interface StocktakeLineDiff {
  diffQty: number;
  diffValue: number;
}

export function diffOfStocktakeLine(line: StocktakeLineCalc): StocktakeLineDiff {
  const counted = line.countedQtyBase ?? line.systemQtyBase;
  const diffQty = roundQty(counted - line.systemQtyBase);
  const diffValue = roundMoney(diffQty * (line.lastCost ?? 0));
  return { diffQty, diffValue };
}

/**
 * حد "الفرق الكبير" لإلزام/تنبيه إعادة العد (§5.8.5/§6.3).
 * بند يُعدّ فرقاً كبيراً إذا تجاوز حد القيمة أو حد الكمية (كلاهما معطّل عند 0).
 */
export interface StocktakeRecountThreshold {
  value: number;
  qty: number;
}

export function isBigDiff(diffQty: number, diffValue: number, threshold: StocktakeRecountThreshold): boolean {
  const byQty = threshold.qty > 0 && Math.abs(diffQty) >= threshold.qty;
  const byValue = threshold.value > 0 && Math.abs(diffValue) >= threshold.value;
  return byQty || byValue;
}

export interface StocktakeSummary {
  lines: number;
  countedLines: number;
  uncountedLines: number;
  totalDiffQty: number;
  totalDiffValue: number;
  surplusLines: number;
  deficitLines: number;
  surplusQty: number;
  deficitQty: number;
  surplusValue: number;
  deficitValue: number;
  noCostLines: number;
  bigDiffLines: number;
  bigDiffQty: number;
  bigDiffValue: number;
}

/** ملخص الجلسة جرد: إجماليات الكميات والقيم (زيادة/عجز)، بند بلا سعر، والبنود ذات الفروقات الكبيرة. */
export function summarizeStocktake(lines: StocktakeLineCalc[], threshold?: StocktakeRecountThreshold): StocktakeSummary {
  const th: StocktakeRecountThreshold = threshold ?? { value: 0, qty: 0 };
  let countedLines = 0;
  let uncountedLines = 0;
  let totalDiffQty = 0;
  let totalDiffValue = 0;
  let surplusLines = 0;
  let deficitLines = 0;
  let surplusQty = 0;
  let deficitQty = 0;
  let surplusValue = 0;
  let deficitValue = 0;
  let noCostLines = 0;
  let bigDiffLines = 0;
  let bigDiffQty = 0;
  let bigDiffValue = 0;

  for (const line of lines) {
    if (line.countedQtyBase == null) {
      uncountedLines++;
      continue;
    }
    countedLines++;
    const { diffQty, diffValue } = diffOfStocktakeLine(line);
    totalDiffQty = roundQty(totalDiffQty + diffQty);
    totalDiffValue = roundMoney(totalDiffValue + diffValue);
    if (diffQty > 0) {
      surplusLines++;
      surplusQty = roundQty(surplusQty + diffQty);
      surplusValue = roundMoney(surplusValue + diffValue);
    } else if (diffQty < 0) {
      deficitLines++;
      deficitQty = roundQty(deficitQty + Math.abs(diffQty));
      deficitValue = roundMoney(deficitValue + Math.abs(diffValue));
    }
    if (line.lastCost == null) noCostLines++;
    if (isBigDiff(diffQty, diffValue, th)) {
      bigDiffLines++;
      bigDiffQty = roundQty(bigDiffQty + Math.abs(diffQty));
      bigDiffValue = roundMoney(bigDiffValue + Math.abs(diffValue));
    }
  }

  return {
    lines: lines.length,
    countedLines,
    uncountedLines,
    totalDiffQty,
    totalDiffValue,
    surplusLines,
    deficitLines,
    surplusQty,
    deficitQty,
    surplusValue,
    deficitValue,
    noCostLines,
    bigDiffLines,
    bigDiffQty,
    bigDiffValue,
  };
}