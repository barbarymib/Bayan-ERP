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
  options?: { timeout?: number; maxWait?: number },
) => Promise<T>;

/** مهلة معاملة اللف الزمني (R3-E8): تقارير ثقيلة على 50k صف تتجاوز المهلة الافتراضية 5s. */
export const TENANT_TX_TIMEOUT_MS = Number(process.env.PRISMA_TX_TIMEOUT_MS ?? 20000);
export const TENANT_TX_MAXWAIT_MS = Number(process.env.PRISMA_TX_MAXWAIT_MS ?? 10000);

export const tenantTxOptions = (): { timeout: number; maxWait: number } => ({
  timeout: TENANT_TX_TIMEOUT_MS,
  maxWait: TENANT_TX_MAXWAIT_MS,
});

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

/**
 * يلفّ كل عمليات النماذج بمعاملة تحمل GUC الشركة الحالية. اللف ضروري حتى للجداول
 * الابنة بلا companyId لأن عملياتها قد تجلب علاقات إلى جداول RLS (مثل
 * priceStatementLine → statement)، وتلك العلاقات تُنفَّذ على نفس الاتصال وبالـ GUC
 * عند الاقتصاد بالمعاملة. النماذج غير المحمية تتحمل معاملة إضافية بلا ضرر.
 */
export function makeTenantQueryHandler(deps: TenantRlsDeps) {
  return function $allOperations({ model, operation, args, query }: QueryArgs) {
    if (!model) {
      return query(args);
    }

    const delegate = model.charAt(0).toLowerCase() + model.slice(1);
    const companyId = currentCompanyId();
    return deps.runTransaction(async (tx) => {
      await setTenantGuc(tx, companyId);
      const record = tx as unknown as Record<string, Record<string, (a: unknown) => Prisma.PrismaPromise<unknown>>>;
      return record[delegate]![operation]!(args);
    }, tenantTxOptions());
  };
}

export function tenantRlsExtension(deps: TenantRlsDeps) {
  return Prisma.defineExtension({
    name: 'bayan.tenant-rls',
    query: { $allOperations: makeTenantQueryHandler(deps) as never },
  });
}
