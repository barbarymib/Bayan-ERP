export const DECIMAL_PLACES = 2;
export const QTY_DECIMAL_PLACES = 3;

/** النطاق الآمن للتحويل النصي-الأُسّي (أقل من 10^15). */
const SAFE_MAGNITUDE = 1e15;

function roundTo(value: number, places: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Non-finite numeric value: ${value}`);
  }
  if (Math.abs(value) >= SAFE_MAGNITUDE) {
    throw new Error(`Value ${value} exceeds safe rounding magnitude`);
  }
  // تحويل نصي بأُسّ يتجنب أخطاء الفاصلة العائمة في (x * 10^places)
  const shifted = Number(`${value}e+${places}`);
  const sign = shifted < 0 ? -1 : 1;
  const rounded = sign * Math.round(Math.abs(shifted));
  return Number(`${rounded}e-${places}`);
}

/**
 * تدوير مالي إلى خانتين عشريتين (half-up بعيداً عن الصفر).
 * مثال: 7437.625 → 7437.63 (الطريقة x*100 تُرجع 7437.62 خطأً).
 */
export function roundMoney(value: number): number {
  return roundTo(value, DECIMAL_PLACES);
}

/** تدوير كمية إلى 3 خانات عشرية (الكميات الوزنية). */
export function roundQty(value: number): number {
  return roundTo(value, QTY_DECIMAL_PLACES);
}

export function isZero(value: number, epsilon = 1e-9): boolean {
  return Math.abs(value) < epsilon;
}
