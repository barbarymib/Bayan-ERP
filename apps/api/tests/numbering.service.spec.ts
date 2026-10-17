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

  it('بلا تفعيل الفترة يكمل من الكتلة الحالية (السلوك الافتراضي)', async () => {
    const prisma = {
      systemSetting: { findUnique: async () => null },
      numberBlock: {
        findFirst: async () => ({
          id: 1,
          prefix: 'BP',
          ownerCode: 'M03',
          period: 0,
          fromNo: 1,
          toNo: 100,
          lastUsed: 5,
        }),
        updateMany: async () => ({ count: 1 }),
        create: async () => {
          throw new Error('should not create a new block');
        },
      },
    } as unknown as PrismaService;
    await expect(new NumberingService(prisma).issue('BP', 'M03', 1)).resolves.toBe('BP-M03-000006');
  });

  it('تفعيل نمط السنة يضيف مقطع السنة ويعيد ضبط التسلسل لكل فترة (§5.11.8)', async () => {
    const year = new Date().getFullYear();
    let created: Record<string, unknown> | null = null;
    const prisma = {
      systemSetting: { findUnique: async () => ({ key: 'numbering.period.mode', value: 'YEAR' }) },
      numberBlock: {
        findFirst: async () => created,
        create: async (args: { data: Record<string, unknown> }) => {
          created = { id: 9, ...args.data };
          return created;
        },
        updateMany: async () => ({ count: 1 }),
      },
    } as unknown as PrismaService;
    await expect(new NumberingService(prisma).issue('BP', 'M03', 1)).resolves.toBe(
      `BP-M03-${year}-000001`,
    );
    expect(created).toMatchObject({
      prefix: 'BP',
      ownerCode: 'M03',
      period: year,
      fromNo: 1,
      toNo: 100,
      lastUsed: 0,
    });
  });
});
