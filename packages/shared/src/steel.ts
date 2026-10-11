import { roundQty } from './money.js';

/** كثافة الحديد الصلب (كجم/م³). */
export const STEEL_DENSITY_KG_M3 = 7850;

export interface SteelBarInput {
  /** قطر السيخ بالمليمتر. */
  diameterMm: number;
  /** طول السيخ بالمتر. */
  lengthM: number;
}

export interface SteelWeightInput extends SteelBarInput {
  /** عدد الأسياخ. */
  count: number;
}

function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
}

/** وزن سيخ واحد (كجم) = مساحة المقطع × الطول × كثافة الحديد. */
export function steelBarWeightKg(input: SteelBarInput): number {
  assertPositive(input.diameterMm, 'diameterMm');
  assertPositive(input.lengthM, 'lengthM');
  const diameterM = input.diameterMm / 1000;
  const areaM2 = (Math.PI * diameterM * diameterM) / 4;
  return roundQty(areaM2 * input.lengthM * STEEL_DENSITY_KG_M3);
}

/** الوزن النظري لعدد من الأسياخ (كجم). */
export function steelWeightKg(input: SteelWeightInput): number {
  assertPositive(input.diameterMm, 'diameterMm');
  assertPositive(input.lengthM, 'lengthM');
  assertPositive(input.count, 'count');
  const perBar = areaM2Of(input.diameterMm) * input.lengthM * STEEL_DENSITY_KG_M3;
  return roundQty(perBar * input.count);
}

/** وزن المتر الطولي لسيخ بقطر معيّن (كجم/م). */
export function steelWeightPerMeterKg(diameterMm: number): number {
  assertPositive(diameterMm, 'diameterMm');
  return roundQty(areaM2Of(diameterMm) * STEEL_DENSITY_KG_M3);
}

function areaM2Of(diameterMm: number): number {
  const diameterM = diameterMm / 1000;
  return (Math.PI * diameterM * diameterM) / 4;
}