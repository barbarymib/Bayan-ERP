export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

export type AuthUser = {
  id: number;
  sub: number;
  name: string;
  roleCode: string;
  repCode: string | null;
  permissions: string[];
};

export interface Unit {
  id: number;
  code: string;
  nameAr: string | null;
  nameEn: string | null;
  measurement: string;
}

export interface Category {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string | null;
  parentId: number | null;
}

export interface PriceList {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string | null;
}

export interface UserBrief {
  id: number;
  name: string;
  repCode: string | null;
}

export interface ItemUnit {
  id: number;
  unitId: number;
  unit: Unit;
  factorToBase: string;
  barcode: string | null;
  isSale: boolean;
  isPurchase: boolean;
  allowDecimal: boolean;
}

export interface ItemAttribute {
  id: number;
  key: string;
  value: string;
}

export interface Item {
  id: number;
  code: string;
  barcode: string | null;
  nameAr: string;
  nameEn: string | null;
  category: Category | null;
  baseUnit: Unit;
  itemUnits: ItemUnit[];
  attributes: ItemAttribute[];
  minStock: string;
  trackBatch: boolean;
  active: boolean;
}

// دفعة صنف (اختياري §5.1): كود + تواريخ الإنتاج/الصلاحية
export interface Batch {
  id: number;
  itemId: number;
  code: string;
  productionDate: string | null;
  expiry: string | null;
  notes: string | null;
  active: boolean;
  item?: { id: number; code: string; nameAr: string; trackBatch: boolean };
}

export interface BatchesPage {
  batches: Batch[];
  total: number;
}

export interface Customer {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string | null;
  activity: string | null;
  phone: string | null;
  taxNumber: string | null;
  creditLimit: string;
  creditDays: number | null;
  classification: string;
  paymentRating: number | null;
  paymentNotes: string | null;
  priceList: PriceList | null;
  rep: UserBrief | null;
  active: boolean;
}

export interface Supplier {
  id: number;
  code: string;
  nameAr: string;
  phone: string | null;
  address: string | null;
  active: boolean;
}

export interface Warehouse {
  id: number;
  code: string;
  nameAr: string;
  type: string;
  keeper: UserBrief | null;
  active: boolean;
}

export interface Role {
  id: number;
  code: string;
  nameAr: string;
  maxItemDiscountPct: number | null;
  maxInvoiceDiscountPct: number | null;
  permissions: { code: string; nameAr: string }[];
}

export interface Permission {
  code: string;
  nameAr: string;
}

export interface ItemBrief {
  id: number;
  code: string;
  barcode: string | null;
  nameAr: string;
  nameEn: string | null;
  active?: boolean;
}

export type StatementStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'ARCHIVED' | 'CANCELLED';

export interface PriceStatementLine {
  id: number;
  item: ItemBrief;
  unit: Unit;
  factor: string;
  qty: string;
  qtyBase: string;
  unitPrice: string;
  lineDiscountType: 'PERCENT' | 'AMOUNT' | null;
  lineDiscountValue: string | null;
  lineDiscountAmount: string;
  allocatedHeaderDiscount: string;
  netLine: string;
  costSnapshot: string | null;
  weightNote: string | null;
}

export interface Approval {
  id: number;
  type: 'ITEM_DISCOUNT' | 'HEADER_DISCOUNT' | 'BELOW_COST' | 'RETURN';
  refType: 'price_statement' | 'return_statement';
  refId: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy?: { id: number; name: string; repCode: string | null };
  decidedBy?: { id: number; name: string } | null;
  note?: string | null;
  document?: { number: string; label: string } | null;
  createdAt: string;
  refJson?: unknown;
}

export interface PriceStatement {
  id: number;
  number: string;
  status: StatementStatus;
  paymentTerm: string;
  date: string;
  customer: Customer;
  warehouse: Warehouse;
  createdBy?: { id: number; name: string };
  approvedBy?: { id: number; name: string } | null;
  createdById?: number;
  repId?: number | null;
  subtotal: string;
  discountType: 'PERCENT' | 'AMOUNT' | null;
  discountValue: string | null;
  discountAmount: string;
  shipping: string;
  taxPercent: string;
  taxAmount: string;
  net: string;
  paid: string;
  notes: string | null;
  lines: PriceStatementLine[];
  approvals?: Approval[];
  creditWarning?: { creditLimit: number; projectedBalance: number; exceeded?: boolean } | null;
  freezeWarning?: string | null;
  createdAt?: string;
  updatedAt?: string;
  ageDays?: number;
  isStaleDraft?: boolean;
  staleDraftDays?: number;
  _count?: { lines: number };
}

export interface StatementsPage {
  total: number;
  items: PriceStatement[];
  staleDraftDays?: number;
}

export type ReturnStatus = 'DRAFT' | 'APPROVED' | 'CANCELLED';

export type ReturnSettlement = 'BALANCE' | 'CASH' | 'CREDIT';

export interface ReturnLine {
  id: number;
  sourceLineId: number;
  item: ItemBrief;
  unit: Unit;
  qty: string;
  qtyBase: string;
  unitNetPrice: string;
  lineTotal: string;
  condition: 'GOOD' | 'DAMAGED';
  sourceLine?: { id: number; statement: { id: number; number: string; date: string } };
}

export interface ReturnStatementDoc {
  id: number;
  number: string;
  mode: 'BY_CUSTOMER' | 'BY_REP';
  status: ReturnStatus;
  customer: Customer;
  reason: { code: string; nameAr: string } | null;
  rep?: { id: number; name: string } | null;
  approvedBy?: { id: number; name: string } | null;
  date: string;
  total: string;
  notes: string | null;
  settlement: ReturnSettlement;
  withoutStatement: boolean;
  lines: ReturnLine[];
  approvals?: Approval[];
  _count?: { lines: number };
}

export interface ReturnsPage {
  total: number;
  items: ReturnStatementDoc[];
}

export interface PurchaseLine {
  id: number;
  item: ItemBrief;
  unit: Unit;
  qty: string;
  qtyBase: string;
  unitPrice: string;
  lineDiscountAmount: string;
  netLine: string;
  landedCost: string | null;
  batchId?: string;
}

export interface PurchaseStatementDoc {
  id: number;
  number: string;
  status: string;
  date: string;
  supplier: Supplier;
  warehouse: Warehouse;
  subtotal: string;
  discountAmount: string;
  shipping: string;
  net: string;
  paid: string;
  notes: string | null;
  lines?: PurchaseLine[];
  freezeWarning?: string | null;
  _count?: { lines: number };
}

export interface PurchasesPage {
  items: PurchaseStatementDoc[];
}

export interface ReceiptAllocation {
  id: number;
  receiptId?: number;
  statementId: number;
  amount: string;
  statement?: { id: number; number: string; net: string };
}

export interface ChequeDoc {
  id: number;
  number: string;
  bankName: string;
  dueDate: string;
  amount: string;
  status: 'UNDER_COLLECTION' | 'COLLECTED' | 'RETURNED';
  collectedAt: string | null;
  customer?: Customer | null;
  supplier?: Supplier | null;
}

export interface ReceiptDoc {
  id: number;
  number: string;
  customer: Customer;
  amount: string;
  method: string;
  receivedAt: string;
  notes: string | null;
  chequeId: number | null;
  cheque: ChequeDoc | null;
  allocations: ReceiptAllocation[];
}

export interface PaymentDoc {
  id: number;
  number: string;
  supplier: Supplier;
  amount: string;
  method: string;
  paidAt: string;
  notes: string | null;
}

export interface CustomerStatement {
  customer: Customer;
  openingBalance: number;
  closingBalance: number;
  migratedOpening: {
    amount: number;
    runId: number;
    runCode: string;
    fromDate: string;
    toDate: string;
    confirmedAt: string | null;
    bundleAvailable: boolean;
    bundleSha256: string | null;
  } | null;
  movements: {
    id: number;
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    refType: string;
    refId: number;
  }[];
  outstandingStatements: {
    statementId: number;
    number: string;
    date: string;
    net: number;
    paid: number;
    allocated: number;
    returned: number;
    outstanding: number;
  }[];
  totalOutstanding: number;
}

export interface User {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  repCode: string | null;
  role: { code: string; nameAr: string } | null;
  maxItemDiscountPct: string;
  maxInvoiceDiscountPct: string;
  active: boolean;
  createdAt: string;
}

export interface PriceResolve {
  item: { id: number; code: string; nameAr: string };
  unit: { code: string };
  priceList: { id: number; code: string; nameAr: string };
  price: string | null;
  validFrom: string | null;
  validTo: string | null;
}

export interface PriceHistoryEntry {
  id: number;
  itemId: number;
  unit: { code: string; nameAr: string };
  priceList: { code: string; nameAr: string };
  oldPrice: string | null;
  newPrice: string;
  changedBy: { id: number; name: string };
  changedAt: string;
}

export interface BulkResult {
  mode?: 'set' | 'percent' | 'amount';
  applied: number;
  skipped: unknown[];
  details: {
    itemCode: string;
    itemName: string;
    unitCode: string;
    priceListCode: string;
    oldPrice: string | null;
    newPrice: string;
  }[];
}

export interface Page {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ItemsPage extends Page {
  items: Item[];
}

export interface CustomersPage extends Page {
  customers: Customer[];
}

export interface SuppliersPage extends Page {
  suppliers: Supplier[];
}

export interface WarehousesPage extends Page {
  warehouses: Warehouse[];
}

export interface UsersPage extends Page {
  users: User[];
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('bayan_token');
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('bayan_refresh');
}

export function setRefreshToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('bayan_refresh', token);
}

export function syncAuthCookie(): void {
  if (typeof window === 'undefined') return;
  const has = !!(getToken() || getRefreshToken());
  document.cookie = has
    ? 'bayan_auth=1; path=/; samesite=lax; max-age=2592000'
    : 'bayan_auth=; path=/; max-age=0';
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('bayan_token', token);
  syncAuthCookie();
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('bayan_token');
  window.localStorage.removeItem('bayan_refresh');
  syncAuthCookie();
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { accessToken: string; refreshToken: string };
        setToken(data.accessToken);
        setRefreshToken(data.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

function extractMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const msg = (data as { message?: unknown }).message;
  if (Array.isArray(msg)) return msg.join('، ');
  if (typeof msg === 'string') return msg;
  if (msg && typeof msg === 'object') {
    return Object.entries(msg as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('؛ ');
  }
  return fallback;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  return requestWithRetry<T>(path, init, true);
}

async function requestWithRetry<T>(
  path: string,
  init: RequestInit,
  allowRefresh: boolean,
): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (init.body) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    if (res.status === 401) {
      if (allowRefresh && (await tryRefresh())) {
        return requestWithRetry<T>(path, init, false);
      }
      clearToken();
    }
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, extractMessage(data, `فشل الطلب (${res.status})`));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const get = <T>(path: string) => request<T>(path);
export const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const put = <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const del = (path: string) => request<unknown>(path, { method: 'DELETE' });
export const delBody = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'DELETE', body: JSON.stringify(body) });

export const qs = (params: Record<string, string | number | boolean | undefined>): string => {
  const esc = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') esc.set(k, String(v));
  }
  const s = esc.toString();
  return s ? `?${s}` : '';
};

export function can(user: AuthUser | null, permission: string): boolean {
  return !!user && user.permissions.includes(permission);
}

export type StocktakeStatus = 'OPEN' | 'COUNTING' | 'REVIEW' | 'APPROVED' | 'CLOSED';

export interface StocktakeSummary {
  lines: number;
  countedLines: number;
  uncountedLines: number;
  totalDiffQty: number;
  totalDiffValue: number;
  surplusLines: number;
  deficitLines: number;
  surplusQty: number;
  deficitQty: number;
  surplusValue: number;
  deficitValue: number;
  noCostLines: number;
  bigDiffLines: number;
  bigDiffQty: number;
  bigDiffValue: number;
}

export interface StocktakeLine {
  id: number;
  sessionId: number;
  itemId: number;
  item: ItemBrief & { minStock: string; lastPurchaseCost: string | null; trackBatch: boolean };
  batchId: string;
  systemQtyBase: number;
  countedQtyBase: number | null;
  lastCost: number | null;
  diffQty: number;
  diffValue: number;
  recountCount: number;
  counter?: string | null;
  countedById?: number | null;
  countedBy?: { id: number; name: string } | null;
  bigDiff?: boolean;
}

export interface StocktakeSession {
  id: number;
  number: string;
  status: StocktakeStatus;
  scopeJson?: { itemIds?: number[]; categoryIds?: number[]; brandIds?: number[] } | null;
  warehouse: Pick<Warehouse, 'id' | 'code' | 'nameAr'>;
  openedBy: { id: number; name: string };
  approvedBy?: { id: number; name: string } | null;
  openedAt: string;
  approvedAt?: string | null;
  closedAt?: string | null;
  notes?: string | null;
  _count?: { lines: number };
  summary?: StocktakeSummary;
  recount?: { mode: 'WARN' | 'BLOCK'; thresholdValue: number; thresholdQty: number } | null;
  recountWarning?: string | null;
  lines?: StocktakeLine[];
}

export interface StocktakesPage {
  total: number;
  items: StocktakeSession[];
}

export type ValuationMethod = 'LAST' | 'WEIGHTED' | 'SALES';

export interface StockValueRow {
  itemId: number;
  code: string;
  nameAr: string;
  warehouseId: number;
  batchId: string;
  qtyBase: number;
  unitCost: number;
  value: number;
  noPrice: boolean;
}

export interface StockValues {
  method: ValuationMethod;
  methodLabel: string;
  rows: StockValueRow[];
  byItem: { itemId: number; item: { code: string; nameAr: string }; qtyBase: number; value: number }[];
  byWarehouse: { warehouseId: number; warehouse: { code: string; nameAr: string }; qtyBase: number; value: number }[];
  noPriceItems: { itemId: number; code: string; nameAr: string; qtyBase: number }[];
  totals: {
    items: number;
    qtyBase: number;
    value: number;
    noPriceItems: number;
    noPriceLines: number;
    noPriceQtyBase: number;
    noPriceValue: number;
  };
}

export interface ItemWithoutPriceRow {
  itemId: number;
  code: string;
  nameAr: string;
  category: string;
  categoryName: string;
  unit: string;
  unitName: string;
  qtyBase: number;
  methodLabel: string;
}

export interface ItemsWithoutPrice {
  count: number;
  rows: ItemWithoutPriceRow[];
}

export interface MovementRow {
  id: number;
  at: string;
  type: string;
  typeLabel: string;
  refType: string | null;
  refId: number | null;
  item: { id: number; code: string; nameAr: string };
  warehouse: { id: number; code: string; nameAr: string };
  batchId: string;
  qtyBase: number;
  in: number;
  out: number;
  cost: number | null;
  balance: number;
}

export interface Movements {
  count: number;
  rows: MovementRow[];
  totals: { totalIn: number; totalOut: number; net: number };
}

export interface LowStockRow {
  itemId: number;
  item: { code: string; nameAr: string };
  warehouse: { code: string; nameAr: string };
  batchId: string;
  qtyBase: number;
  minStock: number;
  diff: number;
}

export interface LowStock {
  count: number;
  rows: LowStockRow[];
}

export interface StockSummaryRow {
  itemId: number;
  item: { code: string; nameAr: string };
  qtyBase: number;
  value: number;
  lastMovementAt: string | null;
  stagnant: boolean;
}

export interface StockSummaryRep {
  rows: StockSummaryRow[];
  totals: { items: number; qtyBase: number; value: number };
}

export interface DashboardSummary {
  period: { from: string | null; to: string | null };
  sales: { count: number; net: number };
  returns: { count: number; total: number };
  receipts: { count: number; amount: number };
  payments: { count: number; amount: number };
  pendingApprovals: number;
  activeStocktakes: number;
  lowStockCount: number;
  balancesCount: number;
  itemCount: number;
  topItems: { item: { id: number; code: string; nameAr: string } | null; qtyBase: number }[];
  topCustomers: { customer: { id: number; code: string; nameAr: string } | null; net: number }[];
}

export interface GeoRepBrief {
  id: number;
  name: string;
  repCode: string;
  phone?: string | null;
}

export interface GeoMapShift {
  id: number;
  startedAt: string;
  durationMinutes: number;
}

export interface GeoMapLocation {
  lat: number;
  lng: number;
  accuracy?: number | null;
  at: string;
}

export interface GeoMapVisit {
  customer: string;
  at: string;
  status: string;
}

export interface GeoMapEntry {
  rep: GeoRepBrief;
  shift: GeoMapShift | null;
  lastLocation: GeoMapLocation | null;
  lastVisit: GeoMapVisit | null;
  todayVisitCount: number;
  todayDistanceM: number;
}

export interface GeoShiftListItem {
  id: number;
  startedAt: string;
  endedAt: string | null;
  rep: GeoRepBrief;
  _count: { locations: number; visits: number };
}

export interface GeoRoutePoint {
  id: number;
  lat: number;
  lng: number;
  accuracy?: number | null;
  battery?: number | null;
  at: string;
}

export interface GeoRouteVisit {
  id: number;
  customer: string;
  status: string;
  reason?: string | null;
  lat?: number | null;
  lng?: number | null;
  at: string;
  outOfRange: boolean;
}

export interface GeoRoute {
  shift: { id: number; startedAt: string; endedAt: string | null; rep: GeoRepBrief };
  totalDistanceM: number;
  estimatedDwellMinutes: number;
  points: GeoRoutePoint[];
  visits: GeoRouteVisit[];
}

export interface GeoReportRow {
  rep: GeoRepBrief;
  shiftsCount: number;
  closedShifts: number;
  hasActiveShift: boolean;
  totalDistanceM: number;
  totalDwellAtCustomersMinutes: number;
  visitsCount: number;
  missedVisits: number;
  customersAssigned: number;
  customersVisited: number;
  notVisitedCustomers: { id: number; nameAr: string }[];
}

// ============================ Phase 6: Archives ============================

export type ArchiveStatus = 'PRECHECKS' | 'READY' | 'CONFIRMED' | 'RESTORED' | 'FAILED';

export interface ArchiveCheck {
  key: string;
  label: string;
  ok: boolean;
  detail?: string | null;
}

export interface ArchiveFileEntry {
  name: string;
  bytes: number;
  sha256: string;
}

export interface ArchiveManifest {
  code: string;
  fromDate: string;
  toDate: string;
  generatedAt: string;
  counts: Record<string, number>;
  totals: Record<string, number>;
  files: ArchiveFileEntry[];
  labels: Record<string, string>;
}

export interface ArchiveOpeningBalance {
  id: number;
  runId: number;
  kind: 'CUSTOMER' | 'SUPPLIER' | 'ITEM' | 'CASH';
  accountId: number;
  itemId: number | null;
  warehouseId: number | null;
  amount: string;
  qtyBase: string | null;
}

export interface ArchiveRun {
  id: number;
  code: string;
  fromDate: string;
  toDate: string;
  status: ArchiveStatus;
  checks: ArchiveCheck[] | null;
  manifest: ArchiveManifest | null;
  counts: Record<string, unknown> | null;
  bundlePath: string | null;
  bundleSha256: string | null;
  backupPath: string | null;
  note: string | null;
  periodId: number | null;
  createdAt: string;
  confirmedAt: string | null;
  restoredAt: string | null;
  createdBy: { id: number; name: string } | null;
  confirmedBy: { id: number; name: string } | null;
  openingBalances: ArchiveOpeningBalance[];
}

export interface ArchiveSummary {
  lastRun: { code: string; status: string; confirmedAt: string | null; createdAt: string } | null;
  monthsSinceLast: number | null;
  reminder: string | null;
  readyRuns: number;
}

export interface ArchiveRunResult {
  id?: number;
  runId?: number;
  code?: string;
  status?: string;
  message?: string;
  checks: ArchiveCheck[];
  manifest?: ArchiveManifest;
  bundleSha256?: string;
  backupPath?: string | null;
}

export interface ArchiveViewer {
  code: string;
  fromDate: string;
  toDate: string;
  counts: Record<string, number>;
  totals: Record<string, number>;
  labels: Record<string, string>;
  rows: Record<string, Record<string, unknown>[]>;
  truncated: boolean;
}

export interface ArchiveConfirmResult {
  id: number;
  code: string;
  status: string;
  confirmedAt: string;
  deleted: Record<string, number>;
  openingBalances: Record<string, number>;
  rolledLedgerAccounts: number;
  bundleSha256: string;
  bundleSaved: boolean;
  bundleLocation: string | null;
  numberingPeriodMode: string | null;
}

export interface ArchiveRestoreResult {
  id: number;
  code: string;
  status: string;
  restored: Record<string, number>;
}

// ============================ Phase 7 / §5.16 ============================

export interface Branch {
  id: number;
  code: string;
  nameAr: string;
  address: string | null;
  phone: string | null;
  active: boolean;
  createdAt: string;
  _count?: { users?: number; warehouses?: number };
}

export interface BranchesPage {
  branches: Branch[];
  total: number;
}

export interface CustomerGroup {
  id: number;
  code: string;
  nameAr: string;
  active: boolean;
  createdAt: string;
  _count?: { customers?: number };
}

export interface CustomerGroupsPage {
  groups: CustomerGroup[];
  total: number;
}

export interface SpecialPriceRow {
  id: number;
  price: string;
  validFrom: string | null;
  validTo: string | null;
  active: boolean;
  item: ItemBrief;
  unit: Unit;
  customer: { id: number; code: string; nameAr: string } | null;
  customerGroup: { id: number; code: string; nameAr: string } | null;
  priceList: { id: number; code: string; nameAr: string } | null;
}

export interface SpecialPricesPage {
  items: SpecialPriceRow[];
  total: number;
}

export type QuotationStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CONVERTED'
  | 'EXPIRED';

export interface QuotationLine {
  id: number;
  item: ItemBrief;
  unit: Unit;
  qty: string;
  unitPrice: string;
  netLine: string;
}

export interface Quotation {
  id: number;
  number: string;
  status: QuotationStatus;
  effectiveStatus: QuotationStatus;
  date: string;
  validUntil: string | null;
  customer: Customer;
  warehouse: Warehouse | null;
  createdBy?: { id: number; name: string } | null;
  subtotal: string;
  discountAmount: string;
  shipping: string;
  taxPercent: string;
  taxAmount: string;
  net: string;
  notes: string | null;
  convertedStatementId: number | null;
  lines?: QuotationLine[];
  _count?: { lines: number };
}

export interface QuotationsPage {
  total: number;
  items: Quotation[];
}

export interface RepTarget {
  id: number;
  periodType: 'MONTHLY' | 'QUARTERLY' | 'CUSTOM';
  fromDate: string;
  toDate: string;
  targetAmount: string;
  commissionBase: 'COLLECTED' | 'SALES';
  commissionRate: string;
  achievedAmount: string;
  commissionDue: string;
  active: boolean;
  rep: UserBrief;
  achieved: number;
  achievementPct: number;
}

export interface RepTargetsPage {
  total: number;
  items: RepTarget[];
}

export interface CommissionReport {
  from: string;
  to: string;
  rows: RepTarget[];
  totals: { target: number; achieved: number; commission: number };
}

export type BackupStatus = 'RUNNING' | 'DONE' | 'FAILED';

export interface BackupDoc {
  id: number;
  code: string;
  filename: string;
  path: string;
  sizeBytes: number;
  sha256: string;
  encrypted: boolean;
  status: BackupStatus;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  createdBy: { id: number; name: string } | null;
}

export interface BackupsPage {
  total: number;
  items: BackupDoc[];
}

export interface BackupVerifyResult {
  ok: boolean;
  decryptedBytes?: number;
  sha256?: string;
  error?: string;
}

export interface NotificationDoc {
  id: number;
  userId: number;
  type: string;
  title: string;
  body: string | null;
  refType: string | null;
  refId: number | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsPage {
  total: number;
  unread: number;
  items: NotificationDoc[];
}

export interface AuditLogDoc {
  id: number;
  entityId: number;
  entity: string;
  action: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  userId: number | null;
  user: { id: number; name: string; repCode: string | null } | null;
  at: string;
}

export interface AuditLogsPage {
  total: number;
  items: AuditLogDoc[];
}

export interface AgingRow {
  customer: { id: number; code: string; nameAr: string };
  balance: number;
  current: number;
  b31: number;
  b61: number;
  b91: number;
}

export interface AgingReport {
  asOf: string;
  days1: number;
  days2: number;
  days3: number;
  total: number;
  items: AgingRow[];
  totals: {
    balance: number;
    current: number;
    b31: number;
    b61: number;
    b91: number;
  };
}

export interface WeightNoteRow {
  lineId: number;
  statementId: number;
  number: string;
  date: string;
  status: StatementStatus;
  customerId: number;
  customerCode: string;
  customerName: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  unit: string;
  unitName: string;
  qty: number;
  qtyBase: number;
  weightNote: string;
}

export interface WeightNotesReport {
  from: string | null;
  to: string | null;
  status: StatementStatus | null;
  count: number;
  rows: WeightNoteRow[];
}

// ============================ D3: additional pages ============================

export interface CategoryRow extends Category {
  parent: { id: number; code: string; nameAr: string } | null;
  _count: { items: number; children: number };
}

export interface CategoriesPage {
  categories: CategoryRow[];
  total: number;
}

export interface BrandRow {
  id: number;
  code: string;
  nameAr: string;
  _count: { items: number };
}

export interface BrandsPage {
  brands: BrandRow[];
  total: number;
}

export interface SystemSettingRow {
  key: string;
  value: string;
  updatedAt: string;
}

export interface SystemSettingsPage {
  settings: SystemSettingRow[];
  total: number;
}

export interface CashAccount {
  id: number;
  code: string;
  nameAr: string;
  type: 'CASH' | 'BANK' | 'WALLET';
  openingBalance: string;
  active: boolean;
}

export interface CashAccountsResponse {
  items: CashAccount[];
}

export interface CashSummary {
  accounts: CashAccount[];
  opening: number;
  receiptsTotal: number;
  paymentsTotal: number;
  handoversTotal: number;
  balance: number;
}

export interface CustodyHandover {
  id: number;
  number: string;
  repId: number;
  amount: string;
  date: string;
  receivedById: number | null;
  cashAccountId: number | null;
  notes: string | null;
  status: string;
}

export interface HandoversResponse {
  total: number;
  items: CustodyHandover[];
}

export interface CustodyHandoverDetail extends CustodyHandover {
  createdAt: string;
  rep: { id: number; name: string; repCode: string | null } | null;
  receiver: { id: number; name: string } | null;
  cashAccount: { id: number; code: string; nameAr: string } | null;
}

export interface CustodyReconciliation {
  rep: { id: number; code: string | null; name: string };
  from: string | null;
  to: string | null;
  collected: number;
  delivered: number;
  outstanding: number;
  receiptCount: number;
  handoverCount: number;
  receipts: {
    id: number;
    number: string;
    date: string;
    method: string;
    amount: number;
    customer: { id: number; code: string; nameAr: string };
  }[];
  handovers: {
    id: number;
    number: string;
    date: string;
    amount: number;
    cashAccountId: number | null;
    status: string;
    notes: string | null;
  }[];
}

export interface DailyCloseRow {
  id: number;
  date: string;
  openingBalance: string;
  receiptsTotal: string;
  paymentsTotal: string;
  handoversTotal: string;
  closingBalance: string;
  countedBalance: string | null;
  difference: string | null;
  notes: string | null;
  closedById: number | null;
}

export interface CashAccountStatement {
  account: { id: number; code: string; nameAr: string; type: string };
  openingBalance: number;
  closingBalance: number;
  movements: {
    id: number;
    date: string;
    description: string | null;
    debit: number;
    credit: number;
    balance: number;
    refType: string | null;
    refId: number | null;
  }[];
}

export interface TransferLine {
  id?: number;
  itemId: number;
  item?: { id: number; code: string; nameAr: string; baseUnit?: { code: string; nameAr: string | null } };
  batchId: string;
  qtyBase: string | number;
  cost: string | null;
}

export interface StockTransfer {
  id: number;
  number: string;
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  date: string;
  notes: string | null;
  createdAt: string;
  fromWarehouse: { id: number; code: string; nameAr: string };
  toWarehouse: { id: number; code: string; nameAr: string };
  lines?: TransferLine[];
  freezeWarning?: string | null;
  _count: { lines: number };
}

export interface TransfersPage {
  total: number;
  items: StockTransfer[];
}

export type PurchaseOrderStatus = 'DRAFT' | 'APPROVED' | 'RECEIVED' | 'CANCELLED' | 'CLOSED';

export interface PurchaseOrderLine {
  id?: number;
  itemId?: number;
  item?: { id: number; code: string; nameAr: string };
  unit?: Unit;
  unitId?: number;
  factor?: string;
  qty: string | number;
  qtyBase?: string;
  unitPrice: string | number;
  netLine?: string;
  receivedQtyBase?: string;
}

export interface PurchaseOrder {
  id: number;
  number: string;
  status: PurchaseOrderStatus;
  date: string;
  expectedDate: string | null;
  subtotal: string;
  discountAmount: string;
  net: string;
  notes: string | null;
  supplier: { id: number; code: string; nameAr: string };
  warehouse?: { id: number; code: string; nameAr: string } | null;
  lines?: PurchaseOrderLine[];
  _count: { lines: number };
}

export interface PurchaseOrdersPage {
  total: number;
  items: PurchaseOrder[];
}

export interface SupplierReturnLine {
  id?: number;
  itemId?: number;
  item?: { id: number; code: string; nameAr: string };
  unit?: Unit;
  unitId?: number;
  qty: string | number;
  qtyBase?: string;
  unitPrice: string | number;
  lineTotal?: string;
}

export interface SupplierReturnDoc {
  id: number;
  number: string;
  date: string;
  total: string;
  reason: string | null;
  notes: string | null;
  supplier: { id: number; code: string; nameAr: string };
  warehouse: { id: number; code: string; nameAr: string };
  lines?: SupplierReturnLine[];
  freezeWarning?: string | null;
  _count: { lines: number };
}

export interface SupplierReturnsPage {
  total: number;
  items: SupplierReturnDoc[];
}

export type VisitPlanLineStatus = 'PLANNED' | 'DONE' | 'MISSED';

export interface VisitPlanLineDoc {
  id: number;
  customerId: number;
  sequence: number;
  status: VisitPlanLineStatus;
  notes: string | null;
  customer?: {
    id: number;
    code: string;
    nameAr: string;
    phone: string | null;
    lat: number | null;
    lng: number | null;
  };
}

export interface VisitPlan {
  id: number;
  repId: number;
  date: string;
  notes: string | null;
  lines?: VisitPlanLineDoc[];
  _count?: { lines: number; done: number };
}

export interface VisitPlansPage {
  total: number;
  items: VisitPlan[];
}

export interface DeviceRegistration {
  id: number;
  companyId: number | null;
  userId: number;
  deviceId: string;
  deviceName: string | null;
  active: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  user?: {
    id: number;
    name: string;
    repCode: string | null;
    role: { code: string } | null;
  } | null;
}

export interface DevicesPage {
  devices: DeviceRegistration[];
  total: number;
}