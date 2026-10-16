/**
 * §4.2: حدود الخصم تُضبط لكل دور ولكل مستخدم.
 * القاعدة: حدُّ الدور يتقدّم؛ وعند غيابه يُستخدم حدُّ المستخدم (fallback).
 */
export function effectiveDiscountLimit(roleLimit: unknown, userLimit: unknown): number {
  if (roleLimit !== null && roleLimit !== undefined) return Number(roleLimit);
  return Number(userLimit ?? 0);
}
