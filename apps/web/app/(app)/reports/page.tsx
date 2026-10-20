'use client';

import { useEffect, useState } from 'react';
import {
  API_URL,
  can,
  get,
  getToken,
  qs,
  type AgingReport,
  type DiscountApprovalsReport,
  type DiscountsReport,
  type DiscountDimension,
  type ItemCardReport,
  type ItemsWithoutPrice,
  type LowStock,
  type Movements,
  type RepPerformanceReport,
  type ReturnsReport,
  type ReturnDimension,
  type SalesByReport,
  type SalesDimension,
  type SalesSummaryReport,
  type StockSummaryRep,
  type StocktakeDiffReport,
  type StockValues,
  type StoppedCustomersReport,
  type SupplierDebtReport,
  type ValuationMethod,
  type Warehouse,
  type WeightNotesReport,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  Button,
  ErrorBox,
  Field,
  PageHeader,
  Select,
  Td,
  TextInput,
  Th,
  formatDate,
  formatMoney,
  toArabicNumerals,
} from '@/components/ui';

type Tab =
  | 'movements'
  | 'values'
  | 'noprice'
  | 'summary'
  | 'lowstock'
  | 'aging'
  | 'weightnotes'
  | 'salessummary'
  | 'salesby'
  | 'discounts'
  | 'discountapprovals'
  | 'returns'
  | 'stopped'
  | 'stocktakediff'
  | 'supplierdebt'
  | 'repperf'
  | 'itemcard';

export default function ReportsPage() {
  const { user, featureEnabled } = useAuth();
  const canView = can(user, 'report.view');
  const [tab, setTab] = useState<Tab>('movements');

  if (!canView) {
    return (
      <div>
        <PageHeader title="التقارير" />
        <ErrorBox message="لا تملك صلاحية عرض التقارير" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'movements', label: 'حركة المخزون' },
    ...(featureEnabled('reports.valuation')
      ? [{ id: 'values' as Tab, label: 'تقييم المخازن' }]
      : []),
    { id: 'noprice', label: 'أصناف بدون سعر' },
    { id: 'summary', label: 'ملخص الأصناف' },
    { id: 'lowstock', label: 'تحت الحد الأدنى' },
    { id: 'aging', label: 'أعمار الديون' },
    { id: 'weightnotes', label: 'ملاحظات الوزن الفعلي' },
    { id: 'salessummary', label: 'ملخص المبيعات' },
    { id: 'salesby', label: 'المبيعات حسب البُعد' },
    { id: 'discounts', label: 'الخصومات' },
    { id: 'discountapprovals', label: 'اعتماد الخصومات' },
    { id: 'returns', label: 'المرتجعات' },
    { id: 'stopped', label: 'العملاء المتوقفون' },
    { id: 'stocktakediff', label: 'فروقات الجرد' },
    { id: 'supplierdebt', label: 'مديونية الموردين' },
    { id: 'repperf', label: 'أداء المناديب' },
    { id: 'itemcard', label: 'بطاقة الصنف' },
  ];

  return (
    <div>
      <PageHeader title="التقارير" />
      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'movements' ? <MovementsPane /> : null}
      {tab === 'values' ? <ValuesPane /> : null}
      {tab === 'noprice' ? <NoPricePane /> : null}
      {tab === 'summary' ? <SummaryPane /> : null}
      {tab === 'lowstock' ? <LowStockPane /> : null}
      {tab === 'aging' ? <AgingPane /> : null}
      {tab === 'weightnotes' ? <WeightNotesPane /> : null}
      {tab === 'salessummary' ? <SalesSummaryPane /> : null}
      {tab === 'salesby' ? <SalesByPane /> : null}
      {tab === 'discounts' ? <DiscountsPane /> : null}
      {tab === 'discountapprovals' ? <DiscountApprovalsPane /> : null}
      {tab === 'returns' ? <ReturnsPane /> : null}
      {tab === 'stopped' ? <StoppedCustomersPane /> : null}
      {tab === 'stocktakediff' ? <StocktakeDiffPane /> : null}
      {tab === 'supplierdebt' ? <SupplierDebtPane /> : null}
      {tab === 'repperf' ? <RepPerformancePane /> : null}
      {tab === 'itemcard' ? <ItemCardPane /> : null}
    </div>
  );
}

function WarehousesSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  useEffect(() => {
    let cancelled = false;
    get<{ warehouses: Warehouse[] }>('/warehouses')
      .then((d) => {
        if (!cancelled) setWarehouses(d.warehouses);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">كل المخازن</option>
      {warehouses.map((w) => (
        <option key={w.id} value={w.id}>
          {w.code} — {w.nameAr}
        </option>
      ))}
    </Select>
  );
}

function downloadReport(path: string, setErr: (m: string) => void) {
  const token = getToken();
  const xlsx = path.includes('format=xlsx');
  fetch(`${API_URL}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
    .then(async (res) => {
      if (!res.ok) {
        let msg = `فشل التصدير (${res.status})`;
        try {
          const j = (await res.json()) as { message?: unknown };
          msg = Array.isArray(j.message) ? j.message.join('، ') : String(j.message ?? msg);
        } catch {
          /* ignore */
        }
        setErr(msg);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = xlsx ? 'report.xlsx' : 'report.csv';
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(() => setErr('تعذّر تصدير الملف'));
}

/** زرّا تصدير (CSV + XLSX) من نفس مسار التقرير مع تبديل `format`. */
function ExportButtons({ path, setErr }: { path: string; setErr: (m: string) => void }) {
  const csvPath = path.replace(/format=xlsx/g, 'format=csv');
  const xlsxPath = csvPath.replace(/format=csv/g, 'format=xlsx');
  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => downloadReport(csvPath, setErr)}>
        تصدير CSV
      </Button>
      <Button variant="secondary" onClick={() => downloadReport(xlsxPath, setErr)}>
        تصدير XLSX
      </Button>
    </div>
  );
}

function MovementsPane() {
  const [data, setData] = useState<Movements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [warehouseId, setWarehouseId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    let cancelled = false;
    get<Movements>(`/reports/movements${qs({ warehouseId: warehouseId, from: from, to: to, limit: 500 })}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل حركة المخزون');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, warehouseId, from, to]);

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="w-52">
          <Field label="المخزن">
            <WarehousesSelect value={warehouseId} onChange={setWarehouseId} />
          </Field>
        </div>
        <Field label="من تاريخ">
          <TextInput value={from} onChange={(e) => setFrom(e.target.value)} type="date" />
        </Field>
        <Field label="إلى تاريخ">
          <TextInput value={to} onChange={(e) => setTo(e.target.value)} type="date" />
        </Field>
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث
        </Button>
        <ExportButtons path={`/reports/movements${qs({ format: 'csv', warehouseId: warehouseId, from: from, to: to })}`} setErr={setError} />
        <Button variant="secondary" onClick={() => window.print()}>
          طباعة
        </Button>
      </div>

      {data && data.rows.length > 0 ? (
        <div className="mb-3 grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">وارد</div>
            <div className="mt-1 text-xl font-black text-emerald-600">{formatMoney(data.totals.totalIn)}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">منصرف</div>
            <div className="mt-1 text-xl font-black text-red-600">{formatMoney(data.totals.totalOut)}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">صافي</div>
            <div className="mt-1 text-xl font-black text-blue-700">{formatMoney(data.totals.net)}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">عدد الحركات</div>
            <div className="mt-1 text-xl font-black text-gray-900">{data.count}</div>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>التاريخ</Th>
              <Th>النوع</Th>
              <Th>الصنف</Th>
              <Th>المخزن</Th>
              <Th>وارد</Th>
              <Th>منصرف</Th>
              <Th>التكلفة</Th>
              <Th>الرصيد</Th>
              <Th>المرجع</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : !data || data.rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا توجد حركات مخزون</Td>
              </tr>
            ) : (
              data.rows.map((m) => (
                <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td>{formatDate(m.at)}</Td>
                  <Td>
                    <Badge color={m.type === 'PURCHASE_IN' ? 'green' : m.type === 'ADJUSTMENT' ? 'blue' : m.type === 'RETURN_IN' ? 'blue' : 'red'}>
                      {m.typeLabel}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="font-semibold">{m.item.nameAr}</div>
                    <div className="text-xs font-mono text-gray-400">{m.item.code}</div>
                  </Td>
                  <Td>{m.warehouse.nameAr}</Td>
                  <Td className="font-semibold text-emerald-600">{m.in ? formatMoney(m.in) : '—'}</Td>
                  <Td className="font-semibold text-red-600">{m.out ? formatMoney(m.out) : '—'}</Td>
                  <Td>{m.cost != null ? formatMoney(m.cost) : '—'}</Td>
                  <Td dir="ltr" className="font-bold">{formatMoney(m.balance)}</Td>
                  <Td className="text-xs text-gray-500">
                    {m.refType ? `${m.refType}#${m.refId}` : '—'}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ValuesPane() {
  const [data, setData] = useState<StockValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [warehouseId, setWarehouseId] = useState('');
  const [method, setMethod] = useState<ValuationMethod>('LAST');

  useEffect(() => {
    let cancelled = false;
    get<StockValues>(`/stock-values${qs({ warehouseId: warehouseId, method: method })}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل التقييم');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, warehouseId, method]);

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="w-52">
          <Field label="المخزن">
            <WarehousesSelect value={warehouseId} onChange={setWarehouseId} />
          </Field>
        </div>
        <Field label="طريقة التقييم">
          <Select value={method} onChange={(e) => setMethod(e.target.value as ValuationMethod)}>
            <option value="LAST">آخر سعر شراء</option>
            <option value="WEIGHTED">متوسط مرجح (المشتريات)</option>
            <option value="SALES">سعر البيع</option>
          </Select>
        </Field>
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث
        </Button>
        <ExportButtons path={`/stock-values${qs({ format: 'csv', warehouseId: warehouseId, method: method })}`} setErr={setError} />
      </div>

      {data ? (
        <>
          {data.totals.noPriceItems > 0 ? (
            <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="font-bold">تحذير: أصناف بدون سعر ({data.totals.noPriceItems})</div>
              <div className="mt-1">
                {data.totals.noPriceLines} بند بكمية {formatMoney(data.totals.noPriceQtyBase)} بلا سعر — مستبعدة من الإجمالي.
                اضبط آخر سعر شراء من تبويب «أصناف بدون سعر».
              </div>
            </div>
          ) : null}
          {data.byWarehouse.length > 0 ? (
            <div className="mb-3 grid grid-cols-2 gap-3">
              {data.byWarehouse.map((w) => (
                <div key={w.warehouseId} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="text-sm text-gray-500">{w.warehouse.nameAr}</div>
                  <div className="mt-1 text-xl font-black text-blue-700">
                    {formatMoney(w.value)} <span className="text-sm font-semibold text-gray-500">({formatMoney(w.qtyBase)})</span>
                  </div>
                </div>
              ))}
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
                <div className="text-sm font-semibold text-blue-700">الإجمالي ({data.methodLabel})</div>
                <div className="mt-1 text-xl font-black text-blue-800">
                  {formatMoney(data.totals.value)} <span className="text-sm font-semibold">({formatMoney(data.totals.qtyBase)})</span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-max border-collapse">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <Th>الصنف</Th>
                  <Th>المخزن</Th>
                  <Th>الكمية</Th>
                  <Th>سعر الوحدة</Th>
                  <Th>القيمة</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
                  </tr>
                ) : data.rows.length === 0 ? (
                  <tr>
                    <Td className="py-6 text-center text-gray-400">لا توجد أرصدة</Td>
                  </tr>
                ) : (
                  data.rows.map((r) => (
                    <tr
                      key={`${r.itemId}:${r.warehouseId}:${r.batchId}`}
                      className={`border-b border-gray-100 last:border-0 ${r.noPrice ? 'bg-amber-50' : ''}`}
                    >
                      <Td>
                        <div className="font-semibold">{r.nameAr}</div>
                        <div className="text-xs font-mono text-gray-400">{r.code}</div>
                      </Td>
                      <Td>{data.byWarehouse.find((w) => w.warehouseId === r.warehouseId)?.warehouse.nameAr ?? `#${r.warehouseId}`}</Td>
                      <Td dir="ltr">
                        {formatMoney(r.qtyBase)}
                        {r.qtyComposite ? (
                          <div className="text-[11px] font-normal text-gray-500" dir="rtl">
                            {toArabicNumerals(r.qtyComposite)}
                          </div>
                        ) : null}
                      </Td>
                      <Td>{r.noPrice ? <Badge color="amber">بدون سعر</Badge> : formatMoney(r.unitCost)}</Td>
                      <Td className="font-bold">{formatMoney(r.value)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function NoPricePane() {
  const [data, setData] = useState<ItemsWithoutPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<{ id: number; code: string; nameAr: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    get<{ categories: { id: number; code: string; nameAr: string }[] }>('/categories')
      .then((d) => {
        if (!cancelled) setCategories(d.categories ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    get<ItemsWithoutPrice>(`/reports/items-without-price${qs({ categoryId: categoryId })}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل القائمة');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, categoryId]);

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="w-52">
          <Field label="التصنيف">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">كل التصنيفات</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.nameAr}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث
        </Button>
        <ExportButtons path={`/reports/items-without-price${qs({ format: 'csv', categoryId: categoryId })}`} setErr={setError} />
      </div>

      {data ? (
        <>
          <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            أصناف نشطة بلا آخر سعر شراء: <span className="font-bold">{data.count}</span> — تُقيَّم بصفر وتُستبعد من إجمالي تقييم المخزون (§5.8).
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-max border-collapse">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <Th>الصنف</Th>
                  <Th>التصنيف</Th>
                  <Th>الوحدة</Th>
                  <Th>الرصيد المتاح</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
                  </tr>
                ) : data.rows.length === 0 ? (
                  <tr>
                    <Td className="py-6 text-center text-gray-400">لا توجد أصناف بدون سعر</Td>
                  </tr>
                ) : (
                  data.rows.map((r) => (
                    <tr key={r.itemId} className="border-b border-gray-100 last:border-0">
                      <Td>
                        <div className="font-semibold">{r.nameAr}</div>
                        <div className="text-xs font-mono text-gray-400">{r.code}</div>
                      </Td>
                      <Td>{r.categoryName}</Td>
                      <Td>{r.unitName}</Td>
                      <Td dir="ltr">{formatMoney(r.qtyBase)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SummaryPane() {
  const [data, setData] = useState<StockSummaryRep | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [warehouseId, setWarehouseId] = useState('');

  useEffect(() => {
    let cancelled = false;
    get<StockSummaryRep>(`/reports/stock-summary${qs({ warehouseId: warehouseId })}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل الملخص');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, warehouseId]);

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="w-52">
          <Field label="المخزن">
            <WarehousesSelect value={warehouseId} onChange={setWarehouseId} />
          </Field>
        </div>
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث
        </Button>
        <ExportButtons path={`/reports/stock-summary${qs({ format: 'csv', warehouseId: warehouseId })}`} setErr={setError} />
      </div>

      {data ? (
        <div className="mb-3 flex gap-3">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className="text-sm text-gray-500">أصناف</div>
            <div className="text-xl font-black">{data.totals.items}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className="text-sm text-gray-500">الكمية</div>
            <div className="text-xl font-black">{formatMoney(data.totals.qtyBase)}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className="text-sm text-gray-500">القيمة (آخر شراء)</div>
            <div className="text-xl font-black text-blue-700">{formatMoney(data.totals.value)}</div>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الصنف</Th>
              <Th>الكمية</Th>
              <Th>القيمة</Th>
              <Th>آخر حركة</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : !data || data.rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا توجد أصناف</Td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.itemId} className="border-b border-gray-100 last:border-0">
                  <Td>
                    <div className="font-semibold">{r.item.nameAr}</div>
                    <div className="text-xs font-mono text-gray-400">{r.item.code}</div>
                  </Td>
                  <Td dir="ltr">
                    {formatMoney(r.qtyBase)}
                    {r.qtyComposite ? (
                      <div className="text-[11px] font-normal text-gray-500" dir="rtl">
                        {toArabicNumerals(r.qtyComposite)}
                      </div>
                    ) : null}
                  </Td>
                  <Td className="font-bold">{formatMoney(r.value)}</Td>
                  <Td>
                    {r.lastMovementAt ? (
                      <span className="flex items-center gap-2">
                        {formatDate(r.lastMovementAt)}
                        {r.stagnant ? <Badge color="red">راكد</Badge> : null}
                      </span>
                    ) : (
                      <Badge color="gray">بدون حركة</Badge>
                    )}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LowStockPane() {
  const [data, setData] = useState<LowStock | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    get<LowStock>('/reports/low-stock')
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل الأصناف');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      <div className="mb-3 flex items-center gap-2">
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث
        </Button>
        <ExportButtons path={'/reports/low-stock?format=csv'} setErr={setError} />
        <span className="text-sm text-gray-500">{data?.count ?? 0} صنف تحت الحد الأدنى</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الصنف</Th>
              <Th>المخزن</Th>
              <Th>الرصيد</Th>
              <Th>الحد الأدنى</Th>
              <Th>النقص</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : !data || data.rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا توجد أصناف تحت الحد الأدنى</Td>
              </tr>
            ) : (
              data.rows.map((r, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <Td>
                    <div className="font-semibold">{r.item.nameAr}</div>
                    <div className="text-xs font-mono text-gray-400">{r.item.code}</div>
                  </Td>
                  <Td>{r.warehouse.nameAr}</Td>
                  <Td className="font-semibold text-red-600">{formatMoney(r.qtyBase)}</Td>
                  <Td>{formatMoney(r.minStock)}</Td>
                  <Td className="font-bold">{formatMoney(r.diff)}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WeightNotesPane() {
  const [data, setData] = useState<WeightNotesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    get<WeightNotesReport>(`/reports/weight-notes${qs({ from: from, to: to, status: status })}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل ملاحظات الوزن');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, from, to, status]);

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Field label="من تاريخ">
          <TextInput value={from} onChange={(e) => setFrom(e.target.value)} type="date" />
        </Field>
        <Field label="إلى تاريخ">
          <TextInput value={to} onChange={(e) => setTo(e.target.value)} type="date" />
        </Field>
        <Field label="الحالة">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
            <option value="">الكل عدا الملغي</option>
            <option value="APPROVED">معتمد</option>
            <option value="DRAFT">بانتظار الموافقة</option>
            <option value="PENDING_REVIEW">قيد المراجعة</option>
            <option value="ARCHIVED">مؤرشف</option>
          </Select>
        </Field>
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث
        </Button>
        <ExportButtons path={`/reports/weight-notes${qs({ format: 'csv', from: from, to: to, status: status })}`} setErr={setError} />
        <span className="text-sm text-gray-500">{data?.count ?? 0} بند</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>التاريخ</Th>
              <Th>البيان</Th>
              <Th>العميل</Th>
              <Th>الصنف</Th>
              <Th>الكمية</Th>
              <Th>ملاحظة الوزن الفعلي</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : !data || data.rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا توجد ملاحظات وزن</Td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.lineId} className="border-b border-gray-100 last:border-0">
                  <Td>{formatDate(r.date)}</Td>
                  <Td className="font-mono font-semibold">{r.number}</Td>
                  <Td>
                    <div className="font-semibold">{r.customerName}</div>
                    <div className="text-xs text-gray-400">{r.customerCode}</div>
                  </Td>
                  <Td>
                    <div className="font-semibold">{r.itemName}</div>
                    <div className="text-xs font-mono text-gray-400">{r.itemCode}</div>
                  </Td>
                  <Td dir="ltr">
                    {formatMoney(r.qty)} {r.unit}
                  </Td>
                  <Td className="font-semibold text-amber-700">{r.weightNote}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AgingPane() {
  const [data, setData] = useState<AgingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    get<AgingReport>('/reports/aging')
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل أعمار الديون');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const t = data?.totals;
  const total = t?.balance ?? 0;
  const totalCurrent = t?.current ?? 0;
  const totalB31 = t?.b31 ?? 0;
  const totalB61 = t?.b61 ?? 0;
  const totalB91 = t?.b91 ?? 0;

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      <div className="mb-3 flex items-center gap-2">
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث
        </Button>
        <ExportButtons path={'/reports/aging?format=csv'} setErr={setError} />
        <span className="text-sm text-gray-500">
          {data ? `حتى ${formatDate(data.asOf)} — ` : ''}
          {formatMoney(total)} إجمالي مستحق
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>العميل</Th>
              <Th>الإجمالي</Th>
              <Th>0-30</Th>
              <Th>31-60</Th>
              <Th>61-90</Th>
              <Th>+90</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : !data || data.items.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا توجد أرصدة مدينة</Td>
              </tr>
            ) : (
              data.items.map((r) => (
                <tr key={r.customer.id} className="border-b border-gray-100 last:border-0">
                  <Td>
                    <div className="font-semibold">{r.customer.nameAr}</div>
                    <div className="text-xs font-mono text-gray-400">{r.customer.code}</div>
                  </Td>
                  <Td className="font-semibold">{formatMoney(r.balance)}</Td>
                  <Td>{formatMoney(r.current)}</Td>
                  <Td>{formatMoney(r.b31)}</Td>
                  <Td>{formatMoney(r.b61)}</Td>
                  <Td className="font-bold text-red-600">{formatMoney(r.b91)}</Td>
                </tr>
              ))
            )}
            {!loading && data && data.items.length > 0 ? (
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                <Td>الإجمالي</Td>
                <Td>{formatMoney(total)}</Td>
                <Td>{formatMoney(totalCurrent)}</Td>
                <Td>{formatMoney(totalB31)}</Td>
                <Td>{formatMoney(totalB61)}</Td>
                <Td>{formatMoney(totalB91)}</Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MoneyStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-black ${tone ?? 'text-gray-900'}`}>{value}</div>
    </div>
  );
}

function SalesSummaryPane() {
  const [data, setData] = useState<SalesSummaryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [groupBy, setGroupBy] = useState('day');
  const showsCost = data?.totals.profit !== undefined;

  useEffect(() => {
    let cancelled = false;
    get<SalesSummaryReport>(`/reports/sales-summary${qs({ from: from, to: to, groupBy: groupBy })}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل ملخص المبيعات');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, from, to, groupBy]);

  const t = data?.totals;
  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Field label="من تاريخ">
          <TextInput value={from} onChange={(e) => setFrom(e.target.value)} type="date" />
        </Field>
        <Field label="إلى تاريخ">
          <TextInput value={to} onChange={(e) => setTo(e.target.value)} type="date" />
        </Field>
        <Field label="التجميع">
          <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="w-40">
            <option value="day">يومي</option>
            <option value="month">شهري</option>
          </Select>
        </Field>
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث
        </Button>
        <ExportButtons path={`/reports/sales-summary${qs({ format: 'csv', from: from, to: to, groupBy: groupBy })}`} setErr={setError} />
      </div>

      {t ? (
        <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MoneyStat label="عدد الفواتير" value={String(t.count)} />
          <MoneyStat label="صافي المبيعات" value={formatMoney(t.net)} tone="text-blue-700" />
          <MoneyStat label="الخصم" value={formatMoney(t.discount)} tone="text-amber-700" />
          <MoneyStat label="الإجمالي" value={formatMoney(t.total)} />
          {showsCost ? <MoneyStat label="التكلفة" value={formatMoney(t.cost ?? 0)} /> : null}
          {showsCost ? <MoneyStat label="الربح" value={formatMoney(t.profit ?? 0)} tone="text-emerald-600" /> : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الفترة</Th>
              <Th>عدد</Th>
              <Th>الكمية</Th>
              <Th>إجمالي</Th>
              <Th>خصم</Th>
              <Th>صافي</Th>
              <Th>ضريبة</Th>
              <Th>شحن</Th>
              <Th>الإجمالي</Th>
              {showsCost ? <Th>التكلفة</Th> : null}
              {showsCost ? <Th>الربح</Th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : !data || data.rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا توجد مبيعات في الفترة</Td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.period} className="border-b border-gray-100 last:border-0">
                  <Td className="font-mono font-semibold">{r.period}</Td>
                  <Td>{r.count}</Td>
                  <Td dir="ltr">{formatMoney(r.qtyBase)}</Td>
                  <Td>{formatMoney(r.gross)}</Td>
                  <Td className="text-amber-700">{formatMoney(r.discount)}</Td>
                  <Td className="font-semibold">{formatMoney(r.net)}</Td>
                  <Td>{formatMoney(r.tax)}</Td>
                  <Td>{formatMoney(r.shipping)}</Td>
                  <Td className="font-bold">{formatMoney(r.total)}</Td>
                  {showsCost ? <Td>{formatMoney(r.cost ?? 0)}</Td> : null}
                  {showsCost ? <Td className="font-semibold text-emerald-600">{formatMoney(r.profit ?? 0)}</Td> : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const SALES_DIMENSION_LABELS: { id: SalesDimension; label: string }[] = [
  { id: 'item', label: 'صنف' },
  { id: 'category', label: 'تصنيف' },
  { id: 'brand', label: 'ماركة' },
  { id: 'customer', label: 'عميل' },
  { id: 'rep', label: 'مندوب' },
  { id: 'warehouse', label: 'مخزن' },
];

function SalesByPane() {
  const [data, setData] = useState<SalesByReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [by, setBy] = useState<SalesDimension>('item');
  const showsCost = data?.totals.profit !== undefined;

  useEffect(() => {
    let cancelled = false;
    get<SalesByReport>(`/reports/sales-by${qs({ from: from, to: to, by: by, limit: 500 })}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل المبيعات حسب البُعد');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, from, to, by]);

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="w-40">
          <Field label="البُعد">
            <Select value={by} onChange={(e) => setBy(e.target.value as SalesDimension)}>
              {SALES_DIMENSION_LABELS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="من تاريخ">
          <TextInput value={from} onChange={(e) => setFrom(e.target.value)} type="date" />
        </Field>
        <Field label="إلى تاريخ">
          <TextInput value={to} onChange={(e) => setTo(e.target.value)} type="date" />
        </Field>
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث
        </Button>
        <ExportButtons path={`/reports/sales-by${qs({ format: 'csv', from: from, to: to, by: by })}`} setErr={setError} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الاسم</Th>
              <Th>الكمية</Th>
              <Th>إجمالي</Th>
              <Th>خصم</Th>
              <Th>صافي</Th>
              {showsCost ? <Th>التكلفة</Th> : null}
              {showsCost ? <Th>الربح</Th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : !data || data.rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا توجد بيانات</Td>
              </tr>
            ) : (
              data.rows.map((r, i) => (
                <tr key={`${r.id ?? 'x'}-${i}`} className="border-b border-gray-100 last:border-0">
                  <Td>
                    <div className="font-semibold">{r.name}</div>
                    {r.code ? <div className="text-xs font-mono text-gray-400">{r.code}</div> : null}
                  </Td>
                  <Td dir="ltr">{formatMoney(r.qtyBase)}</Td>
                  <Td>{formatMoney(r.gross)}</Td>
                  <Td className="text-amber-700">{formatMoney(r.discount)}</Td>
                  <Td className="font-bold">{formatMoney(r.net)}</Td>
                  {showsCost ? <Td>{formatMoney(r.cost ?? 0)}</Td> : null}
                  {showsCost ? <Td className="font-semibold text-emerald-600">{formatMoney(r.profit ?? 0)}</Td> : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const DISCOUNT_DIMENSIONS: { id: DiscountDimension; label: string }[] = [
  { id: 'user', label: 'مستخدم' },
  { id: 'rep', label: 'مندوب' },
  { id: 'item', label: 'صنف' },
];

function DiscountsPane() {
  const [data, setData] = useState<DiscountsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [by, setBy] = useState<DiscountDimension>('user');

  useEffect(() => {
    let cancelled = false;
    get<DiscountsReport>(`/reports/discounts${qs({ from: from, to: to, by: by })}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل الخصومات');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, from, to, by]);

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="w-40">
          <Field label="التجميع">
            <Select value={by} onChange={(e) => setBy(e.target.value as DiscountDimension)}>
              {DISCOUNT_DIMENSIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="من تاريخ">
          <TextInput value={from} onChange={(e) => setFrom(e.target.value)} type="date" />
        </Field>
        <Field label="إلى تاريخ">
          <TextInput value={to} onChange={(e) => setTo(e.target.value)} type="date" />
        </Field>
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث
        </Button>
        <ExportButtons path={`/reports/discounts${qs({ format: 'csv', from: from, to: to, by: by })}`} setErr={setError} />
        <span className="text-sm text-gray-500">
          {data ? `${data.totals.count} حركة — ${formatMoney(data.totals.discount)} إجمالي الخصم` : ''}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الاسم</Th>
              <Th>عدد</Th>
              <Th>الكمية</Th>
              <Th>الصافي</Th>
              <Th>الخصم</Th>
              <Th>نسبة الخصم</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : !data || data.rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا توجد خصومات</Td>
              </tr>
            ) : (
              data.rows.map((r, i) => (
                <tr key={`${r.id ?? 'x'}-${i}`} className="border-b border-gray-100 last:border-0">
                  <Td>
                    <div className="font-semibold">{r.name}</div>
                    {r.code ? <div className="text-xs font-mono text-gray-400">{r.code}</div> : null}
                  </Td>
                  <Td>{r.count}</Td>
                  <Td dir="ltr">{formatMoney(r.qtyBase)}</Td>
                  <Td>{formatMoney(r.net)}</Td>
                  <Td className="font-semibold text-amber-700">{formatMoney(r.discount)}</Td>
                  <Td className="font-bold">{toArabicNumerals(r.discountPct.toFixed(1))}%</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DiscountApprovalsPane() {
  const [data, setData] = useState<DiscountApprovalsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    get<DiscountApprovalsReport>(`/reports/discount-approvals${qs({ from: from, to: to, status: status, limit: 500 })}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل اعتماد الخصومات');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, from, to, status]);

  const statusBadge = (s: string) => (
    <Badge color={s === 'APPROVED' ? 'green' : s === 'REJECTED' ? 'red' : 'amber'}>
      {s === 'APPROVED' ? 'معتمد' : s === 'REJECTED' ? 'مرفوض' : 'معلّق'}
    </Badge>
  );

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Field label="من تاريخ">
          <TextInput value={from} onChange={(e) => setFrom(e.target.value)} type="date" />
        </Field>
        <Field label="إلى تاريخ">
          <TextInput value={to} onChange={(e) => setTo(e.target.value)} type="date" />
        </Field>
        <Field label="الحالة">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
            <option value="">الكل</option>
            <option value="PENDING">معلّق</option>
            <option value="APPROVED">معتمد</option>
            <option value="REJECTED">مرفوض</option>
          </Select>
        </Field>
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث
        </Button>
        <ExportButtons path={`/reports/discount-approvals${qs({ format: 'csv', from: from, to: to, status: status })}`} setErr={setError} />
      </div>

      {data ? (
        <div className="mb-3 grid grid-cols-3 gap-3">
          <MoneyStat label="معلّق" value={String(data.byStatus.PENDING)} tone="text-amber-700" />
          <MoneyStat label="معتمد" value={String(data.byStatus.APPROVED)} tone="text-emerald-600" />
          <MoneyStat label="مرفوض" value={String(data.byStatus.REJECTED)} tone="text-red-600" />
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>النوع</Th>
              <Th>الحالة</Th>
              <Th>المرجع</Th>
              <Th>طالبه</Th>
              <Th>اعتمده</Th>
              <Th>تاريخ الاعتماد</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : !data || data.rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا توجد طلبات</Td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0">
                  <Td className="font-semibold">{r.type === 'HEADER_DISCOUNT' ? 'خصم إجمالي' : 'خصم صنف'}</Td>
                  <Td>{statusBadge(r.status)}</Td>
                  <Td className="font-mono text-gray-500" dir="ltr">
                    {r.refType ? `${r.refType}#${r.refId ?? ''}` : '—'}
                  </Td>
                  <Td>{r.requestedBy ?? '—'}</Td>
                  <Td>{r.decidedBy ?? '—'}</Td>
                  <Td>{r.decidedAt ? formatDate(r.decidedAt) : '—'}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const RETURN_DIMENSIONS: { id: ReturnDimension; label: string }[] = [
  { id: 'customer', label: 'عميل' },
  { id: 'rep', label: 'مندوب' },
  { id: 'reason', label: 'سبب' },
  { id: 'item', label: 'صنف' },
];

function ReturnsPane() {
  const [data, setData] = useState<ReturnsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [by, setBy] = useState<ReturnDimension>('customer');

  useEffect(() => {
    let cancelled = false;
    get<ReturnsReport>(`/reports/returns${qs({ from: from, to: to, by: by })}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل المرتجعات');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, from, to, by]);

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="w-40">
          <Field label="التجميع">
            <Select value={by} onChange={(e) => setBy(e.target.value as ReturnDimension)}>
              {RETURN_DIMENSIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="من تاريخ">
          <TextInput value={from} onChange={(e) => setFrom(e.target.value)} type="date" />
        </Field>
        <Field label="إلى تاريخ">
          <TextInput value={to} onChange={(e) => setTo(e.target.value)} type="date" />
        </Field>
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث
        </Button>
        <ExportButtons path={`/reports/returns${qs({ format: 'csv', from: from, to: to, by: by })}`} setErr={setError} />
        {data ? (
          <span className="text-sm text-gray-500">
            نسبة المرتجع من المبيعات: {toArabicNumerals(data.totals.ratioPct.toFixed(1))}%
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الاسم</Th>
              <Th>عدد</Th>
              <Th>الكمية</Th>
              <Th>الإجمالي</Th>
              <Th>النسبة</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : !data || data.rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا توجد مرتجعات</Td>
              </tr>
            ) : (
              data.rows.map((r, i) => (
                <tr key={`${r.id ?? 'x'}-${i}`} className="border-b border-gray-100 last:border-0">
                  <Td>
                    <div className="font-semibold">{r.name}</div>
                    {r.code ? <div className="text-xs font-mono text-gray-400">{r.code}</div> : null}
                  </Td>
                  <Td>{r.count}</Td>
                  <Td dir="ltr">{formatMoney(r.qtyBase)}</Td>
                  <Td className="font-bold text-red-600">{formatMoney(r.total)}</Td>
                  <Td>{toArabicNumerals(r.sharePct.toFixed(1))}%</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StoppedCustomersPane() {
  const [data, setData] = useState<StoppedCustomersReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [days, setDays] = useState('30');

  useEffect(() => {
    let cancelled = false;
    get<StoppedCustomersReport>(`/reports/stopped-customers${qs({ days: days, limit: 500 })}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل العملاء المتوقفين');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, days]);

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Field label="عدد الأيام">
          <TextInput value={days} onChange={(e) => setDays(e.target.value)} type="number" className="w-32" />
        </Field>
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث
        </Button>
        <ExportButtons path={`/reports/stopped-customers${qs({ format: 'csv', days: days })}`} setErr={setError} />
        {data ? (
          <span className="text-sm text-gray-500">
            {data.totals.count} متوقف من {data.totals.scanned} عميل
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>العميل</Th>
              <Th>الهاتف</Th>
              <Th>المندوب</Th>
              <Th>آخر بيع</Th>
              <Th>عدد الأيام</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : !data || data.rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا يوجد عملاء متوقفون</Td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0">
                  <Td>
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-xs font-mono text-gray-400">{r.code}</div>
                  </Td>
                  <Td dir="ltr">{r.phone ?? '—'}</Td>
                  <Td>{r.repName ?? '—'}</Td>
                  <Td>{r.lastSaleDate ? formatDate(r.lastSaleDate) : 'لا يوجد'}</Td>
                  <Td className="font-bold text-red-600">{r.daysSince ?? '—'}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StocktakeDiffPane() {
  const [data, setData] = useState<StocktakeDiffReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [site, setSite] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [onlyDiff, setOnlyDiff] = useState(true);

  useEffect(() => {
    let cancelled = false;
    get<StocktakeDiffReport>(
      `/reports/stocktake-diff${qs({ warehouseId: site, from: from, to: to, onlyDiff: onlyDiff ? undefined : 'false' })}`,
    )
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل فروقات الجرد');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, site, from, to, onlyDiff]);

  const t = data?.totals;
  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="w-52">
          <Field label="المخزن">
            <WarehousesSelect value={site} onChange={setSite} />
          </Field>
        </div>
        <Field label="من تاريخ">
          <TextInput value={from} onChange={(e) => setFrom(e.target.value)} type="date" />
        </Field>
        <Field label="إلى تاريخ">
          <TextInput value={to} onChange={(e) => setTo(e.target.value)} type="date" />
        </Field>
        <label className="flex items-center gap-2 pb-2 text-sm text-gray-600">
          <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
          الفروقات فقط
        </label>
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث
        </Button>
        <ExportButtons
          path={`/reports/stocktake-diff${qs({ format: 'csv', warehouseId: site, from: from, to: to, onlyDiff: onlyDiff ? undefined : 'false' })}`}
          setErr={setError}
        />
      </div>

      {t ? (
        <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MoneyStat label="جلسات" value={String(t.sessions)} />
          <MoneyStat label="بنود فيها فرق" value={String(t.diffLines)} tone="text-amber-700" />
          <MoneyStat label="قيمة الزيادة" value={formatMoney(t.surplusValue)} tone="text-emerald-600" />
          <MoneyStat label="قيمة العجز" value={formatMoney(t.shortageValue)} tone="text-red-600" />
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الجلسة</Th>
              <Th>المخزن</Th>
              <Th>الصنف</Th>
              <Th>النظام</Th>
              <Th>المعدود</Th>
              <Th>الفرق</Th>
              <Th>قيمة الفرق</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : !data || data.rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا توجد فروقات</Td>
              </tr>
            ) : (
              data.rows.map((r, i) => (
                <tr key={`${r.sessionId}-${r.itemId}-${i}`} className="border-b border-gray-100 last:border-0">
                  <Td className="font-mono font-semibold">{r.sessionNumber}</Td>
                  <Td>{r.warehouse}</Td>
                  <Td>
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-xs font-mono text-gray-400">{r.code}</div>
                  </Td>
                  <Td dir="ltr">{formatMoney(r.systemQtyBase)}</Td>
                  <Td dir="ltr">{r.countedQtyBase === null ? '—' : formatMoney(r.countedQtyBase)}</Td>
                  <Td className={`font-bold ${r.diffQty < 0 ? 'text-red-600' : 'text-emerald-600'}`} dir="ltr">
                    {formatMoney(r.diffQty)}
                  </Td>
                  <Td className="font-semibold">{formatMoney(r.diffValue)}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SupplierDebtPane() {
  const [data, setData] = useState<SupplierDebtReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [asOf, setAsOf] = useState('');
  const [onlyOutstanding, setOnlyOutstanding] = useState(true);

  useEffect(() => {
    let cancelled = false;
    get<SupplierDebtReport>(
      `/reports/supplier-debt${qs({ asOf: asOf, onlyOutstanding: onlyOutstanding ? undefined : 'false' })}`,
    )
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل مديونية الموردين');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, asOf, onlyOutstanding]);

  const t = data?.totals;
  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Field label="كما في تاريخ">
          <TextInput value={asOf} onChange={(e) => setAsOf(e.target.value)} type="date" />
        </Field>
        <label className="flex items-center gap-2 pb-2 text-sm text-gray-600">
          <input type="checkbox" checked={onlyOutstanding} onChange={(e) => setOnlyOutstanding(e.target.checked)} />
          الأرصدة المستحقة فقط
        </label>
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث
        </Button>
        <ExportButtons
          path={`/reports/supplier-debt${qs({ format: 'csv', asOf: asOf, onlyOutstanding: onlyOutstanding ? undefined : 'false' })}`}
          setErr={setError}
        />
      </div>

      {t ? (
        <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MoneyStat label="الموردون" value={String(t.suppliers)} />
          <MoneyStat label="المشتريات" value={formatMoney(t.purchases)} />
          <MoneyStat label="المدفوع" value={formatMoney(t.paid)} tone="text-emerald-600" />
          <MoneyStat label="الرصيد" value={formatMoney(t.balance)} tone="text-red-600" />
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>المورد</Th>
              <Th>الرصيد الافتتاحي</Th>
              <Th>المشتريات</Th>
              <Th>المدفوع</Th>
              <Th>الرصيد</Th>
              <Th>آخر شراء</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : !data || data.rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا توجد مديونية</Td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0">
                  <Td>
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-xs font-mono text-gray-400">{r.code}</div>
                  </Td>
                  <Td>{formatMoney(r.openingBalance)}</Td>
                  <Td>{formatMoney(r.purchases)}</Td>
                  <Td className="text-emerald-600">{formatMoney(r.paid)}</Td>
                  <Td className="font-bold text-red-600">{formatMoney(r.balance)}</Td>
                  <Td>{r.lastPurchaseDate ? formatDate(r.lastPurchaseDate) : '—'}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RepPerformancePane() {
  const [data, setData] = useState<RepPerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    let cancelled = false;
    get<RepPerformanceReport>(`/reports/rep-performance${qs({ from: from, to: to, limit: 500 })}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل أداء المناديب');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, from, to]);

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Field label="من تاريخ">
          <TextInput value={from} onChange={(e) => setFrom(e.target.value)} type="date" />
        </Field>
        <Field label="إلى تاريخ">
          <TextInput value={to} onChange={(e) => setTo(e.target.value)} type="date" />
        </Field>
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث
        </Button>
        <ExportButtons path={`/reports/rep-performance${qs({ format: 'csv', from: from, to: to })}`} setErr={setError} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>المندوب</Th>
              <Th>الهدف</Th>
              <Th>المبيعات</Th>
              <Th>نسبة الإنجاز</Th>
              <Th>المحصّل</Th>
              <Th>نسبة التحصيل</Th>
              <Th>الزيارات</Th>
              <Th>المسافة (كم)</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : !data || data.rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا توجد بيانات</Td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.repId} className="border-b border-gray-100 last:border-0">
                  <Td>
                    <div className="font-semibold">{r.name}</div>
                    {r.repCode ? <div className="text-xs font-mono text-gray-400">{r.repCode}</div> : null}
                  </Td>
                  <Td>{formatMoney(r.targetAmount)}</Td>
                  <Td className="font-semibold">{formatMoney(r.salesNet)}</Td>
                  <Td className="font-bold text-blue-700">{toArabicNumerals(r.achievementPct.toFixed(1))}%</Td>
                  <Td>{formatMoney(r.collected)}</Td>
                  <Td>{toArabicNumerals(r.collectionRatePct.toFixed(1))}%</Td>
                  <Td>
                    {r.visitsDone}/{r.visits}
                  </Td>
                  <Td dir="ltr">{toArabicNumerals(r.distanceKm.toFixed(1))}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ItemCardPane() {
  const [items, setItems] = useState<{ id: number; code: string; nameAr: string }[]>([]);
  const [itemId, setItemId] = useState('');
  const [site, setSite] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<ItemCardReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    get<{ items: { id: number; code: string; nameAr: string }[] }>(`/items${qs({ limit: 500 })}`)
      .then((d) => {
        if (!cancelled) setItems(d.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    get<ItemCardReport>(`/reports/item-card${qs({ itemId: itemId, warehouseId: site, from: from, to: to })}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل بطاقة الصنف');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, itemId, site, from, to]);

  const t = data?.totals;
  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="w-64">
          <Field label="الصنف">
            <Select value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">اختر صنفاً</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code} — {i.nameAr}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="w-52">
          <Field label="المخزن">
            <WarehousesSelect value={site} onChange={setSite} />
          </Field>
        </div>
        <Field label="من تاريخ">
          <TextInput value={from} onChange={(e) => setFrom(e.target.value)} type="date" />
        </Field>
        <Field label="إلى تاريخ">
          <TextInput value={to} onChange={(e) => setTo(e.target.value)} type="date" />
        </Field>
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)} disabled={!itemId}>
          تحديث
        </Button>
        {itemId ? (
          <ExportButtons
            path={`/reports/item-card${qs({ format: 'csv', itemId: itemId, warehouseId: site, from: from, to: to })}`}
            setErr={setError}
          />
        ) : null}
      </div>

      {itemId && data ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <span className="font-semibold">{data.item.nameAr}</span>
          <span className="font-mono text-gray-400">{data.item.code}</span>
          <Badge color="gray">{data.item.category.nameAr}</Badge>
          <span className="text-gray-400">/ {data.item.baseUnit.nameAr}</span>
          {data.item.lastPurchaseCost !== null ? (
            <span>آخر تكلفة شراء: {formatMoney(data.item.lastPurchaseCost)}</span>
          ) : null}
        </div>
      ) : null}

      {itemId && t ? (
        <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MoneyStat label="رصيد افتتاحي" value={formatMoney(t.openingQty)} />
          <MoneyStat label="وارد" value={formatMoney(t.in)} tone="text-emerald-600" />
          <MoneyStat label="منصرف" value={formatMoney(Math.abs(t.out))} tone="text-red-600" />
          <MoneyStat label="رصيد ختامي" value={formatMoney(t.closingQty)} tone="text-blue-700" />
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>التاريخ</Th>
              <Th>النوع</Th>
              <Th>المخزن</Th>
              <Th>وارد</Th>
              <Th>منصرف</Th>
              <Th>الرصيد</Th>
            </tr>
          </thead>
          <tbody>
            {!itemId ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">اختر صنفاً لعرض بطاقته</Td>
              </tr>
            ) : loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : !data || data.rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا توجد حركات</Td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0">
                  <Td>{formatDate(r.at)}</Td>
                  <Td className="font-semibold">{r.typeLabel}</Td>
                  <Td>{r.warehouse.nameAr}</Td>
                  <Td className="text-emerald-600" dir="ltr">
                    {r.in ? formatMoney(r.in) : ''}
                  </Td>
                  <Td className="text-red-600" dir="ltr">
                    {r.out ? formatMoney(Math.abs(r.out)) : ''}
                  </Td>
                  <Td className="font-bold" dir="ltr">
                    {formatMoney(r.balance)}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}