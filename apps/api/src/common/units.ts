import { BadRequestException } from '@nestjs/common';
import { allowsDecimalByMeasurement, assertQtyAllowed, formatCompositeQty, type UnitDef } from '@bayan/shared';

export { allowsDecimalByMeasurement };

/**
 * يتحقق أن كمية بند مقبولة بحسب وحدة القياس (§5.2) ويرمي 400 عند المخالفة.
 */
export function assertLineQtyAllowed(qty: number, allowDecimal: boolean, unitName: string): void {
  try {
    assertQtyAllowed(qty, allowDecimal, unitName);
  } catch (e) {
    throw new BadRequestException((e as Error).message);
  }
}

/** شكل الصنف المطلوب لبناء وحداته (اختياري ليبقى مرونة الاختبارات). */
export interface ItemUnitsLike {
  baseUnitId: number;
  baseUnit?: { id: number; nameAr: string; measurement: string } | null;
  itemUnits?: {
    unitId: number;
    factorToBase: unknown;
    allowDecimal: boolean;
    unit: { id: number; nameAr: string };
  }[];
}

/**
 * وحدات الصنف للعرض المركب (§5.2): الوحدة الأساسية أولاً بمعامل 1
 * (لاحقة لبيانات itemUnits الناقصة) ثم وحداته البديلة المعرّفة.
 */
export function itemUnitDefs(item: ItemUnitsLike | null | undefined): UnitDef[] | null {
  if (!item?.baseUnit) return null;
  const defs: UnitDef[] = [
    {
      id: String(item.baseUnit.id),
      name: item.baseUnit.nameAr,
      factorToBase: 1,
      allowDecimal: allowsDecimalByMeasurement(item.baseUnit.measurement),
    },
  ];
  const seen = new Set<number>([item.baseUnitId]);
  for (const iu of item.itemUnits ?? []) {
    if (seen.has(iu.unitId)) continue;
    const factor = Number(iu.factorToBase);
    if (!Number.isFinite(factor) || factor <= 0) continue;
    seen.add(iu.unitId);
    defs.push({ id: String(iu.unitId), name: iu.unit.nameAr, factorToBase: factor, allowDecimal: iu.allowDecimal });
  }
  return defs;
}

/**
 * العرض المركب لرصيد صنف: "5 كرتونة + 2 عبوة" — يرجع null عند
 * غياب بيانات الوحدات أو الكمية السالبة (decomposeQty يرفض السالب).
 */
export function compositeQty(qtyBase: number, item: ItemUnitsLike | null | undefined): string | null {
  const units = itemUnitDefs(item);
  if (!units || qtyBase < 0) return null;
  try {
    return formatCompositeQty(qtyBase, units);
  } catch {
    return null;
  }
}
