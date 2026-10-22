'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { can, get, type DashboardSummary, type StockValues } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge, ErrorBox, PageHeader, formatMoney } from '@/components/ui';
import {
  SalesTrendChart,
  CategoryDonutChart,
  CashFlowBar,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

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
        get<SalesSummaryApiRes>('/reports/sales-summary?groupBy=day')
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
          .catch(() => undefined),
        get<SalesByApiRes>('/reports/sales-by?by=category')
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
          .catch(() => undefined),
      );
    }
    Promise.allSettled(jobs)
      .then(() => {
        if (!cancelled) setError((e) => e);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل المؤشرات');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, canReport]);

  if (!canReport && !canLedger) {
    return (
      <div>
        <PageHeader title="لوحة المؤشرات" action={<Link href="/statements">بيانات الأسعار</Link>} />
        <ErrorBox message="لوحة المؤشرات متاحة لصلاحيات التقارير والكشوف" />
      </div>
    );
  }

  const card = (label: string, value: string, sub?: string, tone = 'text-gray-900', icon?: string) => (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</div>
        {icon ? <span className="text-lg opacity-80">{icon}</span> : null}
      </div>
      <div className={`mt-2 text-2xl font-black ${tone}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-gray-400 font-medium">{sub}</div> : null}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* شريط العنوان وأزرار الإجراء السريع */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">لوحة المؤشرات الحية</h1>
          <p className="text-xs text-gray-500">نظرة عامة على المبيعات، التدفقات النقدية، والمخزون</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/pos"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <span>⚡</span>
            <span>نقطة بيع POS</span>
          </Link>
          <Link
            href="/statements"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <span>+</span>
            <span>بيان أسعار</span>
          </Link>
          <button
            onClick={() => setRefresh((x) => x + 1)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            تحديث ⟳
          </button>
        </div>
      </div>

      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      {loading && !data && !values ? <div className="py-12 text-center text-sm text-gray-400">جارِ تحميل المؤشرات الحية…</div> : null}

      {data ? (
        <div className="space-y-6">
          {/* البطاقات المالية الأساسية */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {card('صافي المبيعات', formatMoney(data.sales.net), `${data.sales.count} بيان معتمد`, 'text-blue-700', '📈')}
            {card('المرتجعات', formatMoney(data.returns.total), `${data.returns.count} بيان مرتجع`, 'text-red-600', '↩️')}
            {card('التحصيلات النقدية', formatMoney(data.receipts.amount), `${data.receipts.count} سند قبض`, 'text-emerald-600', '💵')}
            {card('المصروفات والمدفوعات', formatMoney(data.payments.amount), `${data.payments.count} سند صرف`, 'text-slate-700', '📤')}
          </div>

          {/* ميزان التدفق المالي والسيولة */}
          <CashFlowBar
            salesNet={data.sales.net}
            returnsTotal={data.returns.total}
            receiptsTotal={data.receipts.amount}
            paymentsTotal={data.payments.amount}
          />

          {/* الرسوم البيانية التفاعلية: اتجاه المبيعات + توزيع التصنيفات */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SalesTrendChart points={trendPoints} />
            </div>
            <div>
              <CategoryDonutChart categories={categoryShares} />
            </div>
          </div>

          {/* بطاقات المؤشرات التشغيلية والرقابية */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-bold text-gray-500">موافقات منتظرة</div>
              <div className="mt-1 text-2xl font-black text-amber-600">{data.pendingApprovals}</div>
              <div className="mt-0.5 text-[11px] text-gray-400">خصم / ائتمان / مرتجع</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-bold text-gray-500">جلسات جرد نشطة</div>
              <div className="mt-1 text-2xl font-black text-violet-700">{data.activeStocktakes}</div>
              <div className="mt-0.5 text-[11px] text-gray-400">مخازن قيد المراجعة</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-bold text-gray-500">أصناف تحت الحد</div>
              <div className="mt-1 text-2xl font-black text-red-600">{data.lowStockCount}</div>
              <div className="mt-0.5 text-[11px] text-gray-400">بحاجة لإعادة التوريد</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-bold text-gray-500">الأصناف النشطة</div>
              <div className="mt-1 text-2xl font-black text-gray-900">{data.itemCount}</div>
              <div className="mt-0.5 text-[11px] text-gray-400">حديد وبويات ومواد بناء</div>
            </div>
          </div>

          {/* جداول الأكثر مبيعاً وأعلى العملاء مع أشرطة تقدم بصرية */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* الأكثر مبيعاً */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">الأصناف الأكثر طلباً ومبيعاً</h3>
                  <p className="text-xs text-gray-400">الكمية الإجمالية المحركة بالوحدة الأساسية</p>
                </div>
                <Badge color="blue">{data.topItems.length} أصناف</Badge>
              </div>

              {data.topItems.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">لا توجد حركات بيع مسجلة</div>
              ) : (
                <div className="space-y-3">
                  {data.topItems.map((t, idx) => {
                    const maxQty = Math.max(...data.topItems.map((i) => i.qtyBase), 1);
                    const pct = Math.min(100, Math.round((t.qtyBase / maxQty) * 100));
                    return (
                      <div key={t.item?.id ?? idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-800">{t.item?.nameAr ?? '—'}</span>
                          <span className="font-semibold text-blue-700">{formatMoney(t.qtyBase)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* أعلى العملاء */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">أعلى العملاء إيراداً</h3>
                  <p className="text-xs text-gray-400">العملاء الأكثر مساهمة في صافي المبيعات</p>
                </div>
                <Badge color="emerald">{data.topCustomers.length} عملاء</Badge>
              </div>

              {data.topCustomers.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">لا توجد بيانات عملاء مسجلة</div>
              ) : (
                <div className="space-y-3">
                  {data.topCustomers.map((c, idx) => {
                    const maxNet = Math.max(...data.topCustomers.map((cust) => cust.net), 1);
                    const pct = Math.min(100, Math.round((c.net / maxNet) * 100));
                    return (
                      <div key={c.customer?.id ?? idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-800">{c.customer?.nameAr ?? '—'}</span>
                          <span className="font-bold text-emerald-700">{formatMoney(c.net)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* تقييم المخازن */}
      {values ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">تقييم المخزون المالي (آخر سعر شراء)</h3>
              <p className="text-xs text-gray-400">إجمالي قيمة البضاعة المتاحة في المخازن</p>
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
              <div key={w.warehouseId} className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-gray-800">{w.warehouse.nameAr}</div>
                  <div className="text-[11px] text-gray-400">الكمية الأساسية: {formatMoney(w.qtyBase)}</div>
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