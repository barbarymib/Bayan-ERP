import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.decorators.js';
import type { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from './tenant.js';

/**
 * نطاق المندوب (§4.2 «عملاؤه»): مستخدم بدور SALES_REP يرى/ينشئ فقط للعملاء
 * المسنَدين إليه (CustomerRepAssignment نشط). بقية الأدوار (مبيعات مكتب،
 * مشرف، محاسب، مدير، مالك) بلا تقييد.
 */
export function isRepScoped(user: AuthUser): boolean {
  return user.roleCode === 'SALES_REP';
}

/** معرّفات العملاء المسنَدين حالياً للمندوب. */
export async function assignedCustomerIds(
  prisma: PrismaService,
  user: AuthUser,
  companyId: number | null,
): Promise<number[]> {
  const rows = await prisma.customerRepAssignment.findMany({
    where: { repId: user.id, toDate: null, ...tenantWhere(companyId) },
    select: { customerId: true },
  });
  return rows.map((r) => r.customerId);
}

/** يرفض (403، أو 404 عند hideAsNotFound) محاولة مندوب العمل على عميل غير مسنَد إليه. */
export async function assertCustomerInScope(
  prisma: PrismaService,
  customerId: number | null,
  user: AuthUser,
  companyId: number | null,
  hideAsNotFound = false,
): Promise<void> {
  if (!isRepScoped(user)) return;
  const link =
    customerId == null
      ? null
      : await prisma.customerRepAssignment.findFirst({
          where: { repId: user.id, customerId, toDate: null, ...tenantWhere(companyId) },
          select: { id: true },
        });
  if (!link) {
    if (hideAsNotFound) throw new NotFoundException();
    throw new ForbiddenException(`Customer ${String(customerId)} is not assigned to you (مندوب — عملاؤه فقط)`);
  }
}

/**
 * فلتر عملاء للقوائم: للمندوب يُقيّد على عملائه المسنَدين (وإن طلب عميلاً
 * خارج نطاقه يُعيد معرّفاً مستحيلاً → نتيجة فارغة). لغير المندوب: يمرّر الفلتر كما هو.
 */
export async function repCustomerFilter(
  prisma: PrismaService,
  user: AuthUser,
  companyId: number | null,
  requestedCustomerId?: number,
): Promise<{ customerId?: number | { in: number[] } }> {
  if (!isRepScoped(user)) {
    return requestedCustomerId != null ? { customerId: requestedCustomerId } : {};
  }
  const ids = await assignedCustomerIds(prisma, user, companyId);
  if (requestedCustomerId != null) {
    return { customerId: ids.includes(requestedCustomerId) ? requestedCustomerId : -1 };
  }
  return { customerId: { in: ids } };
}
