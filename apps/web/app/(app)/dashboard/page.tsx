'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  can,
  get,
  type DashboardSummary,
  type StockValues,
  type PriceStatement,
  type StatementsPage,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  EmptyState,
  ErrorBox,
  PageHeader,
  StatCard,
  formatMoney,
} from '@/components/ui';
import {
  IconApproval,
  IconCollection,
  IconItem,
  IconPos,
  IconRefresh,
  IconReport,
  IconReturn,
  IconSparkles,
  IconStatement,
  IconStocktake,
  IconTreasury,
  IconWarehouse,
} from '@/components/icons';
import {
  SalesTrendChart,
  CategoryDonutChart,
  CashFlowBar,
  RecentTransactionsFeed,
  type TrendPoint,
  type CategoryShare,
} from '@/components/dashboard-charts';

interface SalesSummaryApiRes {
  rows: { period: string; net: number; count: number }[];
}

interface SalesByApiRes {
  rows: { name: string; net: number }[];
}

export default function HomePage() {
  const { user } = useAuth();
  const canReport = can(user, 'report.view');
  const canLedger = can(user, 'ledger.view');
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [values, setValues] = useState<StockValues | null>(null);
  const [trendPoints, setTrendPoints] = useState<TrendPoint[]>([]);
  const [categoryShares, setCategoryShares] = useState<CategoryShare[]>([]);
  const [recentStatements, setRecentStatements] = useState<PriceStatement[]>([]);
  const [trendGroupBy, setTrendGroupBy] = useState<'day' | 'month'>('day');
  const [salesDimension, setSalesDimension] = useState<'category' | 'brand' | 'warehouse' | 'rep'>('category');
  const [loading, setLoading] = useState(true);
  const [recentLoading, setRecentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  // 1. Primary summary, valuation, and recent statements
  useEffect(() => {
    let cancelled = false;
    const jobs: Promise<unknown>[] = [];
    if (canReport) {
      jobs.push(
        get<DashboardSummary>('/reports/summary').then((d) => {
          if (!cancelled) setData(d);
        }),
        get<StockValues>('/stock-values').then((d) => {
          if (!cancelled) setValues(d);
        }),
        get<StatementsPage>('/price-statements?limit=6').then((res) => {
          if (!cancelled && res?.items) {
            setRecentStatements(res.items);
          }
        }),
      );
    }
    Promise.allSettled(jobs)
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل المؤشرات');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRecentLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, canReport]);

  // 2. Sales trend points (re-fetches when trendGroupBy or refresh changes)
  useEffect(() => {
    if (!canReport) return;
    let cancelled = false;
    get<SalesSummaryApiRes>(`/reports/sales-summary?groupBy=${trendGroupBy}`)
      .then((res) => {
        if (!cancelled && res?.rows) {
          setTrendPoints(
            res.rows.map((r) => ({
              period: r.period,
              net: Number(r.net || 0),
              count: Number(r.count || 0),
            })),
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [refresh, canReport, trendGroupBy]);

  // 3. Category/Brand/Warehouse shares (re-fetches when salesDimension or refresh changes)
  useEffect(() => {
    if (!canReport) return;
    let cancelled = false;
    get<SalesByApiRes>(`/reports/sales-by?by=${salesDimension}`)
      .then((res) => {
        if (!cancelled && res?.rows) {
          setCategoryShares(
            res.rows.map((r) => ({
              name: r.name || 'عام',
              net: Number(r.net || 0),
            })),
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [refresh, canReport, salesDimension]);

  if (!canReport && !canLedger) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="لوحة المؤشرات"
          action={
            <Link
              href="/statements"
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
            >
              بيانات الأسعار
            </Link>
          }
        />
        <ErrorBox message="لوحة المؤشرات متاحة فقط لصلاحيات التقارير والكشوف المالية" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header with Action Controls */}
      <PageHeader
        title="لوحة المؤشرات الحية"
        description="نظرة تشغيلية ومالية فورية على المبيعات، التدفقات النقدية، والمخزون"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/pos"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-all tactile-btn"
            >
              <IconPos size={15} />
              <span>نقطة بيع POS</span>
            </Link>
            <Link
              href="/statements"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs tactile-btn"
            >
              <IconStatement size={15} />
              <span>بيان أسعار جديد</span>
            </Link>
            <Link
              href="/collections"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs tactile-btn"
            >
              <IconCollection size={15} />
              <span>سند قبض</span>
            </Link>
            <button
              onClick={() => {
                setLoading(true);
                setRecentLoading(true);
                setRefresh((x) => x + 1);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-2xs tactile-btn"
              title="تحديث البيانات"
            >
              <IconRefresh size={14} className={loading ? 'animate-spin text-blue-600' : ''} />
              <span>تحديث</span>
            </button>
          </div>
        }
      />

      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}

      {loading && !data && !values ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
          <p className="mt-3 text-xs font-bold text-slate-500">جارِ مزامنة وقراءة المؤشرات الحية…</p>
        </div>
      ) : null}

      {data ? (
        <div className="space-y-6 animate-entrance">
          {/* Executive Attention Strip (Pending Approvals & Low Stock Alert) */}
          {(data.pendingApprovals > 0 || data.lowStockCount > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.pendingApprovals > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
                      <IconApproval size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-amber-900">
                        موافقات إدارية معلقة ({data.pendingApprovals})
                      </div>
                      <div className="text-2xs text-amber-700 truncate mt-0.5">
                        طلبات خصم إضافي أو تجاوز ائتمان أو مرتجعات تتطلب الاعتماد
                      </div>
                    </div>
                  </div>
                  <Link
                    href="/approvals"
                    className="shrink-0 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-amber-700 transition-all tactile-btn"
                  >
                    مراجعة الآن ←
                  </Link>
                </div>
              )}

              {data.lowStockCount > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white shadow-xs">
                      <IconItem size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-rose-900">
                        أصناف قاربت النفاد ({data.lowStockCount})
                      </div>
                      <div className="text-2xs text-rose-700 truncate mt-0.5">
                        أصناف وصلت أو نزلت عن حد الطلب الأدنى بالمستودعات
                      </div>
                    </div>
                  </div>
                  <Link
                    href="/items"
                    className="shrink-0 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-rose-700 transition-all tactile-btn"
                  >
                    إدارة النواقص ←
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Financial KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="صافي المبيعات"
              value={formatMoney(data.sales.net)}
              subtitle={`${data.sales.count} بيان معتمد`}
              icon={<IconReport size={18} className="text-blue-600" />}
              tone="text-blue-700"
              trend={{ label: 'إجمالي المعتمد', positive: true }}
              href="/statements"
            />
            <StatCard
              title="المرتجعات"
              value={formatMoney(data.returns.total)}
              subtitle={`${data.returns.count} بيان مرتجع`}
              icon={<IconReturn size={18} className="text-red-500" />}
              tone="text-red-600"
              href="/returns"
            />
            <StatCard
              title="التحصيلات النقدية"
              value={formatMoney(data.receipts.amount)}
              subtitle={`${data.receipts.count} سند قبض`}
              icon={<IconCollection size={18} className="text-emerald-600" />}
              tone="text-emerald-700"
              trend={{ label: 'سيولة داخلة', positive: true }}
              href="/collections"
            />
            <StatCard
              title="المصروفات والمدفوعات"
              value={formatMoney(data.payments.amount)}
              subtitle={`${data.payments.count} سند صرف`}
              icon={<IconTreasury size={18} className="text-slate-600" />}
              tone="text-slate-800"
              href="/treasury"
            />
          </div>

          {/* Cashflow Liquidity Balance */}
          <CashFlowBar
            salesNet={data.sales.net}
            returnsTotal={data.returns.total}
            receiptsTotal={data.receipts.amount}
            paymentsTotal={data.payments.amount}
          />

          {/* Interactive Charts: Sales Trend & Category Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SalesTrendChart
                points={trendPoints}
                groupBy={trendGroupBy}
                onGroupByChange={setTrendGroupBy}
              />
            </div>
            <div>
              <CategoryDonutChart
                categories={categoryShares}
                dimension={salesDimension}
                onDimensionChange={setSalesDimension}
              />
            </div>
          </div>

          {/* Operational Metrics Cards with Navigation */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link
              href="/approvals"
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs craft-card hover:-translate-y-0.5 hover:border-amber-300 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 group-hover:text-amber-700 transition-colors">موافقات معلقة</span>
                <IconApproval size={17} className="text-amber-500" />
              </div>
              <div className="mt-1 text-2xl font-black text-amber-600">{data.pendingApprovals}</div>
              <div className="mt-1 text-[11px] text-slate-400 group-hover:text-amber-600 transition-colors">خصم / ائتمان / مرتجع ↗</div>
            </Link>

            <Link
              href="/stocktakes"
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs craft-card hover:-translate-y-0.5 hover:border-purple-300 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 group-hover:text-purple-700 transition-colors">جلسات جرد نشطة</span>
                <IconStocktake size={17} className="text-purple-500" />
              </div>
              <div className="mt-1 text-2xl font-black text-purple-700">{data.activeStocktakes}</div>
              <div className="mt-1 text-[11px] text-slate-400 group-hover:text-purple-600 transition-colors">مخازن قيد المراجعة ↗</div>
            </Link>

            <Link
              href="/items"
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs craft-card hover:-translate-y-0.5 hover:border-red-300 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 group-hover:text-red-700 transition-colors">تحت حد الطلب</span>
                <IconItem size={17} className="text-red-500" />
              </div>
              <div className="mt-1 text-2xl font-black text-red-600">{data.lowStockCount}</div>
              <div className="mt-1 text-[11px] text-slate-400 group-hover:text-red-600 transition-colors">أصناف بحاجة لتوريد ↗</div>
            </Link>

            <Link
              href="/items"
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs craft-card hover:-translate-y-0.5 hover:border-blue-300 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 group-hover:text-blue-700 transition-colors">الأصناف المسجلة</span>
                <IconSparkles size={17} className="text-blue-500" />
              </div>
              <div className="mt-1 text-2xl font-black text-slate-900">{data.itemCount}</div>
              <div className="mt-1 text-[11px] text-slate-400 group-hover:text-blue-600 transition-colors">حديد وبويات ومواد بناء ↗</div>
            </Link>
          </div>

          {/* Real-time Activity Feed & Top Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <RecentTransactionsFeed
                statements={recentStatements}
                loading={recentLoading}
              />
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Selling Items */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs craft-card flex flex-col justify-between">
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">الأصناف الأكثر طلباً ومبيعاً</h3>
                      <p className="text-xs text-slate-400">إجمالي الكمية المحركة بالوحدة الأساسية</p>
                    </div>
                    <Badge color="blue">{data.topItems.length} أصناف</Badge>
                  </div>

                  {data.topItems.length === 0 ? (
                    <EmptyState
                      title="لا توجد حركات بيع مسجلة"
                      description="ستظهر الأصناف الأكثر طلباً فور اعتماد بيانات الأسعار"
                      icon={<IconItem size={22} />}
                    />
                  ) : (
                    <div className="space-y-3.5">
                      {data.topItems.map((t, idx) => {
                        const maxQty = Math.max(...data.topItems.map((i) => i.qtyBase), 1);
                        const pct = Math.min(100, Math.round((t.qtyBase / maxQty) * 100));
                        return (
                          <div key={t.item?.id ?? idx} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-800">{t.item?.nameAr ?? '—'}</span>
                              <span className="font-bold text-blue-700">{formatMoney(t.qtyBase)}</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-l from-blue-600 to-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-right">
                  <Link
                    href="/reports"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    عرض تقرير حركة ومبيعات الأصناف بالتفصيل ←
                  </Link>
                </div>
              </div>

              {/* Top Customers by Net Sales */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs craft-card flex flex-col justify-between">
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">أعلى العملاء إيراداً</h3>
                      <p className="text-xs text-slate-400">العملاء الأكثر مساهمة في صافي المبيعات</p>
                    </div>
                    <Badge color="green">{data.topCustomers.length} عملاء</Badge>
                  </div>

                  {data.topCustomers.length === 0 ? (
                    <EmptyState
                      title="لا توجد بيانات عملاء مسجلة"
                      description="ستظهر مؤشرات كبار العملاء مع تسجيل حركات المبيعات"
                      icon={<IconReport size={22} />}
                    />
                  ) : (
                    <div className="space-y-3.5">
                      {data.topCustomers.map((c, idx) => {
                        const maxNet = Math.max(...data.topCustomers.map((cust) => cust.net), 1);
                        const pct = Math.min(100, Math.round((c.net / maxNet) * 100));
                        return (
                          <div key={c.customer?.id ?? idx} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-800">{c.customer?.nameAr ?? '—'}</span>
                              <span className="font-bold text-emerald-700">{formatMoney(c.net)}</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-l from-emerald-600 to-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-right">
                  <Link
                    href="/reports"
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                  >
                    عرض تقرير كبار العملاء والمبيعات ←
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Warehouse Valuation Section */}
      {values ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs craft-card">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">تقييم المخزون المالي (آخر سعر شراء)</h3>
              <p className="text-xs text-slate-400">إجمالي قيمة البضاعة المتاحة في المخازن</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge color="blue">{values.totals.items} صنف</Badge>
              <div className="text-base font-black text-blue-700">
                {formatMoney(values.totals.value)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {values.byWarehouse.map((w) => (
              <div
                key={w.warehouseId}
                className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 flex items-center justify-between hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600">
                    <IconWarehouse size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{w.warehouse.nameAr}</div>
                    <div className="text-[11px] text-slate-400">
                      الكمية الأساسية: {formatMoney(w.qtyBase)}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-black text-blue-700">{formatMoney(w.value)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}