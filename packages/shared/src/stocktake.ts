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
}

/** ملخّص جلسة جرد: أعداد، فروقات كمية وقيمة (عجز/زيادة)، بنود بلا سعر. */
export function summarizeStocktake(lines: StocktakeLineCalc[]): StocktakeSummary {
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
  };
}