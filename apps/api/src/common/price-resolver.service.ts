import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from './tenant.js';

export interface ResolvePriceArgs {
  itemId: number;
  unitId: number;
  /** معرّف العميل — لاختيار السعر الخاص الموجّه له */
  customerId?: number | null;
  /** قائمة أسعار العميل — لاختيار السعر الخاص بها ثم قائمة الأسعار */
  priceListId?: number | null;
  companyId?: number | null;
}

/**
 * تسعير الصنف (§5.16 الأسعار الخاصة): يُرجع السعر الخاص إن وُجد
 * حسب الأولوية (عميل > مجموعة عملاء > قائمة أسعار > عام)، وإلا
 * يرجع سعر قائمة الأسعار، وإلا undefined ليقرر النادي خطأً.
 */
@Injectable()
export class PriceResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(args: ResolvePriceArgs): Promise<number | undefined> {
    const now = new Date();
    let priceListId = args.priceListId ?? null;
    let groupId: number | null = null;

    if (args.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: args.customerId, ...tenantWhere(args.companyId ?? null) },
        select: { customerGroupId: true, priceListId: true },
      });
      groupId = customer?.customerGroupId ?? null;
      if (priceListId == null) priceListId = customer?.priceListId ?? null;
    }

    const special = await this.findSpecial(args.itemId, args.unitId, {
      customerId: args.customerId ?? null,
      groupId,
      priceListId,
      now,
      companyId: args.companyId ?? null,
    });
    if (special !== undefined) return special;

    if (priceListId == null) return undefined;

    const price = await this.prisma.itemPrice.findFirst({
      where: {
        itemId: args.itemId,
        unitId: args.unitId,
        priceListId,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
        ...tenantWhere(args.companyId ?? null),
      },
      orderBy: { validFrom: 'desc' },
    });
    return price ? Number(price.price) : undefined;
  }

  private async findSpecial(
    itemId: number,
    unitId: number,
    scope: {
      customerId: number | null;
      groupId: number | null;
      priceListId: number | null;
      now: Date;
      companyId: number | null;
    },
  ): Promise<number | undefined> {
    const or: object[] = [{ customerId: null, customerGroupId: null, priceListId: null }];
    if (scope.customerId != null) or.push({ customerId: scope.customerId });
    if (scope.groupId != null) or.push({ customerGroupId: scope.groupId });
    if (scope.priceListId != null) or.push({ priceListId: scope.priceListId });

    const rows = await this.prisma.specialPrice.findMany({
      where: {
        itemId,
        unitId,
        active: true,
        validFrom: { lte: scope.now },
        AND: [{ OR: [{ validTo: null }, { validTo: { gte: scope.now } }] }, { OR: or }],
        ...tenantWhere(scope.companyId),
      },
      orderBy: { validFrom: 'desc' },
    });

    const pick =
      rows.find((r) => r.customerId != null && r.customerId === scope.customerId) ??
      rows.find((r) => r.customerGroupId != null && r.customerGroupId === scope.groupId) ??
      rows.find((r) => r.priceListId != null && r.priceListId === scope.priceListId) ??
      rows.find((r) => r.customerId == null && r.customerGroupId == null && r.priceListId == null);

    return pick ? Number(pick.price) : undefined;
  }
}
