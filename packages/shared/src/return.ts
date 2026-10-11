import { roundMoney, roundQty } from './money.js';

/**
 * قاعدة المرتجع الجوهرية (§5.9 / §7.4): البند المُرجَع يُقيَّم بصافي البيان الأصلي
 * (بعد خصم البند ونصيبه من خصم البيان) — لا بسعر اليوم.
 *
 * السعر الأساسي لكل وحدة بيع = صافي البند ÷ الكمية المباعة.
 * يُحتفظ به دقيقاً (يُقرَّب عند العرض فقط)؛
 * قيمة المرتجع = الكمية المرتجعة × السعر الأساسي ويُقرَّب عليها مرة واحدة.
 * بهذا يبقى المرتجع الكامل مطابقاً لصافي البند حرفياً ولا يتجمع خطأ التقريب على الوحدات.
 */
export function calcReturnUnitNetPrice(lineNetFinal: number, originalQty: number): number {
  if (originalQty <= 0) throw new Error('originalQty must be positive');
  return lineNetFinal / originalQty;
}

export function calcReturnLineValue(
  lineNetFinal: number,
  originalQty: number,
  returnQty: number,
): number {
  if (returnQty <= 0) throw new Error('returnQty must be positive');
  if (originalQty <= 0) throw new Error('originalQty must be positive');
  if (returnQty > originalQty) {
    throw new Error('returnQty cannot exceed originalQty');
  }
  return roundMoney((lineNetFinal * returnQty) / originalQty);
}

export interface ReturnValidationInput {
  originalQty: number;
  alreadyReturnedQty: number;
  requestedQty: number;
}

/**
 * لا يمكن إرجاع أكثر من (الكمية المباعة − ما سبق إرجاعه).
 */
export function validateReturnQty(input: ReturnValidationInput): void {
  const remaining = roundQty(input.originalQty - input.alreadyReturnedQty);
  if (input.requestedQty <= 0) {
    throw new Error('requestedQty must be positive');
  }
  if (roundQty(input.requestedQty) > remaining) {
    throw new Error(`Return qty ${input.requestedQty} exceeds returnable qty ${remaining}`);
  }
}