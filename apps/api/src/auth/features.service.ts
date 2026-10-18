import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';

/**
 * تقييم ميزات النظام (Feature Flags §12.3) للمستخدم/الشركة الحاليَّين.
 * التسلسل: استثناء المستخدم ← استثناء الشركة ← الحالة العامة.
 */
@Injectable()
export class FeaturesService {
  constructor(private readonly prisma: PrismaService) {}

  /** تقييم ميزة واحدة. */
  async isEnabled(
    code: string,
    userId: number | null,
    companyId: number | null,
  ): Promise<boolean> {
    const feature = await this.prisma.systemFeature.findUnique({ where: { code } });
    if (!feature) return false;

    const [userOverride, companyOverride] = await Promise.all([
      userId
        ? this.prisma.userFeature.findUnique({
            where: { userId_featureId: { userId, featureId: feature.id } },
          })
        : Promise.resolve(null),
      companyId
        ? this.prisma.companyFeature.findUnique({
            where: { companyId_featureId: { companyId, featureId: feature.id } },
          })
        : Promise.resolve(null),
    ]);
    if (userOverride) return userOverride.enabled;
    if (companyOverride) return companyOverride.enabled;
    return feature.enabled;
  }

  /** كل الميزات كخريطة { code: enabled } للاستهلاك من العملاء (R3-A3). */
  async effectiveFlags(
    userId: number | null,
    companyId: number | null,
  ): Promise<Record<string, boolean>> {
    const features = await this.prisma.systemFeature.findMany({ orderBy: { code: 'asc' } });
    if (features.length === 0) return {};

    const [userOverrides, companyOverrides] = await Promise.all([
      userId
        ? this.prisma.userFeature.findMany({ where: { userId } })
        : Promise.resolve([]),
      companyId
        ? this.prisma.companyFeature.findMany({ where: { companyId } })
        : Promise.resolve([]),
    ]);

    const userMap = new Map(userOverrides.map((o) => [o.featureId, o.enabled]));
    const companyMap = new Map(companyOverrides.map((o) => [o.featureId, o.enabled]));

    const out: Record<string, boolean> = {};
    for (const feature of features) {
      const userOverride = userMap.get(feature.id);
      if (userOverride !== undefined) {
        out[feature.code] = userOverride;
        continue;
      }
      const companyOverride = companyMap.get(feature.id);
      if (companyOverride !== undefined) {
        out[feature.code] = companyOverride;
        continue;
      }
      out[feature.code] = feature.enabled;
    }
    return out;
  }
}
