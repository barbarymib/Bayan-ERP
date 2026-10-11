import { roundQty } from './money.js';

/** مساحة × عدد الوجهات ÷ التغطية (لتر/م²). */
export interface PaintAreaInput {
  areaM2: number;
  coats: number;
  coverageM2PerLiter: number;
}

export interface PaintPackInput extends PaintAreaInput {
  /** حجم العبوة باللتر. */
  packSizeL: number;
}

export interface PaintResult {
  liters: number;
  packs: number;
  totalLiters: number;
}

function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
}

/** كمية الدهان المطلوبة (لتر). */
export function paintLiters(input: PaintAreaInput): number {
  assertPositive(input.areaM2, 'areaM2');
  assertPositive(input.coats, 'coats');
  assertPositive(input.coverageM2PerLiter, 'coverageM2PerLiter');
  return roundQty((input.areaM2 * input.coats) / input.coverageM2PerLiter);
}

/** عدد العبوات (يُقرَّب لأعلى). */
export function paintPacks(input: PaintPackInput): number {
  assertPositive(input.packSizeL, 'packSizeL');
  const liters = paintLiters(input);
  return Math.ceil(liters / input.packSizeL);
}

/** النتيجة الكاملة: اللترات + العبوات + إجمالي ما سيُشترى. */
export function calcPaint(input: PaintPackInput): PaintResult {
  const liters = paintLiters(input);
  const packs = paintPacks(input);
  return { liters, packs, totalLiters: roundQty(packs * input.packSizeL) };
}