import { describe, expect, it } from 'vitest';
import { NumberingService } from '../src/numbering.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';

describe('NumberingService', () => {
  const service = new NumberingService({} as unknown as PrismaService);

  it('ي_format رقم مندوب بالصيغة الصحيحة', () => {
    expect(service.format('BP', 'M03', 127)).toBe('BP-M03-000127');
  });

  it('يُرجع تسمية النوع بالعربية', () => {
    expect(service.label('RT')).toBe('بيان مرتجع');
  });
});