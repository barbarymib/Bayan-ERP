'use client';

import { useEffect, useState } from 'react';
import {
  API_URL,
  can,
  get,
  getToken,
  qs,
  type AgingReport,
  type LowStock,
  type Movements,
  type StockSummaryRep,
  type StockValues,
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
} from '@/components/ui';

type Tab = 'movements' | 'values' | 'summary' | 'lowstock' | 'aging' | 'weightnotes';

export default function ReportsPage() {
  const { user } = useAuth();
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
    { id: 'values', label: 'تقييم المخازن' },
    { id: 'summary', label: 'ملخص الأصناف' },
    { id: 'lowstock', label: 'تحت الحد الأدنى' },
    { id: 'aging', label: 'أعمار الديون' },
    { id: 'weightnotes', label: 'ملاحظات الوزن الفعلي' },
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
      {tab === 'summary' ? <SummaryPane /> : null}
      {tab === 'lowstock' ? <LowStockPane /> : null}
      {tab === 'aging' ? <AgingPane /> : null}
      {tab === 'weightnotes' ? <WeightNotesPane /> : null}
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

function downloadCsv(path: string, setErr: (m: string) => void) {
  const token = getToken();
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
      a.download = 'report.csv';
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(() => setErr('تعذّر تصدير الملف'));
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
        <Button variant="secondary" onClick={() => downloadCsv(`/reports/movements${qs({ format: 'csv', warehouseId: warehouseId, from: from, to: to })}`, setError)}>
          تصدير CSV
        </Button>
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
        <Button variant="secondary" onClick={() => downloadCsv(`/stock-values${qs({ format: 'csv', warehouseId: warehouseId, method: method })}`, setError)}>
          تصدير CSV
        </Button>
      </div>

      {data ? (
        <>
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
                    <tr key={`${r.itemId}:${r.warehouseId}:${r.batchId}`} className="border-b border-gray-100 last:border-0">
                      <Td>
                        <div className="font-semibold">{r.nameAr}</div>
                        <div className="text-xs font-mono text-gray-400">{r.code}</div>
                      </Td>
                      <Td>{data.byWarehouse.find((w) => w.warehouseId === r.warehouseId)?.warehouse.nameAr ?? `#${r.warehouseId}`}</Td>
                      <Td dir="ltr">{formatMoney(r.qtyBase)}</Td>
                      <Td>{formatMoney(r.unitCost)}</Td>
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
        <Button variant="secondary" onClick={() => downloadCsv(`/reports/stock-summary${qs({ format: 'csv', warehouseId: warehouseId })}`, setError)}>
          تصدير CSV
        </Button>
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
                  <Td dir="ltr">{formatMoney(r.qtyBase)}</Td>
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
        <Button variant="secondary" onClick={() => downloadCsv('/reports/low-stock?format=csv', setError)}>
          تصدير CSV
        </Button>
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
        <Button variant="secondary" onClick={() => downloadCsv(`/reports/weight-notes${qs({ format: 'csv', from: from, to: to, status: status })}`, setError)}>
          تصدير CSV
        </Button>
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