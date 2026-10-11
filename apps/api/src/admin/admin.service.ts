import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.module.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type {
  CreateCompanyDto,
  GlobalLoginDto,
  QueryCompaniesDto,
  SetUserFeatureDto,
  UpdateCompanyDto,
} from './admin.dto.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audits: AuditLogsService,
  ) {}

  /** دخول المشرف العام للبيئة (§12.4). */
  async login(dto: GlobalLoginDto) {
    const admin = await this.prisma.globalAdmin.findUnique({ where: { username: dto.username } });
    if (!admin || !admin.active) throw new UnauthorizedException('Invalid credentials');

    const ok = await compare(dto.password, admin.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const accessToken = await this.jwt.signAsync({
      scope: 'global',
      sub: admin.id,
      name: admin.nameAr,
      username: admin.username,
    });
    return {
      accessToken,
      admin: { id: admin.id, name: admin.nameAr, username: admin.username },
    };
  }

  /** تسجيل شركة جديدة (Onboarding §12.1) مع مالكها الأول اختيارياً. */
  async createCompany(dto: CreateCompanyDto, actor?: string) {
    const code = dto.code.trim().toLowerCase();
    const existing = await this.prisma.company.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`Company code '${code}' already exists`);

    // تحقّق من مُدخلات المالك قبل إنشاء الشركة تفادياً لسجل شركة يتيم.
    const o = dto.owner;
    const email = o?.email?.trim().toLowerCase() || undefined;
    const phone = o?.phone?.trim() || undefined;
    if (o && !email && !phone) throw new BadRequestException('Owner requires an email or phone to sign in');

    let ownerRole: { id: number } | null = null;
    if (o) {
      ownerRole = await this.prisma.role.findUnique({
        where: { code: 'OWNER' },
        select: { id: true },
      });
      if (!ownerRole) throw new InternalServerErrorException('OWNER role is missing from seed');

      const duplicate = await this.prisma.user.findFirst({
        where: { OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] },
      });
      if (duplicate) throw new ConflictException('A user already uses this email/phone');
    }

    const company = await this.prisma.company.create({
      data: {
        code,
        nameAr: dto.nameAr.trim(),
        phone: dto.phone,
        email: dto.email,
        contactName: dto.contactName,
      },
    });

    let owner: {
      id: number;
      name: string;
      email: string | null;
      phone: string | null;
      repCode: string | null;
      roleCode: string;
    } | null = null;

    if (o && ownerRole) {
      const created = await this.prisma.user.create({
        data: {
          name: o.name.trim(),
          email,
          phone,
          passwordHash: await hash(o.password, 10),
          roleId: ownerRole.id,
          companyId: company.id,
          active: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          repCode: true,
          role: { select: { code: true } },
        },
      });
      owner = {
        id: created.id,
        name: created.name,
        email: created.email,
        phone: created.phone,
        repCode: created.repCode,
        roleCode: created.role.code,
      };
    }

    await this.audits.write({
      action: 'company.create',
      entity: 'Company',
      entityId: company.id,
      afterJson: { code: company.code, nameAr: company.nameAr, ownerUserId: owner?.id ?? null, actor: actor ?? null },
    });
    return { company, owner };
  }

  /** سجل الشركات مع عدد المستخدمين. */
  async listCompanies(query: QueryCompaniesDto) {
    const companies = await this.prisma.company.findMany({
      where: query.q
        ? { OR: [{ nameAr: { contains: query.q, mode: 'insensitive' } }, { code: { contains: query.q, mode: 'insensitive' } }] }
        : undefined,
      include: { _count: { select: { users: true } } },
      orderBy: { nameAr: 'asc' },
    });
    return { companies: companies.map((c) => ({ ...c, usersCount: c._count.users, _count: undefined })) };
  }

  /** تعديل بيانات شركة / تفعيل أو تعطيل. */
  async patchCompany(id: number, dto: UpdateCompanyDto, actor?: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException(`Company ${id} not found`);
    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        nameAr: dto.nameAr ?? company.nameAr,
        phone: dto.phone ?? company.phone,
        email: dto.email ?? company.email,
        contactName: dto.contactName ?? company.contactName,
        status: dto.status ?? company.status,
      },
    });
    await this.audits.write({
      action: 'company.update',
      entity: 'Company',
      entityId: id,
      beforeJson: { nameAr: company.nameAr, status: company.status, phone: company.phone, email: company.email, contactName: company.contactName },
      afterJson: { nameAr: updated.nameAr, status: updated.status, phone: updated.phone, email: updated.email, contactName: updated.contactName, actor: actor ?? null },
    });
    return { company: updated };
  }

  /** ميزات شركة: الحالة العامة + أي استثناء مسجل للشركة. */
  async companyFeatures(id: number) {
    await this.requireCompany(id);
    const features = await this.prisma.systemFeature.findMany({
      orderBy: { code: 'asc' },
      include: { companyOverrides: { where: { companyId: id } } },
    });
    return {
      companyId: id,
      features: features.map((f) => ({
        id: f.id,
        code: f.code,
        nameAr: f.nameAr,
        globalEnabled: f.enabled,
        companyOverride: f.companyOverrides[0]?.enabled ?? null,
        enabled: f.companyOverrides[0]?.enabled ?? f.enabled,
      })),
    };
  }

  /** تفعيل/تعطيل ميزة لشركة (استثناء) أو إرجاعها للوضع العام. */
  async setCompanyFeature(id: number, code: string, enabled: boolean, actor?: string) {
    await this.requireCompany(id);
    const feature = await this.requireFeature(code);
    const previous = await this.prisma.companyFeature.findUnique({
      where: { companyId_featureId: { companyId: id, featureId: feature.id } },
      select: { enabled: true },
    });
    await this.prisma.companyFeature.upsert({
      where: { companyId_featureId: { companyId: id, featureId: feature.id } },
      update: { enabled },
      create: { companyId: id, featureId: feature.id, enabled },
    });
    await this.audits.write({
      action: 'company.feature',
      entity: 'CompanyFeature',
      entityId: id,
      beforeJson: { companyId: id, code, enabled: previous?.enabled ?? null },
      afterJson: { companyId: id, code, enabled, actor: actor ?? null },
    });
    return { companyId: id, featureCode: code, enabled };
  }

  async clearCompanyFeature(id: number, code: string, actor?: string) {
    await this.requireCompany(id);
    const feature = await this.requireFeature(code);
    await this.prisma.companyFeature.deleteMany({ where: { companyId: id, featureId: feature.id } });
    await this.audits.write({
      action: 'company.feature.clear',
      entity: 'CompanyFeature',
      entityId: id,
      afterJson: { companyId: id, code, override: null, actor: actor ?? null },
    });
    return { companyId: id, featureCode: code, override: null };
  }

  /** الميزات العامة مع أعداد الاستثناءات. */
  async listFeatures() {
    const features = await this.prisma.systemFeature.findMany({
      include: { _count: { select: { userOverrides: true, companyOverrides: true } } },
      orderBy: { code: 'asc' },
    });
    return {
      features: features.map((f) => ({
        id: f.id,
        code: f.code,
        nameAr: f.nameAr,
        enabled: f.enabled,
        userOverrides: f._count.userOverrides,
        companyOverrides: f._count.companyOverrides,
      })),
    };
  }

  /** تشغيل/إطفاء ميزة عامة (كل الشركات). */
  async setGlobalFeature(code: string, enabled: boolean, actor?: string) {
    const feature = await this.requireFeature(code);
    const updated = await this.prisma.systemFeature.update({ where: { id: feature.id }, data: { enabled } });
    await this.audits.write({
      action: 'feature.set',
      entity: 'SystemFeature',
      entityId: feature.id,
      beforeJson: { code, enabled: feature.enabled },
      afterJson: { code, enabled: updated.enabled, actor: actor ?? null },
    });
    return { feature: { id: updated.id, code: updated.code, nameAr: updated.nameAr, enabled: updated.enabled } };
  }

  /** مستخدمو شركة مع استثناءاتهم لميزة معينة. */
  async featureUsers(code: string) {
    const feature = await this.requireFeature(code);
    const users = await this.prisma.user.findMany({
      where: { companyId: { not: null } },
      include: {
        company: { select: { id: true, nameAr: true, status: true } },
        role: { select: { code: true, nameAr: true } },
        featureOverrides: { where: { featureId: feature.id } },
      },
      orderBy: { name: 'asc' },
    });
    return {
      featureCode: code,
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        repCode: u.repCode,
        company: u.company,
        roleCode: u.role.code,
        override: u.featureOverrides[0]?.enabled ?? null, // null = تلقائي (من العام/الشركة)
      })),
    };
  }

  /** ميزة لمستخدم بعينه (null يمسح الاستثناء). */
  async setUserFeature(userId: number, code: string, dto: SetUserFeatureDto, actor?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    const feature = await this.requireFeature(code);

    if (dto.enabled === undefined) {
      await this.prisma.userFeature.deleteMany({ where: { userId, featureId: feature.id } });
      await this.audits.write({
        action: 'user.feature.clear',
        entity: 'UserFeature',
        entityId: userId,
        afterJson: { userId, code, override: null, actor: actor ?? null },
      });
      return { userId, featureCode: code, override: null };
    }
    await this.prisma.userFeature.upsert({
      where: { userId_featureId: { userId, featureId: feature.id } },
      update: { enabled: dto.enabled },
      create: { userId, featureId: feature.id, enabled: dto.enabled },
    });
    await this.audits.write({
      action: 'user.feature',
      entity: 'UserFeature',
      entityId: userId,
      afterJson: { userId, code, override: dto.enabled, actor: actor ?? null },
    });
    return { userId, featureCode: code, override: dto.enabled };
  }

  private async requireCompany(id: number) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException(`Company ${id} not found`);
    return company;
  }

  private async requireFeature(code: string) {
    const feature = await this.prisma.systemFeature.findUnique({ where: { code } });
    if (!feature) throw new NotFoundException(`Feature ${code} not found`);
    return feature;
  }
}