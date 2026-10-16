import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.module.js';
import { effectiveDiscountLimit } from '../common/discount-limits.js';
import type { AuthUser } from './auth.decorators.js';

export interface LoginInput {
  email?: string;
  phone?: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSession extends TokenPair {
  user: AuthUser;
}

const ACCESS_TTL = process.env.JWT_ACCESS_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? '1h';
const REFRESH_TTL = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private async signTokens(user: AuthUser): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(user, {
      expiresIn: ACCESS_TTL as unknown as number,
    });
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, typ: 'refresh' },
      { expiresIn: REFRESH_TTL as unknown as number },
    );
    return { accessToken, refreshToken };
  }

  async login(input: LoginInput): Promise<AuthSession> {
    const where = input.email
      ? { email: input.email }
      : input.phone
        ? { phone: input.phone }
        : null;
    if (!where) throw new UnauthorizedException('email or phone required');

    const user = await this.prisma.user.findFirst({
      where: { ...where, active: true },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        company: true,
      },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.company && user.company.status === 'DISABLED') {
      throw new UnauthorizedException('Company disabled');
    }

    const ok = await compare(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const authUser: AuthUser = {
      id: user.id,
      sub: user.id,
      name: user.name,
      roleCode: user.role.code,
      repCode: user.repCode,
      permissions: user.role.permissions.map((rp) => rp.permission.code),
      maxItemDiscountPct: effectiveDiscountLimit(user.role.maxItemDiscountPct, user.maxItemDiscountPct),
      maxInvoiceDiscountPct: effectiveDiscountLimit(user.role.maxInvoiceDiscountPct, user.maxInvoiceDiscountPct),
      scope: 'tenant',
      companyId: user.companyId,
    };

    const tokens = await this.signTokens(authUser);
    return { ...tokens, user: authUser };
  }

  /** تجديد زوج الرموز من رمز تحديث صالح (يدوّر رمز التحديث). */
  async refresh(token: string): Promise<AuthSession> {
    let payload: { sub?: number; typ?: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub?: number; typ?: string }>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (payload.typ !== 'refresh' || typeof payload.sub !== 'number') {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.validateUser(payload.sub);
    const tokens = await this.signTokens(user);
    return { ...tokens, user };
  }

  /** هوية المستخدم من التوكن — تُستخدم في المسارات الحساسة. */
  async validateUser(userId: number): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        company: true,
      },
    });
    if (!user?.active) throw new UnauthorizedException();
    if (user.company && user.company.status === 'DISABLED') throw new UnauthorizedException('Company disabled');
    return {
      id: user.id,
      sub: user.id,
      name: user.name,
      roleCode: user.role.code,
      repCode: user.repCode,
      permissions: user.role.permissions.map((rp) => rp.permission.code),
      maxItemDiscountPct: effectiveDiscountLimit(user.role.maxItemDiscountPct, user.maxItemDiscountPct),
      maxInvoiceDiscountPct: effectiveDiscountLimit(user.role.maxInvoiceDiscountPct, user.maxInvoiceDiscountPct),
      scope: 'tenant',
      companyId: user.companyId,
    };
  }
}
