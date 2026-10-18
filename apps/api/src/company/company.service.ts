import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
      data: dto.taxPercent != null ? { taxPercent: dto.taxPercent } : {},
    });
    await this.audits.write({
      userId,
      action: 'company.update',
      entity: 'Company',
      entityId: id,
      beforeJson: { taxPercent: Number(company.taxPercent) },
      afterJson: { taxPercent: Number(updated.taxPercent), actor: actor ?? null },
    });
    return {
      company: {
        id: updated.id,
        code: updated.code,
        nameAr: updated.nameAr,
        taxPercent: Number(updated.taxPercent),
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
}
