import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.module.js';
import { setTenant } from '../tenant/tenant.context.js';
import { effectiveDiscountLimit } from '../common/discount-limits.js';
import { FeaturesService } from './features.service.js';
import {
  FEATURES_KEY,
  GLOBAL_ADMIN_KEY,
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
  ANY_PERMISSIONS_KEY,
  type AuthUser,
} from './auth.decorators.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly features: FeaturesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: AuthUser;
    try {
      payload = (await this.jwt.verifyAsync<AuthUser>(header.slice(7))) as AuthUser;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // رمز التحديث ليس صالحًا للوصول للمسارات المحمية
    if ((payload as unknown as { typ?: string }).typ === 'refresh') {
      throw new UnauthorizedException('Refresh token cannot be used for access');
    }

    // تثبيت سياق الشركة (§12) قبل أي استعلام يعتمد عليه (الميزات، الفحوصات اللاحقة).
    setTenant({ companyId: payload.companyId ?? null });

    const globalOnly = this.reflector.getAllAndOverride<boolean>(GLOBAL_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // توكن المشرف العام للبيئة
    if (payload.scope === 'global' || payload.username !== undefined) {
      if (!globalOnly) {
        throw new ForbiddenException('Global admin cannot access this endpoint');
      }
      request.user = payload;
      return true;
    }

    if (globalOnly) {
      throw new ForbiddenException('Global admin only endpoint');
    }

    // مستخدم شركة: تحقق من نشاطه ونشاط الشركة (SaaS §12.2)
    const dbUser = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        company: true,
        role: { select: { maxItemDiscountPct: true, maxInvoiceDiscountPct: true } },
      },
    });
    if (!dbUser || !dbUser.active) {
      throw new UnauthorizedException('Inactive user');
    }
    if (dbUser.company && dbUser.company.status === 'DISABLED') {
      throw new ForbiddenException('Company disabled');
    }

    // حدود الخصم الفعلية (حد الدور يتقدّم، fallback لحد المستخدم §4.2) — طازجة من القاعدة
    request.user = {
      ...payload,
      maxItemDiscountPct: effectiveDiscountLimit(dbUser.role?.maxItemDiscountPct, dbUser.maxItemDiscountPct),
      maxInvoiceDiscountPct: effectiveDiscountLimit(dbUser.role?.maxInvoiceDiscountPct, dbUser.maxInvoiceDiscountPct),
    };

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required?.length) {
      const missing = required.filter((p) => !payload.permissions?.includes(p));
      if (missing.length) {
        throw new ForbiddenException(`Missing permissions: ${missing.join(', ')}`);
      }
    }

    const requiredAny = this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredAny?.length && !requiredAny.some((p) => payload.permissions?.includes(p))) {
      throw new ForbiddenException(`Missing permissions (any of): ${requiredAny.join(', ')}`);
    }

    const requiredFeatures = this.reflector.getAllAndOverride<string[]>(FEATURES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredFeatures?.length) {
      for (const code of requiredFeatures) {
        const on = await this.features.isEnabled(code, dbUser.id, dbUser.companyId);
        if (!on) throw new ForbiddenException(`Feature disabled: ${code}`);
      }
    }

    return true;
  }
}