import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import type { QueryAuditLogsDto } from './audit-logs.dto.js';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryAuditLogsDto) {
    const where = {
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.from || query.to
        ? {
            at: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, repCode: true } } },
        orderBy: { at: 'desc' },
        take: Math.min(query.limit ?? 50, 200),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { total, items: items.map((r) => ({ ...r, beforeJson: r.beforeJson ?? undefined, afterJson: r.afterJson ?? undefined })) };
  }

  /** تسجيل عملية حساسة في سجل التدقيق (§9) */
  async write(input: {
    userId?: number;
    action: string;
    entity: string;
    entityId: number;
    beforeJson?: unknown;
    afterJson?: unknown;
  }) {
    await this.prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        beforeJson: (input.beforeJson as object) ?? undefined,
        afterJson: (input.afterJson as object) ?? undefined,
      },
    });
  }
}