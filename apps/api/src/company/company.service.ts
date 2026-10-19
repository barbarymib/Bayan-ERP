import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { UpdateCompanySettingsDto } from './company.dto.js';
@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditLogsService,
  ) {}

  private requireCompanyId(companyId: number | null): number {
    if (companyId == null) throw new BadRequestException('لا يوجد نطاق شركة لهذا الحساب');
    return companyId;
  }

  /** إعدادات الشركة للنطاق الحالي (R3-B15). */
  async getSettings(companyId: number | null) {
    const id = this.requireCompanyId(companyId);
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException(`Company ${id} not found`);
    return {
      company: {
        id: company.id,
        code: company.code,
        nameAr: company.nameAr,
        phone: company.phone,
        email: company.email,
        contactName: company.contactName,
        taxPercent: Number(company.taxPercent),
        currency: company.currency,
      },
    };
  }

  /** تحديث إعدادات الشركة للنطاق الحالي (محمي بـ company.manage). */
  async updateSettings(companyId: number | null, dto: UpdateCompanySettingsDto, userId: number, actor?: string) {
    const id = this.requireCompanyId(companyId);
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException(`Company ${id} not found`);
    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.nameAr != null ? { nameAr: dto.nameAr } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
        ...(dto.email !== undefined ? { email: dto.email || null } : {}),
        ...(dto.contactName !== undefined ? { contactName: dto.contactName || null } : {}),
        ...(dto.taxPercent != null ? { taxPercent: dto.taxPercent } : {}),
        ...(dto.currency != null ? { currency: dto.currency } : {}),
      },
    });
    await this.audits.write({
      userId,
      action: 'company.update',
      entity: 'Company',
      entityId: id,
      beforeJson: {
        nameAr: company.nameAr,
        phone: company.phone,
        email: company.email,
        contactName: company.contactName,
        taxPercent: Number(company.taxPercent),
        currency: company.currency,
      },
      afterJson: {
        nameAr: updated.nameAr,
        phone: updated.phone,
        email: updated.email,
        contactName: updated.contactName,
        taxPercent: Number(updated.taxPercent),
        currency: updated.currency,
        actor: actor ?? null,
      },
    });
    return {
      company: {
        id: updated.id,
        code: updated.code,
        nameAr: updated.nameAr,
        phone: updated.phone,
        email: updated.email,
        contactName: updated.contactName,
        taxPercent: Number(updated.taxPercent),
        currency: updated.currency,
      },
    };
  }

  /** الضريبة الافتراضية للشركة عند إنشاء بيان — null عند عدم وجود شركة (R3-B15). */
  async defaultTaxPercent(companyId: number | null): Promise<number | null> {
    if (companyId == null) return null;
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { taxPercent: true },
    });
    return company ? Number(company.taxPercent) : null;
  }

  // ---- إدارة ميزات الشركة (G17: إدارة جانب المستأجر دون المدير العام) ----

  /** ميزات النظام مع القيمة الفعالة للشركة ونطاقها (GLOBAL أو COMPANY). */
  async listFeatures(companyId: number | null) {
    const id = this.requireCompanyId(companyId);
    const features = await this.prisma.systemFeature.findMany({ orderBy: { code: 'asc' } });
    const overrides = await this.prisma.companyFeature.findMany({ where: { companyId: id } });
    const overrideMap = new Map(overrides.map((o) => [o.featureId, o.enabled]));
    return {
      features: features.map((f) => {
        const override = overrideMap.get(f.id);
        return {
          code: f.code,
          nameAr: f.nameAr,
          globalDefault: f.enabled,
          override: override ?? null,
          enabled: override ?? f.enabled,
          scope: override === undefined ? 'GLOBAL' : 'COMPANY',
        };
      }),
    };
  }

  /** ضبط ميزة على مستوى الشركة (upsert استبدال الشركة). */
  async setCompanyFeature(companyId: number | null, code: string, enabled: boolean, userId: number, actor?: string) {
    const id = this.requireCompanyId(companyId);
    const feature = await this.prisma.systemFeature.findUnique({ where: { code } });
    if (!feature) throw new NotFoundException(`Feature ${code} not found`);
    // 12.3/12.4: لا يملك مسؤول الشركة إلا تفعيل/تعطيل الميزات المفعّلة عامّاً؛ لا يمكنه تجاوز القرار العام.
    if (enabled && !feature.enabled) {
      throw new ForbiddenException(`الميزة "${code}" معطّلة عامّاً ولا يمكن تفعيلها على مستوى الشركة`);
    }
    const before = await this.prisma.companyFeature.findUnique({
      where: { companyId_featureId: { companyId: id, featureId: feature.id } },
    });
    const updated = await this.prisma.companyFeature.upsert({
      where: { companyId_featureId: { companyId: id, featureId: feature.id } },
      create: { companyId: id, featureId: feature.id, enabled },
      update: { enabled },
    });
    await this.audits.write({
      userId,
      action: 'company.feature_set',
      entity: 'CompanyFeature',
      entityId: id,
      beforeJson: { code, enabled: before?.enabled ?? null, globalDefault: feature.enabled },
      afterJson: { code, enabled: updated.enabled, actor: actor ?? null },
    });
    return { code, enabled: updated.enabled, scope: 'COMPANY' };
  }

  /** حذف استبدال الشركة للميزة (العودة للحالة العامة). */
  async clearCompanyFeature(companyId: number | null, code: string, userId: number, actor?: string) {
    const id = this.requireCompanyId(companyId);
    const feature = await this.prisma.systemFeature.findUnique({ where: { code } });
    if (!feature) throw new NotFoundException(`Feature ${code} not found`);
    const before = await this.prisma.companyFeature.findUnique({
      where: { companyId_featureId: { companyId: id, featureId: feature.id } },
    });
    if (before) {
      await this.prisma.companyFeature.delete({
        where: { companyId_featureId: { companyId: id, featureId: feature.id } },
      });
    }
    await this.audits.write({
      userId,
      action: 'company.feature_clear',
      entity: 'CompanyFeature',
      entityId: id,
      beforeJson: { code, enabled: before?.enabled ?? null },
      afterJson: { code, enabled: null, globalDefault: feature.enabled, actor: actor ?? null },
    });
    return { code, enabled: feature.enabled, scope: 'GLOBAL' };
  }

  /** استبدال ميزة على مستوى مستخدم داخل الشركة (enabled=null يحذف الاستبدال). */
  async setUserFeature(
    companyId: number | null,
    targetUserId: number,
    code: string,
    enabled: boolean | undefined,
    actorId: number,
    actor?: string,
  ) {
    const id = this.requireCompanyId(companyId);
    const feature = await this.prisma.systemFeature.findUnique({ where: { code } });
    if (!feature) throw new NotFoundException(`Feature ${code} not found`);
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target || target.companyId !== id) throw new NotFoundException(`User ${targetUserId} not found in this company`);

    if (enabled === undefined || enabled === null) {
      const before = await this.prisma.userFeature.findUnique({
        where: { userId_featureId: { userId: targetUserId, featureId: feature.id } },
      });
      if (before) {
        await this.prisma.userFeature.delete({
          where: { userId_featureId: { userId: targetUserId, featureId: feature.id } },
        });
      }
      await this.audits.write({
        userId: actorId,
        action: 'user.feature_clear',
        entity: 'UserFeature',
        entityId: targetUserId,
        beforeJson: { code, enabled: before?.enabled ?? null },
        afterJson: { code, enabled: null, actor: actor ?? null },
      });
      return { code, userId: targetUserId, enabled: null, scope: 'COMPANY_OR_GLOBAL' };
    }

    await this.prisma.userFeature.upsert({
      where: { userId_featureId: { userId: targetUserId, featureId: feature.id } },
      create: { userId: targetUserId, featureId: feature.id, enabled },
      update: { enabled },
    });
    await this.audits.write({
      userId: actorId,
      action: 'user.feature_set',
      entity: 'UserFeature',
      entityId: targetUserId,
      beforeJson: { code },
      afterJson: { code, enabled, actor: actor ?? null },
    });
    return { code, userId: targetUserId, enabled, scope: 'USER' };
  }
}
