import { roundQty } from './money.js';

export interface UnitDef {
  id: string;
  name: string;
  /** معامل التحويل إلى الوحدة الأساسية */
  factorToBase: number;
  /** هل تقبل كسوراً (وزني) أم أعداداً صحيحة فقط (عددي) */
  allowDecimal: boolean;
}

export function toBaseQty(qty: number, unit: UnitDef): number {
  if (qty < 0) throw new Error('qty cannot be negative');
  if (!unit.allowDecimal && !Number.isInteger(qty)) {
    throw new Error(`Unit ${unit.name} does not accept fractional quantities`);
  }
  return roundQty(qty * unit.factorToBase);
}

/** نوع القياس: عددي (COUNT) يقبل أعداداً صحيحة فقط، وزني (WEIGHT) يقبل كسوراً (§5.2). */
export function allowsDecimalByMeasurement(measurement: string): boolean {
  return measurement !== 'COUNT';
}

/**
 * يتحقق أن الكمية مقبولة بحسب نوع قياس الوحدة (§5.2).
 * يرمي خطأً إذا كانت الوحدة عددية والكمية كسرية.
 */
export function assertQtyAllowed(qty: number, allowDecimal: boolean, unitName: string): void {
  if (!Number.isFinite(qty)) throw new Error('qty must be a finite number');
  if (!allowDecimal && !Number.isInteger(qty)) {
    throw new Error(`Unit ${unitName} is integer-only (COUNT) and does not accept fractional quantities`);
  }
}

export function fromBaseQty(qtyBase: number, unit: UnitDef): number {
  if (qtyBase < 0) throw new Error('qtyBase cannot be negative');
  if (unit.factorToBase <= 0) throw new Error('factorToBase must be positive');
  const converted = roundQty(qtyBase / unit.factorToBase);
  if (!unit.allowDecimal && !Number.isInteger(converted)) {
    throw new Error(`Quantity ${qtyBase} cannot be expressed as whole units of ${unit.name}`);
  }
  return converted;
}

/** تحويل بين وحدتين (بترتيب الوحدات: من → إلى). */
export function convertQty(qty: number, from: UnitDef, to: UnitDef): number {
  return fromBaseQty(toBaseQty(qty, from), to);
}

export interface UnitQty {
  unit: UnitDef;
  qty: number;
}

/**
 * عرض مركب للرصيد: مثال — 22 عبوة مع كرتونة = 4 عبوات →
 * `[{كرتونة,5},{عبوة,2}]` أي "5 كرتونة + 2 عبوة".
 *
 * خوارزمية جشعة على الوحدات من الأكبر للأصغر. (تُستخدم وحدات
 * ت divisibility منطقية مثل 1000/100/1).
 */
export function decomposeQty(qtyBase: number, units: readonly UnitDef[]): UnitQty[] {
  if (qtyBase < 0) throw new Error('qtyBase cannot be negative');
  const sorted = [...units].sort((a, b) => b.factorToBase - a.factorToBase);
  let remaining = roundQty(qtyBase);
  const result: UnitQty[] = [];
  for (const unit of sorted) {
    if (unit.factorToBase <= 0) continue;
    const count = Math.floor(remaining / unit.factorToBase);
    if (count > 0) {
      result.push({ unit, qty: count });
      remaining = roundQty(remaining - count * unit.factorToBase);
    }
  }
  if (remaining > 0) {
    const base = sorted.find((u) => u.factorToBase === 1) ?? sorted[sorted.length - 1];
    if (base) {
      const last = result[result.length - 1];
      if (last && last.unit.id === base.id) {
        last.qty = roundQty(last.qty + remaining);
      } else {
        result.push({ unit: base, qty: remaining });
      }
    }
  }
  return result.filter((r) => r.qty > 0);
}
