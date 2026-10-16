import { BadRequestException } from '@nestjs/common';
import { allowsDecimalByMeasurement, assertQtyAllowed } from '@bayan/shared';

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
