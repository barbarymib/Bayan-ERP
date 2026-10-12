import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import { SKIP_DEVICE_KEY, type AuthUser } from './auth.decorators.js';

/** الترويسة التي يحملها العميل لتحديد الجهاز (بعد تسجيل الجهاز §5.12). */
export const DEVICE_HEADER = 'x-device-id';

/**
 * جهاز موثوق: يتحقق أن الجهاز المرسل في الترويسة مسجَّل ونشط للمستخدم الحالي
 * (§9). يُعالج الإبطال عن بعد فوراً — الجهاز غير النشط يُرفض طلبه. مسار التسجيل
 * نفسه مستثنى عبر [SkipDeviceCheck].
 */
@Injectable()
export class DeviceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_DEVICE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) throw new ForbiddenException('Device check requires an authenticated user');

    const deviceId = this.headerValue(request.headers[DEVICE_HEADER]);
    if (!deviceId) {
      throw new BadRequestException(`Missing ${DEVICE_HEADER} header`);
    }

    const companyId = user.companyId ?? null;
    const device = await this.prisma.deviceRegistration.findFirst({
      where: { deviceId, userId: user.id, ...tenantWhere(companyId) },
    });
    if (!device || !device.active) {
      throw new ForbiddenException('Device not authorized — revoked or bound to another user');
    }

    await this.prisma.deviceRegistration.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });
    request.device = { id: device.id, deviceId: device.deviceId };
    return true;
  }

  private headerValue(value: unknown): string | undefined {
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    return trimmed.length ? trimmed : undefined;
  }
}
