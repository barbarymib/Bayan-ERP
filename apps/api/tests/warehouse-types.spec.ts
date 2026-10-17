import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MigrationWarehouseDto } from '../src/migration/migration.dto.js';

describe('MigrationWarehouseDto (§5.7 أنواع المخازن)', () => {
  it('يقبل الأنواع الرئيسية والحديد والبويات', async () => {
    for (const type of ['MAIN', 'STEEL', 'PAINT', 'REP', 'DAMAGED', 'SHOWROOM']) {
      const dto = plainToInstance(MigrationWarehouseDto, { code: 'WH1', nameAr: 'مخزن', type });
      const errors = await validate(dto);
      expect(errors, `type=${type}`).toHaveLength(0);
    }
  });

  it('يرفض نوع مخزن غير معروف', async () => {
    const dto = plainToInstance(MigrationWarehouseDto, { code: 'WH1', nameAr: 'مخزن', type: 'TRANSIT' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.property).toBe('type');
  });
});
