import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { AuthUser } from '../auth/auth.decorators.js';
import { setTenant } from './tenant.context.js';

/** بعد المصادقة، يثبّت معرّف شركة المستخدم على سياق الطلب لبقية السلسلة. */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    setTenant({ companyId: request.user?.companyId ?? null });
    return next.handle();
  }
}
