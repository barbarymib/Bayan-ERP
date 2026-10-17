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

/**
 * مفتاح إعداد نمط الفترة في الترقيم (§5.11.8).
 * القيمة `'YEAR'` تفعّل مقطع السنة ونمط `BP-2027-000001` مع إعادة الضبط لكل فترة،
 * وأي قيمة أخرى/غياب المفتاح يُبقي السلوك الافتراضي (`BP-M03-000127`).
 */
export const NUMBERING_PERIOD_MODE_KEY = 'numbering.period.mode';
const PERIOD_MODE_YEAR = 'YEAR';

@Injectable()
export class NumberingService {
  constructor(private readonly prisma: PrismaService) {}

  /** توليد رقم مستند بصيغة {بادئة}-{كود المندوب}-{تسلسل} (مع سنة اختيارية). */
  format(prefix: DocPrefix, ownerCode: string, sequence: number, period?: number | null): string {
    return formatDocNumber(prefix, ownerCode, sequence, period);
  }

  label(prefix: DocPrefix): string {
    return DOC_PREFIXES[prefix];
  }

  /** الفترة الحالية للترقيم: سنة عند تفعيل النمط، وإلا 0 (بلا فترة). */
  private async currentPeriod(): Promise<number> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: NUMBERING_PERIOD_MODE_KEY },
    });
    return setting?.value === PERIOD_MODE_YEAR ? new Date().getFullYear() : 0;
  }

  /** إصدار رقم تسلسلي فريد من كتل الأرقام (آمن ضد التزاحم). */
  async issue(prefix: DocPrefix, ownerCode: string, companyId: number | null = null): Promise<string> {
    const period = await this.currentPeriod();
    const sequence = await this.reserveSequence(prefix, ownerCode, period, companyId);
    return formatDocNumber(prefix, ownerCode, sequence, period || undefined);
  }

  private async reserveSequence(
    prefix: DocPrefix,
    ownerCode: string,
    period: number,
    companyId: number | null,
  ): Promise<number> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const block = await this.prisma.numberBlock.findFirst({
        where: { prefix, ownerCode, period, ...tenantWhere(companyId) },
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
          data: { prefix, ownerCode, period, fromNo: from, toNo: from + BLOCK_SIZE - 1, lastUsed: from - 1, ...tenantWhere(companyId) },
        })
        .catch(() => undefined); // تعارض كتلة متزامنة — نعيد المحاولة
    }
    throw new BadRequestException(`Number block busy for ${prefix}-${ownerCode}`);
  }
}
