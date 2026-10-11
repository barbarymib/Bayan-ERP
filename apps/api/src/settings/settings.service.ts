import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditLogsService,
  ) {}

  async list() {
    const [settings, total] = await Promise.all([
      this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } }),
      this.prisma.systemSetting.count(),
    ]);
    return { settings, total };
  }

  async get(key: string) {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!setting) throw new NotFoundException(`Setting ${key} not found`);
    return setting;
  }

  async upsert(key: string, value: string, actor?: string) {
    const normalized = key?.trim();
    if (!normalized) throw new BadRequestException('Setting key is required');
    const before = await this.prisma.systemSetting.findUnique({ where: { key: normalized } });
    const setting = await this.prisma.systemSetting.upsert({
      where: { key: normalized },
      update: { value },
      create: { key: normalized, value },
    });
    await this.audits.write({
      action: before ? 'setting.update' : 'setting.create',
      entity: 'SystemSetting',
      entityId: 0,
      beforeJson: before ? { key: normalized, value: before.value } : undefined,
      afterJson: { key: normalized, value: setting.value, actor: actor ?? null },
    });
    return setting;
  }

  async remove(key: string, actor?: string) {
    const setting = await this.get(key);
    await this.prisma.systemSetting.delete({ where: { key } });
    await this.audits.write({
      action: 'setting.delete',
      entity: 'SystemSetting',
      entityId: 0,
      beforeJson: { key, value: setting.value },
      afterJson: { key, deleted: true, actor: actor ?? null },
    });
    return { ok: true };
  }
}
