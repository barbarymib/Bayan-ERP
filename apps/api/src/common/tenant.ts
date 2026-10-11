import type { AuthUser } from '../auth/auth.decorators.js';

/** قيد استعلامات متعدد المستأجرين: يضيف شرط companyId. null = دون قيد (صفوف عامة). */
export const tenantWhere = (companyId: number | null): object =>
  companyId == null ? {} : { companyId };

/** معرف الشركة من كائن المستخدم في التوكن. */
export const tenantId = (user: AuthUser | null | undefined): number | null =>
  user?.companyId ?? null;