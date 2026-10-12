import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { tenantWhere } from '../common/tenant.js';

/** إدارة أجهزة المناديب (§9): عرض الأجهزة وإبطال/إعادة تفعيل جهاز عن بعد. */
@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditLogsService,
  ) {}

  async list(companyId: number | null) {
    const devices = await this.prisma.deviceRegistration.findMany({
      where: { ...tenantWhere(companyId) },
      orderBy: [{ active: 'desc' }, { lastSeenAt: 'desc' }, { id: 'desc' }],
      include: {
        user: { select: { id: true, name: true, repCode: true, role: { select: { code: true } } } },
      },
    });
    return { devices, total: devices.length };
  }

  /** إبطال/تفعيل جهاز؛ الإبطال يقطع مزامنة الجهاز فوراً عبر [DeviceGuard]. */
  async setActive(id: number, active: boolean, companyId: number | null, actor?: string) {
    const device = await this.prisma.deviceRegistration.findFirst({
      where: { id, ...tenantWhere(companyId) },
    });
    if (!device) throw new NotFoundException('Device not found');

    const updated = await this.prisma.deviceRegistration.update({
      where: { id: device.id },
      data: { active },
    });
    await this.audits.write({
      action: active ? 'device.activate' : 'device.revoke',
      entity: 'DeviceRegistration',
      entityId: device.id,
      beforeJson: { active: device.active, deviceId: device.deviceId },
      afterJson: { active, actor: actor ?? null },
    });
    return updated;
  }
}
