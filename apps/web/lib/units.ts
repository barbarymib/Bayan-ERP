import type { Item } from './api';

/** §5.2 — نوع القياس: عددي (COUNT) يقبل أعداداً صحيحة فقط، وزني (WEIGHT) يقبل كسوراً. */
export function allowsDecimalByMeasurement(measurement: string | null | undefined): boolean {
  return measurement !== 'COUNT';
}

/**
 * هل تقبل الوحدة المختارة للصنف كسوراً؟
 * الوحدة الأساسية تُحدَّد بنوع القياس، والوحدة البديلة بـ allowDecimal
 * (تكون غير معروفة إن لم تتضمّن قائمة الأصناف الوحدات البديلة → نسمح بها).
 */
export function lineAllowsDecimal(item: Pick<Item, 'baseUnit' | 'itemUnits'>, unitCode?: string): boolean {
  if (!unitCode || unitCode === item.baseUnit.code) {
    return allowsDecimalByMeasurement(item.baseUnit.measurement);
  }
  const iu = item.itemUnits?.find((u) => u.unit.code === unitCode);
  return iu ? iu.allowDecimal : true;
}

/** هل الكمية مقبولة للوحدة المختارة (§5.2)؟ */
export function isLineQtyAllowed(
  item: Pick<Item, 'baseUnit' | 'itemUnits'>,
  unitCode: string | undefined,
  qty: number,
): boolean {
  return lineAllowsDecimal(item, unitCode) || Number.isInteger(qty);
}
