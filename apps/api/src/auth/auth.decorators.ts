import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** تعليم مسار كعام (بدون توكن) */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSIONS_KEY = 'requiredPermissions';
/** تتطلب صلاحيات محددة (من مصفوفة §4.2) */
export const Permissions = (...codes: string[]) => SetMetadata(PERMISSIONS_KEY, codes);

export const GLOBAL_ADMIN_KEY = 'globalAdminOnly';
/** مسار للمشرف العام للبيئة فقط (SaaS §12.4) */
export const GlobalAdmin = () => SetMetadata(GLOBAL_ADMIN_KEY, true);

export const FEATURES_KEY = 'requiredFeatures';
/** يتطلب أن تكون ميزات محددة مفعّلة للمستخدم (Feature Flags §12.3) */
export const Features = (...codes: string[]) => SetMetadata(FEATURES_KEY, codes);

export interface AuthUser {
  id: number;
  sub: number;
  name: string;
  roleCode: string;
  repCode: string | null;
  permissions: string[];
  // حدود الخصم المسموح لكل مستخدم (تجاوزها يطلب موافقة)
  maxItemDiscountPct: number;
  maxInvoiceDiscountPct: number;
  // إطار الـ SaaS: نطاق التوكن وشركة المستخدم
  scope?: 'tenant' | 'global';
  username?: string;
  companyId?: number | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthUser;
  },
);
