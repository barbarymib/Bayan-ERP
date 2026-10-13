import { roundMoney, roundQty } from './money.js';

/**
 * تقييم المخزون (§7.4) — كلون المشترك: قيمة المخزون = Σ (رصيد الصنف بالوحدة
 * الأساسية × تكلفة الوحدة الأساسية). يدعم ثلاث طرق مطابقة للسيرفر:
 * LAST = آخر سعر شراء، WEIGHTED = متوسط مرجح للمشتريات، SALES = سعر البيع.
 */
export type ValuationMethod = 'LAST' | 'WEIGHTED' | 'SALES';

export interface PurchaseLot {
  qtyBase: number;
  cost: number;
}

export interface ValuationLineInput {
  /** رصيد الصنف بالوحدة الأساسية */
  qtyBase: number;
  /** آخر سعر شراء للوحدة الأساسية (طريقة LAST) */
  lastPurchaseCost?: number | null;
  /** مشتريات الصنف (طريقة WEIGHTED) */
  purchases?: readonly PurchaseLot[];
  /** سعر بيع الوحدة الأساسية (طريقة SALES) */
  salePrice?: number | null;
}

/**
 * متوسط التكلفة المرجح = Σ(كمية موجبة × تكلفة) ÷ Σ(كمية موجبة).
 * يُرجع صفراً إذا لم تكن هناك كميات موجبة (يطابق تجميع السيرفر).
 */
export function weightedAverageCost(purchases: readonly PurchaseLot[]): number {
  let qty = 0;
  let value = 0;
  for (const lot of purchases) {
    if (lot.qtyBase > 0) {
      qty += lot.qtyBase;
      value += lot.qtyBase * lot.cost;
    }
  }
  return qty > 0 ? roundMoney(value / qty) : 0;
}

/** تكلفة الوحدة الأساسية حسب طريقة التقييم (صفر عند غياب المصدر). */
export function resolveUnitCost(line: ValuationLineInput, method: ValuationMethod = 'LAST'): number {
  switch (method) {
    case 'WEIGHTED':
      return weightedAverageCost(line.purchases ?? []);
    case 'SALES':
      return line.salePrice ?? 0;
    case 'LAST':
    default:
      return line.lastPurchaseCost ?? 0;
  }
}

/** قيمة بند مخزون = رصيد الأساس × تكلفة الوحدة الأساسية، يُقرَّب مالياً. */
export function calcStockLineValue(qtyBase: number, unitCost: number): number {
  return roundMoney(roundQty(qtyBase) * unitCost);
}

export interface StockValueTotals {
  qtyBase: number;
  value: number;
}

/**
 * إجمالي قيمة المخزون = Σ قيمة البنود (§7.4).
 * يُجمَع الرصيد بالتدوير الكميّ والقيمة بالتدوير المالي بنداً بنداً
 * (يطابق تجميع السيرفر تماماً فيتجنب فرق التقريب المتراكم).
 */
export function calcStockValue(
  rows: readonly ValuationLineInput[],
  method: ValuationMethod = 'LAST',
): StockValueTotals {
  let qtyBase = 0;
  let value = 0;
  for (const row of rows) {
    const qty = roundQty(row.qtyBase);
    qtyBase = roundQty(qtyBase + qty);
    value = roundMoney(value + calcStockLineValue(qty, resolveUnitCost(row, method)));
  }
  return { qtyBase, value };
}
