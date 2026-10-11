import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { QuotationsService } from '../src/quotations/quotations.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { NumberingService } from '../src/numbering.service.js';
import type { PeriodsService } from '../src/common/periods.service.js';
import type { PriceResolverService } from '../src/common/price-resolver.service.js';
import type { PriceStatementsService } from '../src/price-statements/price-statements.service.js';
import type { AuditLogsService } from '../src/audit-logs/audit-logs.service.js';
import type { AuthUser } from '../src/auth/auth.decorators.js';

type AuditCall = { action: string; entity: string; entityId: number };
const noopAudits = { write: async () => {} } as unknown as AuditLogsService;

const user: AuthUser = { id: 1, name: 'مدير', roles: ['ADMIN'], permissions: [] } as unknown as AuthUser;

function baseQuotation() {
  return {
    id: 9,
    status: 'ACCEPTED',
    customerId: 1,
    warehouseId: 1,
    validUntil: null,
    date: new Date('2026-10-01'),
    discountType: null,
    discountValue: null,
    shipping: 0,
    taxPercent: 14,
    notes: 'عرض',
    lines: [
      {
        item: { code: 'IR-16-10' },
        unit: { code: 'PCS' },
        qty: 5,
        unitPrice: 100,
        lineDiscountType: null,
        lineDiscountValue: null,
      },
    ],
  };
}

type Harness = {
  service: QuotationsService;
  updates: { data: Record<string, unknown> }[];
  statementDtos: unknown[];
  state: { status: string };
  audits: AuditCall[];
};

function harness(overrides: { status?: string; id?: number } = {}): Harness {
  const state = { status: overrides.status ?? 'ACCEPTED' };
  const updates: { data: Record<string, unknown> }[] = [];
  const statementDtos: unknown[] = [];
  const audits: AuditCall[] = [];

  const prisma = {
    quotation: {
      findUnique: async (args: { where: { id: number }; select?: unknown; include?: unknown }) => {
        if (args.where.id === 404) return null;
        if (args.select) return { status: state.status };
        return { ...baseQuotation(), status: state.status };
      },
      update: async (args: { data: Record<string, unknown> }) => {
        updates.push(args);
        state.status = String(args.data.status);
        return { ...baseQuotation(), status: state.status };
      },
    },
  } as unknown as PrismaService;

  const priceStatements = {
    create: async (dto: unknown) => {
      statementDtos.push(dto);
      return { id: 42, number: 'BP-000042' };
    },
  } as unknown as PriceStatementsService;

  const auditsSvc = {
    write: async (input: AuditCall) => {
      audits.push({ action: input.action, entity: input.entity, entityId: input.entityId });
    },
  } as unknown as AuditLogsService;

  const service = new QuotationsService(
    prisma,
    { issue: async () => 'QT-000007' } as unknown as NumberingService,
    { open: async () => null } as unknown as PeriodsService,
    { resolve: async () => 100 } as unknown as PriceResolverService,
    priceStatements,
    auditsSvc,
  );

  return { service, updates, statementDtos, state, audits };
}

describe('QuotationsService', () => {
  it('يحسب effectiveStatus EXPIRED لعرض منتهي دون تغيير التخزين', async () => {
    const past = new Date('2020-01-01');
    const prisma = {
      quotation: {
        findUnique: async () => ({ ...baseQuotation(), status: 'SENT', validUntil: past }),
      },
    } as unknown as PrismaService;
    const svc = new QuotationsService(
      prisma,
      { issue: async () => 'QT-1' } as unknown as NumberingService,
      { open: async () => null } as unknown as PeriodsService,
      { resolve: async () => 1 } as unknown as PriceResolverService,
      { create: async () => ({}) } as unknown as PriceStatementsService,
      noopAudits,
    );
    const row = await svc.get(9);
    expect(row.effectiveStatus).toBe('EXPIRED');
    expect(row.status).toBe('SENT');
  });

  it('يرفض نقل عرض بين حالتين غير مسموحتين', async () => {
    const { service } = harness({ status: 'ACCEPTED' });
    await expect(service.send(9)).rejects.toThrow(BadRequestException);
  });

  it('يرفض إرسال عرض غير موجود', async () => {
    const { service } = harness();
    await expect(service.send(404)).rejects.toThrow(NotFoundException);
  });

  it('يحوّل عرض السعر إلى بيان أسعار ويربطه به', async () => {
    const { service, updates, statementDtos, audits } = harness({ status: 'ACCEPTED' });
    const result = await service.convert(9, user);

    expect(result.statement.id).toBe(42);
    expect(result.quotation.effectiveStatus).toBe('CONVERTED');

    const dto = statementDtos[0] as {
      customerId: number;
      warehouseId: number;
      taxPercent: number;
      lines: { itemCode: string; unitCode: string; qty: number; unitPrice: number }[];
    };
    expect(dto.customerId).toBe(1);
    expect(dto.warehouseId).toBe(1);
    expect(dto.taxPercent).toBe(14);
    expect(dto.lines).toHaveLength(1);
    expect(dto.lines[0]).toMatchObject({
      itemCode: 'IR-16-10',
      unitCode: 'PCS',
      qty: 5,
      unitPrice: 100,
    });

    const convUpdate = updates.find((u) => u.data.status === 'CONVERTED');
    expect(convUpdate).toBeDefined();
    expect(convUpdate?.data.convertedStatementId).toBe(42);

    expect(audits).toContainEqual({ action: 'quotation.convert', entity: 'Quotation', entityId: 9 });
  });

  it('يسجّل تدقيقاً عند رفض العرض', async () => {
    const { service, audits } = harness({ status: 'SENT' });
    await service.reject(9, { note: 'غير مناسب' });

    expect(audits).toContainEqual({ action: 'quotation.reject', entity: 'Quotation', entityId: 9 });
  });

  it('يرفض التحويل المزدوج', async () => {
    const { service } = harness({ status: 'CONVERTED' });
    await expect(service.convert(9, user)).rejects.toThrow('already converted');
  });

  it('يرفض تحويل عرض مرفوض', async () => {
    const { service } = harness({ status: 'REJECTED' });
    await expect(service.convert(9, user)).rejects.toThrow('Rejected quotations');
  });

  it('يرفض تحويل عرض غير موجود', async () => {
    const { service } = harness();
    await expect(service.convert(404, user)).rejects.toThrow(NotFoundException);
  });
});
