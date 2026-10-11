'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { can, get, type DashboardSummary, type StockValues } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge, ErrorBox, PageHeader, formatMoney } from '@/components/ui';

export default function HomePage() {
  const { user } = useAuth();
  const canReport = can(user, 'report.view');
  const canLedger = can(user, 'ledger.view');
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [values, setValues] = useState<StockValues | null>(null);
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

  const card = (label: string, value: string, sub?: string, tone = 'text-gray-900') => (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-black ${tone}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-gray-400">{sub}</div> : null}
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">لوحة المؤشرات</h1>
        <button
          onClick={() => setRefresh((x) => x + 1)}
          className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-200"
        >
          تحديث
        </button>
      </div>

      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      {loading && !data && !values ? <div className="py-6 text-center text-gray-400">جارِ التحميل…</div> : null}

      {data ? (
        <div>
          <div className="mb-4 grid grid-cols-4 gap-3">
            {card('مبيعات (صافي)', formatMoney(data.sales.net), `${data.sales.count} بيان`, 'text-blue-700')}
            {card('مرتجعات', formatMoney(data.returns.total), `${data.returns.count} مرتجع`, 'text-red-600')}
            {card('تحصيلات', formatMoney(data.receipts.amount), `${data.receipts.count} سند قبض`, 'text-emerald-600')}
            {card('مصروفات', formatMoney(data.payments.amount), `${data.payments.count} سند صرف`, 'text-gray-700')}
          </div>

          <div className="mb-4 grid grid-cols-4 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-sm text-gray-500">موافقات منتظرة</div>
              <div className="mt-1 text-xl font-black text-amber-600">{data.pendingApprovals}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-sm text-gray-500">جلسات جرد نشطة</div>
              <div className="mt-1 text-xl font-black text-violet-700">{data.activeStocktakes}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-sm text-gray-500">أصناف تحت الحد الأدنى</div>
              <div className="mt-1 text-xl font-black text-red-600">{data.lowStockCount}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-sm text-gray-500">أصناف نشطة</div>
              <div className="mt-1 text-xl font-black text-gray-900">{data.itemCount}</div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 text-sm font-bold text-gray-700">الأكثر مبيعاً</div>
              {data.topItems.length === 0 ? (
                <div className="text-sm text-gray-400">لا توجد مبيعات</div>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {data.topItems.map((t) => (
                      <tr key={t.item?.id ?? 0} className="border-b border-gray-100 last:border-0">
                        <TdWrap>{t.item?.nameAr ?? '—'}</TdWrap>
                        <TdWrap dir="ltr">{formatMoney(t.qtyBase)}</TdWrap>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 text-sm font-bold text-gray-700">أعلى العملاء مبيعات</div>
              {data.topCustomers.length === 0 ? (
                <div className="text-sm text-gray-400">لا توجد مبيعات</div>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {data.topCustomers.map((c) => (
                      <tr key={c.customer?.id ?? 0} className="border-b border-gray-100 last:border-0">
                        <TdWrap>{c.customer?.nameAr ?? '—'}</TdWrap>
                        <TdWrap dir="ltr" className="font-semibold text-blue-700">
                          {formatMoney(c.net)}
                        </TdWrap>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {values ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-bold text-gray-700">تقييم المخازن (آخر سعر شراء)</div>
            <Badge color="blue">{values.totals.items} صنف</Badge>
          </div>
          <div className="mb-2 grid grid-cols-2 gap-2">
            {values.byWarehouse.map((w) => (
              <div key={w.warehouseId} className="rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-sm text-gray-600">{w.warehouse.nameAr}:</span>
                <span className="ms-2 font-bold text-blue-700">{formatMoney(w.value)}</span>
                <span className="ms-1 text-xs text-gray-400">({formatMoney(w.qtyBase)})</span>
              </div>
            ))}
          </div>
          <div className="text-lg font-black text-gray-900">الإجمالي: {formatMoney(values.totals.value)}</div>
        </div>
      ) : null}
    </div>
  );
}

function TdWrap({ children, dir, className = '' }: { children: unknown; dir?: string; className?: string }) {
  return (
    <td dir={dir} className={`px-2 py-1.5 text-gray-800 ${className}`}>
      <>{children}</>
    </td>
  );
}