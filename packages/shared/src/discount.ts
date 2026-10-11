import { roundMoney } from './money.js';

export type DiscountType = 'percent' | 'amount';

export interface Discount {
  type: DiscountType;
  /** بالنسبة: 0-100. للقيمة: مبلغ بالجنيه. */
  value: number;
}

export const NO_DISCOUNT: Discount = { type: 'amount', value: 0 };

export function validateDiscount(discount: Discount): void {
  if (discount.value < 0) {
    throw new Error('Discount value cannot be negative');
  }
  if (discount.type === 'percent' && discount.value > 100) {
    throw new Error('Percent discount cannot exceed 100');
  }
}

/**
 * خصم الصنف/البند: نسبة تُحسب على إجمالي البند، أو قيمة ثابتة تُخصم منه.
 * الترتيب في النظام: خصم البند أولاً ثم خصم البيان.
 *
 * القاعدة الحمائية: قيمة الخصم الثابت لا تتجاوز إجمالي البند مطلقاً
 * (القيمة الزائدة تُقصر على الإجمالي) لضمان ألا يصبح الصافي سالباً.
 */
export function calcLineDiscount(lineTotal: number, discount: Discount): number {
  validateDiscount(discount);
  const gross = roundMoney(lineTotal);
  if (discount.type === 'percent') {
    return roundMoney((gross * discount.value) / 100);
  }
  return roundMoney(Math.min(discount.value, gross));
}

/**
 * خصم البيان: نسبة تُحسب على مجموع البنود بعد خصوماتها، أو قيمة ثابتة.
 */
export function calcHeaderDiscount(subtotalAfterLineDiscounts: number, discount: Discount): number {
  return calcLineDiscount(subtotalAfterLineDiscounts, discount);
}

/**
 * توزيع خصم البيان (الثابت أو النسبي) على البنود نسبياً لأغراض
 * حساب الربحية والمرتجعات.
 * القاعدة: نصيب البند = خصم البيان × (صافي البند بعد خصم البند / مجموع الصافي).
 * التدوير: يُصحَّح فرق التقريب على آخر بند غير صفري.
 */
export function allocateHeaderDiscount(
  lineNets: readonly number[],
  headerDiscountTotal: number,
): number[] {
  const subtotal = roundMoney(lineNets.reduce((sum, n) => sum + n, 0));
  const total = roundMoney(headerDiscountTotal);
  if (lineNets.length === 0) return [];
  if (subtotal === 0 || total === 0) return lineNets.map(() => 0);

  const allocations = lineNets.map((net) => (net === 0 ? 0 : roundMoney((total * net) / subtotal)));

  const allocatedSum = allocations.reduce((sum, a) => sum + a, 0);
  const diff = roundMoney(total - allocatedSum);
  if (diff !== 0) {
    for (let i = allocations.length - 1; i >= 0; i--) {
      if (lineNets[i] !== 0) {
        allocations[i] = roundMoney((allocations[i] ?? 0) + diff);
        break;
      }
    }
  }
  return allocations;
}
