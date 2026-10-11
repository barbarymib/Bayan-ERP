import { describe, expect, it } from 'vitest';
import { compare } from 'bcryptjs';
import type { JwtService } from '@nestjs/jwt';
import { AdminService } from '../src/admin/admin.service.js';
import type { AuditLogsService } from '../src/audit-logs/audit-logs.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';

interface Captured {
  companyCreate: { data: Record<string, unknown> }[];
  userCreate: { data: Record<string, unknown> }[];
}

interface Options {
  existingCompany?: unknown;
  ownerRole?: { id: number } | null;
  duplicateUser?: unknown;
}

function makePrisma(opts: Options = {}): { prisma: PrismaService; captured: Captured } {
  const captured: Captured = { companyCreate: [], userCreate: [] };
  const prisma = {
    company: {
      findUnique: async () => opts.existingCompany ?? null,
      create: async (args: { data: Record<string, unknown> }) => {
        captured.companyCreate.push(args);
        return { id: 7, status: 'ACTIVE', ...args.data };
      },
    },
    role: {
      findUnique: async () => ('ownerRole' in opts ? opts.ownerRole : { id: 3 }),
    },
    user: {
      findFirst: async () => opts.duplicateUser ?? null,
      create: async (args: { data: Record<string, unknown> }) => {
        captured.userCreate.push(args);
        return { id: 21, repCode: null, role: { code: 'OWNER' }, ...args.data };
      },
    },
  } as unknown as PrismaService;
  return { prisma, captured };
}

function makeService(prisma: PrismaService): AdminService {
  return new AdminService(prisma, {} as unknown as JwtService, { write: async () => {} } as unknown as AuditLogsService);
}

describe('AdminService.createCompany', () => {
  it('ينشئ شركة بدون مالك ويطبّع الكود', async () => {
    const { prisma, captured } = makePrisma();
    const res = await makeService(prisma).createCompany({ code: '  Acme ', nameAr: 'شركة أكيم' });
    expect(res.owner).toBeNull();
    expect(res.company.code).toBe('acme');
    expect(captured.companyCreate).toHaveLength(1);
    expect(captured.userCreate).toHaveLength(0);
  });

  it('يرفض كود شركة مكرراً', async () => {
    const { prisma, captured } = makePrisma({ existingCompany: { id: 1 } });
    await expect(makeService(prisma).createCompany({ code: 'acme', nameAr: 'x' })).rejects.toThrow(
      'already exists',
    );
    expect(captured.companyCreate).toHaveLength(0);
  });

  it('ينشئ المالك بدور OWNER وكلمة مرور مُشفّرة مرتبطة بالشركة', async () => {
    const { prisma, captured } = makePrisma();
    const res = await makeService(prisma).createCompany({
      code: 'acme',
      nameAr: 'شركة أكيم',
      owner: { name: 'مالك', email: 'Owner@Acme.Local', password: 'secret123' },
    });
    expect(res.owner?.roleCode).toBe('OWNER');
    expect(captured.userCreate).toHaveLength(1);
    const data = captured.userCreate[0]!.data;
    expect(data.companyId).toBe(7);
    expect(data.roleId).toBe(3);
    expect(data.email).toBe('owner@acme.local');
    const stored = String(data.passwordHash);
    expect(stored).not.toBe('secret123');
    expect(await compare('secret123', stored)).toBe(true);
  });

  it('يرفض مالكاً بلا بريد أو هاتف دون إنشاء الشركة', async () => {
    const { prisma, captured } = makePrisma();
    await expect(
      makeService(prisma).createCompany({
        code: 'acme',
        nameAr: 'شركة أكيم',
        owner: { name: 'مالك', password: 'secret123' },
      }),
    ).rejects.toThrow('email or phone');
    expect(captured.companyCreate).toHaveLength(0);
  });

  it('يرفض مالكاً ببريد مستخدم حالياً', async () => {
    const { prisma, captured } = makePrisma({ duplicateUser: { id: 5 } });
    await expect(
      makeService(prisma).createCompany({
        code: 'acme',
        nameAr: 'شركة أكيم',
        owner: { name: 'مالك', email: 'taken@acme.local', password: 'secret123' },
      }),
    ).rejects.toThrow('already uses');
    expect(captured.companyCreate).toHaveLength(0);
  });
});
