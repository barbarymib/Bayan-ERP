import { Injectable, NotFoundException } from '@nestjs/common';
import type { NotificationModel } from '../generated/prisma/models/Notification.js';

type Notification = NotificationModel;
import { PrismaService } from '../prisma/prisma.module.js';
import { currentCompanyId } from '../tenant/tenant.context.js';
import type { QueryNotificationsDto } from './notifications.dto.js';

export type NotificationType =
  | 'discount_approval'
  | 'return_approval'
  | 'low_stock'
  | 'credit_limit'
  | 'sync_failed'
  | 'archive_reminder'
  | 'backup_reminder';

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body?: string;
  refType?: string;
  refId?: number;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: number, query: QueryNotificationsDto) {
    const { limit, unreadOnly } = query;
    const where = { userId, ...(unreadOnly ? { readAt: null } : {}) };
    const [items, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit ?? 25,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { total, unread, items };
  }

  async unreadCount(userId: number) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: number, id: number) {
    const found = await this.prisma.notification.findUnique({ where: { id } });
    if (!found || found.userId !== userId) throw new NotFoundException(`Notification ${id} not found`);
    if (!found.readAt) {
      await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    }
    return { id, read: true };
  }

  async markAllRead(userId: number) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { read: count };
  }

  async notify(userId: number, input: NotificationInput): Promise<Notification> {
    return this.prisma.notification.create({
      data: { userId, ...input, refId: input.refId ?? null, refType: input.refType ?? null },
    });
  }

  async notifyMany(userIds: number[], input: NotificationInput) {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return 0;
    const { count } = await this.prisma.notification.createMany({
      data: unique.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
      })),
    });
    return count;
  }

  /** مستخدمو الأدوار الحاملون لصلاحية معينة (نشطون فقط، ومقيّدون بالشركة). */
  async userIdsWithPermission(
    permissionCode: string,
    companyId: number | null = currentCompanyId(),
  ): Promise<number[]> {
    const users = await this.prisma.user.findMany({
      where: {
        active: true,
        ...(companyId == null ? {} : { companyId }),
        role: { permissions: { some: { permission: { code: permissionCode } } } },
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  /**
   * إشعارات آلية مجمّعة (§5.15): أصناف تحت الحد، تجاوز حد ائتماني، مرتجعات منتظرة،
   * وتذكير بالترحيل والنسخ الاحتياطي. يتجاهل الصف المكرر غير المقروء (نفس النوع خلال يوم).
   */
  async refreshAlerts(companyId: number | null = currentCompanyId()) {
    const created = {
      low_stock: 0,
      credit_limit: 0,
      return_approval: 0,
      archive_reminder: 0,
      backup_reminder: 0,
    };
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const tenant = companyId == null ? {} : { companyId };

    const recent = async (userId: number, type: string) =>
      this.prisma.notification.findFirst({ where: { userId, type, readAt: null, createdAt: { gt: dayAgo } } });

    // أصناف تحت الحد الأدنى — جمع على مستوى قاعدة البيانات (لا قائمة معرّفات ضخمة: G25/R3-E8).
    const lowRows =
      companyId == null
        ? await this.prisma.$queryRaw<
            { id: number; code: string; nameAr: string; minStock: unknown; qty: unknown }[]
          >`SELECT i.id, i.code, i."nameAr", i."minStock" AS "minStock", COALESCE(SUM(sb."qtyBase"), 0) AS qty
              FROM "Item" i
              LEFT JOIN "StockBalance" sb ON sb."itemId" = i.id
              WHERE i.active AND i."minStock" > 0
              GROUP BY i.id
              HAVING COALESCE(SUM(sb."qtyBase"), 0) < i."minStock"`
        : await this.prisma.$queryRaw<
            { id: number; code: string; nameAr: string; minStock: unknown; qty: unknown }[]
          >`SELECT i.id, i.code, i."nameAr", i."minStock" AS "minStock", COALESCE(SUM(sb."qtyBase"), 0) AS qty
              FROM "Item" i
              LEFT JOIN "StockBalance" sb ON sb."itemId" = i.id
              WHERE i.active AND i."minStock" > 0 AND i."companyId" = ${companyId}
              GROUP BY i.id
              HAVING COALESCE(SUM(sb."qtyBase"), 0) < i."minStock"`;
    const below = lowRows.map((r) => ({
      id: r.id,
      code: r.code,
      nameAr: r.nameAr,
      minStock: Number(r.minStock),
      qty: Number(r.qty),
    }));
    if (below.length) {
      const targets = await this.userIdsWithPermission('warehouse.manage', companyId);
      for (const u of targets) {
        if (await recent(u, 'low_stock')) continue;
        created.low_stock += (await this.notify(u, {
          type: 'low_stock',
          title: `أصناف تحت الحد الأدنى (${below.length})`,
          body: below
            .slice(0, 5)
            .map((i) => `${i.nameAr} (${i.code}): ${i.qty} من حد ${i.minStock}`)
            .join('، '),
        })) ? 1 : 0;
      }
    }

    // تجاوز الحد الائتماني (الرصيد = الافتتاحي + مدين − دائن) — جمع على مستوى قاعدة البيانات.
    const over =
      companyId == null
        ? await this.prisma.$queryRaw<
            { id: number; code: string; nameAr: string; creditLimit: unknown; balance: unknown }[]
          >`SELECT c.id, c.code, c."nameAr", c."creditLimit", 
                 COALESCE(c."openingBalance", 0) + COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) AS balance
              FROM "Customer" c
              LEFT JOIN "LedgerEntry" le ON le."accountType" = 'CUSTOMER' AND le."accountId" = c.id
              WHERE c."creditLimit" > 0
              GROUP BY c.id
              HAVING COALESCE(c."openingBalance", 0) + COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) > c."creditLimit"`
        : await this.prisma.$queryRaw<
            { id: number; code: string; nameAr: string; creditLimit: unknown; balance: unknown }[]
          >`SELECT c.id, c.code, c."nameAr", c."creditLimit",
                 COALESCE(c."openingBalance", 0) + COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) AS balance
              FROM "Customer" c
              LEFT JOIN "LedgerEntry" le ON le."accountType" = 'CUSTOMER' AND le."accountId" = c.id
              WHERE c."creditLimit" > 0 AND c."companyId" = ${companyId}
              GROUP BY c.id
              HAVING COALESCE(c."openingBalance", 0) + COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) > c."creditLimit"`;
    const overRows = over.map((c) => ({
      id: c.id,
      code: c.code,
      nameAr: c.nameAr,
      creditLimit: Number(c.creditLimit),
      balance: Number(c.balance),
    }));
    if (overRows.length) {
      const targets = await this.userIdsWithPermission('ledger.view', companyId);
      for (const u of targets) {
        if (await recent(u, 'credit_limit')) continue;
        created.credit_limit += (await this.notify(u, {
          type: 'credit_limit',
          title: `تجاوز حد ائتماني (${overRows.length})`,
          body: overRows
            .slice(0, 5)
            .map((c) => `${c.nameAr} (${c.code}): رصيد ${c.balance.toFixed(2)} / حد ${c.creditLimit.toFixed(2)}`)
            .join('، '),
        })) ? 1 : 0;
      }
    }

    // مرتجعات بانتظار الاعتماد
    const pendingReturns = await this.prisma.approval.count({
      where: { type: 'RETURN', status: 'PENDING', ...tenant },
    });
    if (pendingReturns > 0) {
      const targets = await this.userIdsWithPermission('return.approve', companyId);
      for (const u of targets) {
        if (await recent(u, 'return_approval')) continue;
        created.return_approval += (await this.notify(u, {
          type: 'return_approval',
          title: 'مرتجعات بانتظار الاعتماد',
          body: `عدد مرتجعات بانتظار الاعتماد: ${pendingReturns}`,
        })) ? 1 : 0;
      }
    }

    // تذكير بالترحيل الدوري (آخر عملية أرشفة قبل 30 يوماً)
    const lastArchive = await this.prisma.archiveRun.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!lastArchive || lastArchive.createdAt.getTime() < Date.now() - 30 * 24 * 3600 * 1000) {
      const targets = await this.userIdsWithPermission('archive.run', companyId);
      for (const u of targets) {
        if (await recent(u, 'archive_reminder')) continue;
        created.archive_reminder += (await this.notify(u, {
          type: 'archive_reminder',
          title: 'تذكير بالترحيل الدوري',
          body: 'مر أكثر من 30 يوماً على آخر عملية أرشفة — يُنصح بإغلاق فترة وترحيلها.',
        })) ? 1 : 0;
      }
    }

    // تذكير بالنسخ الاحتياطي (لا نسخة خلال آخر 24 ساعة)
    const lastBackup = await this.prisma.automatedBackup.findFirst({
      where: { status: 'DONE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!lastBackup || lastBackup.createdAt.getTime() < Date.now() - 24 * 3600 * 1000) {
      const targets = await this.userIdsWithPermission('user.manage', companyId);
      for (const u of targets) {
        if (await recent(u, 'backup_reminder')) continue;
        created.backup_reminder += (await this.notify(u, {
          type: 'backup_reminder',
          title: 'تذكير بالنسخ الاحتياطي',
          body: 'لا توجد نسخة احتياطية مُنجزة خلال آخر 24 ساعة — شغّل نسخة دورية.',
        })) ? 1 : 0;
      }
    }

    return created;
  }
}