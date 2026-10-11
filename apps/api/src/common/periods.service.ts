import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from './tenant.js';

@Injectable()
export class PeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  /** الفترة الحالية المفتوحة (ADR-1) — null إن لم توجد. */
  async open(companyId: number | null = null) {
    return this.prisma.period.findFirst({ where: { status: 'OPEN', ...tenantWhere(companyId) }, orderBy: { id: 'desc' } });
  }
}