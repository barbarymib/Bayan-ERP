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
import {
  FEATURES_KEY,
  GLOBAL_ADMIN_KEY,
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
  type AuthUser,
} from './auth.decorators.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
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
      include: { company: true },
    });
    if (!dbUser || !dbUser.active) {
      throw new UnauthorizedException('Inactive user');
    }
    if (dbUser.company && dbUser.company.status === 'DISABLED') {
      throw new ForbiddenException('Company disabled');
    }

    request.user = payload;

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

    const requiredFeatures = this.reflector.getAllAndOverride<string[]>(FEATURES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredFeatures?.length) {
      for (const code of requiredFeatures) {
        const on = await this.featureEnabled(code, dbUser.id, dbUser.companyId);
        if (!on) throw new ForbiddenException(`Feature disabled: ${code}`);
      }
    }

    return true;
  }

  /** تقييم الميزة: استثناء المستخدم ← استثناء الشركة ← الحالة العامة (§12.3). */
  private async featureEnabled(code: string, userId: number, companyId: number | null): Promise<boolean> {
    const feature = await this.prisma.systemFeature.findUnique({ where: { code } });
    if (!feature) return false;

    const [userOverride, companyOverride] = await Promise.all([
      this.prisma.userFeature.findUnique({
        where: { userId_featureId: { userId, featureId: feature.id } },
      }),
      companyId
        ? this.prisma.companyFeature.findUnique({
            where: { companyId_featureId: { companyId, featureId: feature.id } },
          })
        : null,
    ]);
    if (userOverride) return userOverride.enabled;
    if (companyOverride) return companyOverride.enabled;
    return feature.enabled;
  }
}