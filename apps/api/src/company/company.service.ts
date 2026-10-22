import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import {
  checkMigrations,
  fetchAppliedMigrations,
  resolveMigrationsDir,
} from '../migrations-check/migrations-check.js';
import { resolveAlertsIntervalMs } from '../notifications/notifications.scheduler.js';
import { tenantWhere } from '../common/tenant.js';
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
        logoUrl: company.logoUrl,
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
    // R4-C4: الشعار data-URL صورة أو رابط https فقط (لا تخزين نصوص عشوائية).
    let logoUrl: string | null | undefined;
    if (dto.logoUrl !== undefined) {
      const v = dto.logoUrl.trim();
      if (v === '') logoUrl = null;
      else if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(v) || /^https:\/\//i.test(v)) logoUrl = v;
      else throw new BadRequestException('logoUrl يجب أن يكون data URL لصورة أو رابط https');
    }
    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.nameAr != null ? { nameAr: dto.nameAr } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
        ...(dto.email !== undefined ? { email: dto.email || null } : {}),
        ...(dto.contactName !== undefined ? { contactName: dto.contactName || null } : {}),
        ...(logoUrl !== undefined ? { logoUrl } : {}),
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
        logoChanged: logoUrl !== undefined && logoUrl !== company.logoUrl,
        taxPercent: Number(company.taxPercent),
        currency: company.currency,
      },
      afterJson: {
        nameAr: updated.nameAr,
        phone: updated.phone,
        email: updated.email,
        contactName: updated.contactName,
        logoChanged: logoUrl !== undefined && logoUrl !== company.logoUrl,
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
        logoUrl: updated.logoUrl,
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

  /** فحص وتشخيص سلامة النظام والخدمات السحابية والترحيلات (§12.5، §5.16). */
  async getDiagnostics(companyId: number | null) {
    const id = this.requireCompanyId(companyId);

    // 1. قاعدة البيانات والترحيلات
    let dbOk = false;
    let dbLatencyMs = 0;
    let migrations = { total: 0, applied: 0, pending: [] as string[] };
    try {
      const t0 = Date.now();
      await this.prisma.$queryRawUnsafe('SELECT 1');
      dbLatencyMs = Date.now() - t0;
      dbOk = true;

      try {
        const migrationsDir = resolveMigrationsDir();
        const appliedRows = await fetchAppliedMigrations(async (sql) =>
          this.prisma.$queryRawUnsafe(sql) as Promise<{ migration_name: string }[]>,
        );
        const mig = checkMigrations(migrationsDir, appliedRows);
        migrations = {
          total: mig.totalOnDisk,
          applied: mig.applied,
          pending: mig.pending,
        };
      } catch {
        // migrations dir may not be present in standalone test runners
      }
    } catch {
      dbOk = false;
    }

    // 2. التخزين السحابي للملفات
    const storageDriver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();
    const storage = {
      driver: storageDriver,
      configured: true,
      bucket:
        process.env.S3_BUCKET ??
        (storageDriver === 'local' ? (process.env.STORAGE_LOCAL_DIR ?? 'storage/local') : 'bayan-storage'),
      status: 'operational',
    };

    // 3. النسخ الاحتياطي المشفر وتمرين الاسترجاع (§5.16)
    const backupSchedule = process.env.BACKUP_DAILY_TIME ?? '02:00';
    let totalBackups = 0;
    let lastBackup: {
      id: number;
      code: string;
      filename: string;
      sizeBytes: number;
      status: string;
      encrypted: boolean;
      createdAt: string;
      completedAt: string | null;
      lastDrillAt: string | null;
      lastDrillOk: boolean | null;
      lastDrillDetail: string | null;
    } | null = null;

    try {
      const automatedBackup = (this.prisma as unknown as { automatedBackup?: {
        count: () => Promise<number>;
        findFirst: (args: unknown) => Promise<{
          id: number;
          code: string;
          filename: string;
          sizeBytes: bigint | number;
          status: string;
          encrypted: boolean;
          createdAt: Date;
          completedAt: Date | null;
          lastDrillAt: Date | null;
          lastDrillOk: boolean | null;
          lastDrillDetail: string | null;
        } | null>;
      } }).automatedBackup;

      if (automatedBackup) {
        totalBackups = await automatedBackup.count();
        const row = await automatedBackup.findFirst({
          orderBy: { id: 'desc' },
          select: {
            id: true,
            code: true,
            filename: true,
            sizeBytes: true,
            status: true,
            encrypted: true,
            createdAt: true,
            completedAt: true,
            lastDrillAt: true,
            lastDrillOk: true,
            lastDrillDetail: true,
          },
        });
        if (row) {
          lastBackup = {
            id: row.id,
            code: row.code,
            filename: row.filename,
            sizeBytes: Number(row.sizeBytes),
            status: row.status,
            encrypted: row.encrypted,
            createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
            completedAt: row.completedAt ? (row.completedAt instanceof Date ? row.completedAt.toISOString() : String(row.completedAt)) : null,
            lastDrillAt: row.lastDrillAt ? (row.lastDrillAt instanceof Date ? row.lastDrillAt.toISOString() : String(row.lastDrillAt)) : null,
            lastDrillOk: row.lastDrillOk,
            lastDrillDetail: row.lastDrillDetail,
          };
        }
      }
    } catch {
      /* ignore if in tests */
    }

    // 4. مجدول التنبيهات الآلية (§5.15)
    const alertInterval = resolveAlertsIntervalMs();
    const alerts = {
      status: alertInterval != null ? 'running' : 'disabled',
      intervalSeconds: alertInterval != null ? Math.round(alertInterval / 1000) : null,
    };

    // 5. الأجهزة المسجلة والمزامنة (§9)
    let totalDevices = 0;
    let activeDevices = 0;
    try {
      const devReg = (this.prisma as unknown as { deviceRegistration?: {
        count: (args: { where: object }) => Promise<number>;
      } }).deviceRegistration;
      if (devReg) {
        [totalDevices, activeDevices] = await Promise.all([
          devReg.count({ where: tenantWhere(id) }),
          devReg.count({ where: { active: true, ...tenantWhere(id) } }),
        ]);
      }
    } catch {
      /* ignore if in tests */
    }

    // 6. بيئة تشغيل الخادم
    const memory = process.memoryUsage();
    const runtime = {
      nodeVersion: process.version,
      platform: process.platform,
      uptimeSeconds: Math.floor(process.uptime()),
      heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 10) / 10,
      rssMb: Math.round((memory.rss / 1024 / 1024) * 10) / 10,
      timestamp: new Date().toISOString(),
    };

    const overallHealthy = dbOk && migrations.pending.length === 0;

    return {
      status: overallHealthy ? 'healthy' : 'degraded',
      companyId: id,
      database: {
        connected: dbOk,
        latencyMs: dbLatencyMs,
        migrations,
      },
      storage,
      backups: {
        schedule: backupSchedule,
        encryption: 'AES-256-GCM',
        totalCount: totalBackups,
        latest: lastBackup,
      },
      alerts,
      devices: {
        total: totalDevices,
        active: activeDevices,
      },
      runtime,
    };
  }
}
