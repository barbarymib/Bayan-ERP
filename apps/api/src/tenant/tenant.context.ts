import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  companyId: number | null;
}

const storage = new AsyncLocalStorage<TenantContext>();

/** ينشئ سياق المستأجر للطلب الحالي. */
export function runWithTenant<T>(context: TenantContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** يثبّت سياق المستأجر على السياق غير المتزامن الحالي. */
export function setTenant(context: TenantContext): void {
  storage.enterWith(context);
}

/** معرّف الشركة الحالية، أو null خارج نطاق طلب مصادَق عليه. */
export function currentCompanyId(): number | null {
  return storage.getStore()?.companyId ?? null;
}
