import { Prisma } from '../generated/prisma/client.js';
import { currentCompanyId } from './tenant.context.js';

/** الإعداد (GUC) الذي تقرأه سياسات RLS لمعرفة الشركة الحالية. */
export const TENANT_SETTING = 'app.current_company_id';

/**
 * جداول تملك عمود companyId وتخضع لسياسات RLS (أسماء النماذج PascalCase).
 * لا تشمل: User و CompanyFeature (يُقرآن قبل تهيئة السياق) وجداول الضبط
 * والكتالوج العام، والجداول الابنة بلا companyId (تُحمى عبر أبائها).
 */
export const RLS_MODELS: ReadonlySet<string> = new Set([
  'Approval',
  'Branch',
  'Brand',
  'CashAccount',
  'Category',
  'Cheque',
  'Customer',
  'CustomerGroup',
  'CustomerRepAssignment',
  'CustodyHandover',
  'DailyClose',
  'DeviceRegistration',
  'Item',
  'ItemPrice',
  'LedgerEntry',
  'NumberBlock',
  'OpeningBalance',
  'Payment',
  'Period',
  'PriceHistory',
  'PriceList',
  'PriceStatement',
  'PurchaseOrder',
  'PurchaseStatement',
  'Quotation',
  'Receipt',
  'RepLocation',
  'RepShift',
  'RepTarget',
  'RepVisit',
  'ReturnStatement',
  'SpecialPrice',
  'StockBalance',
  'StockMovement',
  'StockReservation',
  'StockTransfer',
  'StocktakeSession',
  'Supplier',
  'SupplierReturn',
  'VisitPlan',
  'Warehouse',
]);

export type TenantTransactionRunner = <T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
) => Promise<T>;

export interface TenantRlsDeps {
  /** ينفّذ callback داخل معاملة أصلية (غير ملتفّة) لتجنّب الالتفاف المتداخل. */
  runTransaction: TenantTransactionRunner;
}

/** يضبط GUC الشركة داخل معاملة/جلسة، ويمرّر '' لتفعيل الإغلاق الافتراضي. */
export async function setTenantGuc(
  tx: Prisma.TransactionClient,
  companyId: number | null,
): Promise<void> {
  const value = companyId == null ? '' : String(companyId);
  await tx.$executeRaw`SELECT set_config(${TENANT_SETTING}, ${value}, true)`;
}

/** يبني جملة set_config كـ PrismaPromise لتُدرج في صفّ معاملات مصفوفي. */
export function buildTenantGuc(
  executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<number>,
  companyId: number | null,
) {
  const value = companyId == null ? '' : String(companyId);
  return executeRaw`SELECT set_config(${TENANT_SETTING}, ${value}, true)`;
}

interface QueryArgs {
  model?: string;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown> | Prisma.PrismaPromise<unknown>;
}

/** يلفّ عمليات النماذج المحمية بمعاملة تحمل GUC الشركة الحالية. */
export function makeTenantQueryHandler(deps: TenantRlsDeps) {
  return function $allOperations({ model, operation, args, query }: QueryArgs) {
    if (!model || !RLS_MODELS.has(model)) {
      return query(args);
    }

    const delegate = model.charAt(0).toLowerCase() + model.slice(1);
    const companyId = currentCompanyId();
    return deps.runTransaction(async (tx) => {
      await setTenantGuc(tx, companyId);
      const record = tx as unknown as Record<string, Record<string, (a: unknown) => Prisma.PrismaPromise<unknown>>>;
      return record[delegate]![operation]!(args);
    });
  };
}

export function tenantRlsExtension(deps: TenantRlsDeps) {
  return Prisma.defineExtension({
    name: 'bayan.tenant-rls',
    query: { $allOperations: makeTenantQueryHandler(deps) as never },
  });
}
