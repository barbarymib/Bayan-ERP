import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DOC_PREFIXES,
  formatDocNumber,
  type DocPrefix,
} from '@bayan/shared';
import { PrismaService } from './prisma/prisma.module.js';
import { tenantWhere } from './common/tenant.js';

/** حجم كتلة الأرقام المحجوزة لكل مالك (مندوب/مكتب). */
const BLOCK_SIZE = 100;

@Injectable()
export class NumberingService {
  constructor(private readonly prisma: PrismaService) {}

  /** توليد رقم مستند بصيغة {بادئة}-{كود المندوب}-{تسلسل}. */
  format(prefix: DocPrefix, ownerCode: string, sequence: number): string {
    return formatDocNumber(prefix, ownerCode, sequence);
  }

  label(prefix: DocPrefix): string {
    return DOC_PREFIXES[prefix];
  }

  /** إصدار رقم تسلسلي فريد من كتل الأرقام (آمن ضد التزاحم). */
  async issue(prefix: DocPrefix, ownerCode: string, companyId: number | null = null): Promise<string> {
    const sequence = await this.reserveSequence(prefix, ownerCode, companyId);
    return formatDocNumber(prefix, ownerCode, sequence);
  }

  private async reserveSequence(prefix: DocPrefix, ownerCode: string, companyId: number | null): Promise<number> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const block = await this.prisma.numberBlock.findFirst({
        where: { prefix, ownerCode, ...tenantWhere(companyId) },
        orderBy: { toNo: 'desc' },
      });

      if (block && block.lastUsed < block.toNo) {
        const seq = block.lastUsed + 1;
        // updateMany بشرط lastUsed يمنع أخذ نفس الرقم مرتين عند التزاحم
        const updated = await this.prisma.numberBlock.updateMany({
          where: { id: block.id, lastUsed: block.lastUsed },
          data: { lastUsed: seq },
        });
        if (updated.count === 1) return seq;
        continue;
      }

      const from = (block?.toNo ?? 0) + 1;
      await this.prisma.numberBlock
        .create({
          data: { prefix, ownerCode, fromNo: from, toNo: from + BLOCK_SIZE - 1, lastUsed: from - 1, ...tenantWhere(companyId) },
        })
        .catch(() => undefined); // تعارض كتلة متزامنة — نعيد المحاولة
    }
    throw new BadRequestException(`Number block busy for ${prefix}-${ownerCode}`);
  }
}