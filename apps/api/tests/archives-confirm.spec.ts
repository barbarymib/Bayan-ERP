import { describe, expect, it } from 'vitest';
import { ArchivesService } from '../src/archives/archives.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';

function makeService(opts: { run?: Record<string, unknown> | null; bundleExists?: boolean }) {
  const prisma = {
    archiveRun: {
      findUnique: async () => ('run' in opts ? opts.run : null),
    },
  } as unknown as PrismaService;
  const storage = {
    exists: async () => opts.bundleExists ?? true,
    basename: (p: string) => p,
  };
  const service = new ArchivesService(prisma, storage as never, {} as never);
  return { service };
}

const READY = {
  id: 1,
  code: 'BP-000001',
  status: 'READY',
  fromDate: new Date('2026-01-01'),
  toDate: new Date('2026-06-30'),
  bundlePath: 'archives/BP-000001.zip',
  bundleSha256: 'abc',
  manifest: { counts: {} },
  counts: {},
};

describe('ArchivesService.confirm — إقرار حفظ الحزمة (§5.11.5-6)', () => {
  it('يرفض الحذف بدون إقرار حفظ الحزمة', async () => {
    const { service } = makeService({ run: READY });
    await expect(service.confirm(1, 'أرشفة', false, 9)).rejects.toThrow(/أقرّ أولًا/);
  });

  it('يرفض الحذف إذا كانت كلمة التأكيد غير مطابقة', async () => {
    const { service } = makeService({ run: READY });
    await expect(service.confirm(1, 'حذف', true, 9)).rejects.toThrow(/كلمة التأكيد/);
  });

  it('يرفض الحذف إذا لم تعد الحزمة موجودة في المخزن', async () => {
    const { service } = makeService({ run: READY, bundleExists: false });
    await expect(service.confirm(1, 'أرشفة', true, 9)).rejects.toThrow(/غير موجودة في المخزن/);
  });

  it('يرفض الحذف إذا كان مسار الحزمة مفقودًا', async () => {
    const { service } = makeService({ run: { ...READY, bundlePath: null } });
    await expect(service.confirm(1, 'أرشفة', true, 9)).rejects.toThrow(/غير موجودة في المخزن/);
  });

  it('يرفض التأكيد لحزمة غير جاهزة', async () => {
    const { service } = makeService({ run: { ...READY, status: 'CONFIRMED' } });
    await expect(service.confirm(1, 'أرشفة', true, 9)).rejects.toThrow(/التأكيد متاح فقط/);
  });

  it('يرمي NotFound لحزمة غير موجودة', async () => {
    const { service } = makeService({ run: null });
    await expect(service.confirm(1, 'أرشفة', true, 9)).rejects.toThrow(/عملية الترحيل/);
  });
});
