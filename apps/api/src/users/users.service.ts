import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { hash, compare } from 'bcryptjs';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type {
  ChangePasswordDto,
  CreateUserDto,
  QueryUsersDto,
  UpdateRoleLimitsDto,
  UpdateSelfProfileDto,
  UpdateUserDto,
} from './users.dto.js';

const SAFE_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  repCode: true,
  roleId: true,
  branchId: true,
  maxItemDiscountPct: true,
  maxInvoiceDiscountPct: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

const isUniqueError = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

export interface RoleWithPerms {
  id: number;
  code: string;
  nameAr: string;
  maxItemDiscountPct: number | null;
  maxInvoiceDiscountPct: number | null;
  permissions: { code: string; nameAr: string }[];
}

export interface PermissionRow {
  code: string;
  nameAr: string;
}

/** الأدوار المحمية من التعديل: تبقى دائماً بكامل صلاحياتها لمنع إغلاق النظام. */
const PROTECTED_ROLES = new Set(['ADMIN']);

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditLogsService,
  ) {}

  async listRoles(): Promise<RoleWithPerms[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: { code: 'asc' },
      include: { permissions: { include: { permission: { select: { code: true, nameAr: true } } } } },
    });
    return roles.map((r) => this.toRoleRow(r));
  }

  /** يبني صف الدور مع تحويل حدود الخصم العشرية (null = غير مضبوط §4.2). */
  private toRoleRow(r: {
    id: number;
    code: string;
    nameAr: string;
    maxItemDiscountPct?: unknown;
    maxInvoiceDiscountPct?: unknown;
    permissions: { permission: { code: string; nameAr: string } }[];
  }): RoleWithPerms {
    return {
      id: r.id,
      code: r.code,
      nameAr: r.nameAr,
      maxItemDiscountPct: r.maxItemDiscountPct == null ? null : Number(r.maxItemDiscountPct),
      maxInvoiceDiscountPct: r.maxInvoiceDiscountPct == null ? null : Number(r.maxInvoiceDiscountPct),
      permissions: r.permissions.map((rp) => rp.permission),
    };
  }

  async listPermissions(): Promise<PermissionRow[]> {
    return this.prisma.permission.findMany({
      orderBy: { code: 'asc' },
      select: { code: true, nameAr: true },
    });
  }

  /** يستبدل صلاحيات دور بمجموعة الأكواد المطلوبة (الكتالوج الكامل). */
  async updateRolePermissions(roleId: number, permissionCodes: string[], actorId?: number): Promise<RoleWithPerms> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: { select: { code: true, nameAr: true } } } } },
    });
    if (!role) throw new NotFoundException(`Role #${roleId} not found`);
    if (PROTECTED_ROLES.has(role.code)) {
      throw new BadRequestException(`Role ${role.code} is protected and cannot be edited`);
    }

    const unique = [...new Set(permissionCodes)];
    const perms = await this.prisma.permission.findMany({
      where: { code: { in: unique } },
      select: { id: true, code: true, nameAr: true },
    });
    if (perms.length !== unique.length) {
      const found = new Set(perms.map((p) => p.code));
      const missing = unique.filter((c) => !found.has(c));
      throw new BadRequestException(`Unknown permission code(s): ${missing.join(', ')}`);
    }

    const before = role.permissions.map((rp) => rp.permission.code).sort();
    const after = [...perms.map((p) => p.code)].sort();

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({
        data: perms.map((p) => ({ roleId, permissionId: p.id })),
        skipDuplicates: true,
      });
    });

    await this.audits.write({
      action: 'role.permissions',
      entity: 'Role',
      entityId: roleId,
      userId: actorId,
      beforeJson: { roleCode: role.code, permissions: before },
      afterJson: { roleCode: role.code, permissions: after },
    });

    return {
      id: role.id,
      code: role.code,
      nameAr: role.nameAr,
      maxItemDiscountPct: role.maxItemDiscountPct == null ? null : Number(role.maxItemDiscountPct),
      maxInvoiceDiscountPct: role.maxInvoiceDiscountPct == null ? null : Number(role.maxInvoiceDiscountPct),
      permissions: perms.map((p) => ({ code: p.code, nameAr: p.nameAr })),
    };
  }

  /**
   * يضبط حدود الخصم الافتراضية لهذا الدور (§4.2: "تُضبط لكل دور ولكل مستخدم").
   * `null` يعني "غير مضبوط" فيتحوّل الحد الفعلي لحد المستخدم (fallback).
   */
  async updateRoleLimits(roleId: number, dto: UpdateRoleLimitsDto, actorId?: number): Promise<RoleWithPerms> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: { select: { code: true, nameAr: true } } } } },
    });
    if (!role) throw new NotFoundException(`Role #${roleId} not found`);
    if (PROTECTED_ROLES.has(role.code)) {
      throw new BadRequestException(`Role ${role.code} is protected and cannot be edited`);
    }

    const data: { maxItemDiscountPct?: number | null; maxInvoiceDiscountPct?: number | null } = {};
    if (dto.maxItemDiscountPct !== undefined) data.maxItemDiscountPct = dto.maxItemDiscountPct;
    if (dto.maxInvoiceDiscountPct !== undefined) data.maxInvoiceDiscountPct = dto.maxInvoiceDiscountPct;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No discount limits supplied (maxItemDiscountPct / maxInvoiceDiscountPct)');
    }

    const before = {
      maxItemDiscountPct: role.maxItemDiscountPct == null ? null : Number(role.maxItemDiscountPct),
      maxInvoiceDiscountPct: role.maxInvoiceDiscountPct == null ? null : Number(role.maxInvoiceDiscountPct),
    };
    const updated = await this.prisma.role.update({ where: { id: roleId }, data });
    const after = {
      maxItemDiscountPct: updated.maxItemDiscountPct == null ? null : Number(updated.maxItemDiscountPct),
      maxInvoiceDiscountPct: updated.maxInvoiceDiscountPct == null ? null : Number(updated.maxInvoiceDiscountPct),
    };

    await this.audits.write({
      action: 'role.limits',
      entity: 'Role',
      entityId: roleId,
      userId: actorId,
      beforeJson: { roleCode: role.code, ...before },
      afterJson: { roleCode: role.code, ...after },
    });

    return {
      id: role.id,
      code: role.code,
      nameAr: role.nameAr,
      ...after,
      permissions: role.permissions.map((rp) => rp.permission),
    };
  }

  async list(query: QueryUsersDto, companyId: number | null = null) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where = {
      ...tenantWhere(companyId),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' as const } },
              { email: { contains: query.q, mode: 'insensitive' as const } },
              { phone: { contains: query.q, mode: 'insensitive' as const } },
              { repCode: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.roleCode ? { role: { code: query.roleCode } } : {}),
      ...(query.active ? { active: query.active === 'true' } : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: { ...SAFE_SELECT, role: { select: { code: true, nameAr: true } } },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: number, companyId: number | null = null) {
    const user = await this.prisma.user.findFirst({
      where: { id, ...tenantWhere(companyId) },
      select: {
        ...SAFE_SELECT,
        role: { select: { code: true, nameAr: true } },
      },
    });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  private async resolveBranch(branchId: number | null | undefined, companyId: number | null) {
    if (branchId == null) return null;
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, ...tenantWhere(companyId) },
    });
    if (!branch) throw new BadRequestException(`Branch #${branchId} not found`);
    return branch.id;
  }

  async create(dto: CreateUserDto, actorId?: number, companyId: number | null = null) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Provide email or phone');
    }
    const role = await this.resolveRole(dto.roleCode);
    const branchId = await this.resolveBranch(dto.branchId, companyId);

    const created = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        repCode: dto.repCode,
        branchId,
        companyId,
        roleId: role.id,
        passwordHash: await hash(dto.password, 10),
        maxItemDiscountPct: dto.maxItemDiscountPct ?? 0,
        maxInvoiceDiscountPct: dto.maxInvoiceDiscountPct ?? 0,
        active: dto.active ?? true,
      },
      select: { ...SAFE_SELECT, role: { select: { code: true, nameAr: true } } },
    });
    await this.audits.write({
      userId: actorId,
      action: 'user.create',
      entity: 'User',
      entityId: created.id,
      afterJson: { name: created.name, roleCode: created.role.code, branchId: created.branchId, active: created.active },
    });
    return created;
  }

  async update(id: number, dto: UpdateUserDto, actorId?: number, companyId: number | null = null) {
    const before = await this.findOne(id, companyId);

    const data: Record<string, unknown> = {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      repCode: dto.repCode,
      maxItemDiscountPct: dto.maxItemDiscountPct,
      maxInvoiceDiscountPct: dto.maxInvoiceDiscountPct,
      active: dto.active,
    };
    if (dto.branchId !== undefined) data.branchId = await this.resolveBranch(dto.branchId, companyId);
    if (dto.roleCode) data.roleId = (await this.resolveRole(dto.roleCode)).id;
    if (dto.password) data.passwordHash = await hash(dto.password, 10);

    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data,
        select: { ...SAFE_SELECT, role: { select: { code: true, nameAr: true } } },
      });
      await this.audits.write({
        userId: actorId,
        action: 'user.update',
        entity: 'User',
        entityId: id,
        beforeJson: { name: before.name, roleCode: before.role.code, branchId: before.branchId, active: before.active, maxItemDiscountPct: before.maxItemDiscountPct, maxInvoiceDiscountPct: before.maxInvoiceDiscountPct },
        afterJson: { name: updated.name, roleCode: updated.role.code, branchId: updated.branchId, active: updated.active, maxItemDiscountPct: updated.maxItemDiscountPct, maxInvoiceDiscountPct: updated.maxInvoiceDiscountPct, passwordChanged: Boolean(dto.password) },
      });
      return updated;
    } catch (e) {
      if (isUniqueError(e)) throw new ConflictException('email/phone/repCode already in use');
      throw e;
    }
  }

  /** إيقاف مستخدم (soft delete) مع حماية من تعطيل آخر مسؤول. */
  async remove(id: number, actorId: number, isAdmin: boolean, companyId: number | null = null) {
    if (id === actorId) {
      throw new BadRequestException('You cannot disable your own account');
    }
    const target = await this.findOne(id, companyId);

    const activeAdmins = await this.prisma.user.count({
      where: { active: true, role: { code: 'ADMIN' }, ...tenantWhere(companyId) },
    });
    if (isAdmin && target.active && target.role.code === 'ADMIN' && activeAdmins <= 1) {
      throw new ConflictException('Cannot disable the last active admin');
    }

    await this.prisma.user.update({ where: { id }, data: { active: false } });
    await this.audits.write({
      userId: actorId,
      action: 'user.disable',
      entity: 'User',
      entityId: id,
      beforeJson: { active: target.active },
      afterJson: { active: false },
    });
    return { ok: true };
  }

  async getProfile(userId: number, companyId: number | null = null) {
    return this.findOne(userId, companyId);
  }

  async updateProfile(userId: number, dto: UpdateSelfProfileDto, companyId: number | null = null) {
    const before = await this.findOne(userId, companyId);
    const data: { name?: string; email?: string | null; phone?: string | null } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.email !== undefined) data.email = dto.email.trim() || null;
    if (dto.phone !== undefined) data.phone = dto.phone.trim() || null;

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data,
        select: {
          ...SAFE_SELECT,
          role: { select: { code: true, nameAr: true } },
          branch: { select: { id: true, nameAr: true, code: true } },
        },
      });

      await this.audits.write({
        userId,
        action: 'user.profile.update',
        entity: 'User',
        entityId: userId,
        beforeJson: { name: before.name, email: before.email, phone: before.phone },
        afterJson: { name: updated.name, email: updated.email, phone: updated.phone },
      });

      return updated;
    } catch (e) {
      if (isUniqueError(e)) {
        throw new ConflictException('البريد الإلكتروني أو رقم الهاتف مستخدم بالفعل');
      }
      throw e;
    }
  }

  async changePassword(userId: number, dto: ChangePasswordDto, companyId: number | null = null) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, ...tenantWhere(companyId) },
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    const matches = await compare(dto.currentPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestException('كلمة المرور الحالية غير صحيحة');
    }

    const newHash = await hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await this.audits.write({
      userId,
      action: 'user.password.change',
      entity: 'User',
      entityId: userId,
      afterJson: { passwordChanged: true },
    });

    return { ok: true, message: 'تم تحديث كلمة المرور بنجاح' };
  }

  private async resolveRole(code: string) {
    const role = await this.prisma.role.findUnique({ where: { code } });
    if (!role) throw new NotFoundException(`Role ${code} not found`);
    return role;
  }
}