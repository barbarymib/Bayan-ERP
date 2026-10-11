import { describe, expect, it } from 'vitest';
import { SettingsService } from '../src/settings/settings.service.js';
import type { AuditLogsService } from '../src/audit-logs/audit-logs.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';

const audits = { write: async () => {} } as unknown as AuditLogsService;

interface Captured {
  upsert: { where: Record<string, unknown>; update: Record<string, unknown>; create: Record<string, unknown> }[];
  delete: { where: { key: string } }[];
}

interface Options {
  existing?: unknown;
}

function makePrisma(opts: Options = {}): { prisma: PrismaService; captured: Captured } {
  const captured: Captured = { upsert: [], delete: [] };
  const prisma = {
    systemSetting: {
      findMany: async () => [{ key: 'a', value: '1', updatedAt: new Date() }],
      count: async () => 1,
      findUnique: async () => ('existing' in opts ? opts.existing : { key: 'a', value: '1' }),
      upsert: async (args: Captured['upsert'][number]) => {
        captured.upsert.push(args);
        return { key: args.where.key, value: args.update.value };
      },
      delete: async (args: { where: { key: string } }) => {
        captured.delete.push(args);
        return { key: args.where.key };
      },
    },
  } as unknown as PrismaService;
  return { prisma, captured };
}

describe('SettingsService', () => {
  it('يسرد الإعدادات', async () => {
    const { prisma } = makePrisma();
    const res = await new SettingsService(prisma, audits).list();
    expect(res.total).toBe(1);
    expect(res.settings[0]!.key).toBe('a');
  });

  it('ينشئ/يحدّث إعداداً', async () => {
    const { prisma, captured } = makePrisma();
    const res = await new SettingsService(prisma, audits).upsert('stock.sale.enforce', 'BLOCK');
    expect(res).toEqual({ key: 'stock.sale.enforce', value: 'BLOCK' });
    expect(captured.upsert).toHaveLength(1);
    expect(captured.upsert[0]!.create).toEqual({ key: 'stock.sale.enforce', value: 'BLOCK' });
  });

  it('يرفض مفتاحاً فارغاً', async () => {
    const { prisma } = makePrisma();
    await expect(new SettingsService(prisma, audits).upsert('  ', 'x')).rejects.toThrow('required');
  });

  it('يعيد إعداداً موجوداً', async () => {
    const { prisma } = makePrisma();
    const res = await new SettingsService(prisma, audits).get('a');
    expect(res.key).toBe('a');
  });

  it('يرمي NotFound لإعداد غير موجود', async () => {
    const { prisma } = makePrisma({ existing: null });
    await expect(new SettingsService(prisma, audits).get('missing')).rejects.toThrow('not found');
  });

  it('يحذف إعداداً موجوداً', async () => {
    const { prisma, captured } = makePrisma();
    const res = await new SettingsService(prisma, audits).remove('a');
    expect(res).toEqual({ ok: true });
    expect(captured.delete).toHaveLength(1);
  });

  it('يرفض حذف إعداد غير موجود', async () => {
    const { prisma, captured } = makePrisma({ existing: null });
    await expect(new SettingsService(prisma, audits).remove('missing')).rejects.toThrow('not found');
    expect(captured.delete).toHaveLength(0);
  });
});

describe('SettingsService audit', () => {
  function recording(): { svc: AuditLogsService; calls: { action: string }[] } {
    const calls: { action: string }[] = [];
    const svc = {
      write: async (input: { action: string }) => {
        calls.push({ action: input.action });
      },
    } as unknown as AuditLogsService;
    return { svc, calls };
  }

  function prisma(existing: unknown): PrismaService {
    return {
      systemSetting: {
        findUnique: async () => existing,
        upsert: async (args: { where: { key: string }; update: { value: string } }) => ({
          key: args.where.key,
          value: args.update.value,
        }),
        delete: async (args: { where: { key: string } }) => ({ key: args.where.key }),
      },
    } as unknown as PrismaService;
  }

  it('يسجّل setting.create لإعداد جديد', async () => {
    const { svc, calls } = recording();
    await new SettingsService(prisma(null), svc).upsert('k', 'v');
    expect(calls[0]!.action).toBe('setting.create');
  });

  it('يسجّل setting.update لإعداد موجود', async () => {
    const { svc, calls } = recording();
    await new SettingsService(prisma({ key: 'k', value: '1' }), svc).upsert('k', 'v');
    expect(calls[0]!.action).toBe('setting.update');
  });

  it('يسجّل setting.delete عند الحذف', async () => {
    const { svc, calls } = recording();
    await new SettingsService(prisma({ key: 'k', value: '1' }), svc).remove('k');
    expect(calls[0]!.action).toBe('setting.delete');
  });
});
