'use client';

import { useEffect, useState } from 'react';
import {
  can,
  get,
  qs,
  type GeoMapEntry,
  type GeoReportRow,
  type GeoRoute,
  type GeoShiftListItem,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  Button,
  ErrorBox,
  PageHeader,
  Select,
  Td,
  TextInput,
  Th,
  formatDate,
  today,
} from '@/components/ui';
import GeoMap, { type GeoMapMarker } from '@/components/geo-map';

const REP_COLORS = ['blue', 'violet', 'green', 'amber', 'red', 'gray'];
const STATUS_STYLE: Record<string, { text: string; color: string }> = {
  DONE: { text: 'تمت', color: 'green' },
  MISSED: { text: 'لم تتم', color: 'red' },
};

function km(m: number): string {
  return (m / 1000).toLocaleString('ar-EG', { maximumFractionDigits: 2 });
}

function minutes(m: number): string {
  return `${Math.round(m).toLocaleString('ar-EG')} د`;
}

type Tab = 'live' | 'replay' | 'report';

export default function GeoPage() {
  const { user } = useAuth();
  const canView = can(user, 'geo.fleet');
  const [tab, setTab] = useState<Tab>('live');

  if (!canView) {
    return (
      <div>
        <PageHeader title="تتبع المندوبين" />
        <ErrorBox message="ليست لديك صلاحية متابعة أسطول المندوبين" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'live', label: 'الخريطة الحيّة' },
    { id: 'replay', label: 'إعادة عرض المسار' },
    { id: 'report', label: 'التقرير الموجز' },
  ];

  return (
    <div>
      <PageHeader title="تتبع المندوبين" />
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'live' ? <LiveMapTab /> : null}
      {tab === 'replay' ? <ReplayTab /> : null}
      {tab === 'report' ? <ReportTab /> : null}
    </div>
  );
}

function LiveMapTab() {
  const [rows, setRows] = useState<GeoMapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<GeoMapEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<GeoMapEntry[]>('/geo/map')
      .then((d) => {
        if (!cancelled) {
          setRows(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && (err as { status?: number }).status === 403) {
          setError('ميزة تتبع المندوبين غير مفعّلة أو لا تملك الصلاحية');
        } else if (!cancelled) {
          setError(err instanceof Error ? err.message : 'فشل تحميل الخريطة');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const markers: GeoMapMarker[] = rows
    .filter((e) => e.lastLocation)
    .map((e, i) => ({
      id: `rep-${e.rep.id}`,
      lat: e.lastLocation!.lat,
      lng: e.lastLocation!.lng,
      label: e.rep.name,
      color: REP_COLORS[i % REP_COLORS.length],
      onClick: () => setSelected(e),
    }));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-gray-500">{loading ? 'جارِ التحميل…' : `${rows.length} مندوب`}</span>
        <Button variant="secondary" onClick={() => setRefresh((s) => s + 1)}>
          تحديث
        </Button>
      </div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((s) => s + 1)} /> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GeoMap markers={markers} className="h-[440px]" emptyText="لا توجد مواقع مسجّلة بعد" />
        </div>
        <div className="space-y-2">
          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-400">جارِ التحميل…</div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-400">لا يوجد مندوبون</div>
          ) : (
            rows.map((e, i) => (
              <button
                key={e.rep.id}
                onClick={() => {
                  setSelected(e);
                }}
                className={`w-full rounded-xl border bg-white px-3 py-2 text-start transition-colors hover:bg-gray-50 ${
                  selected?.rep.id === e.rep.id ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: e.shift ? REP_COLORS[i % REP_COLORS.length] : '#cbd5e1' }}
                  />
                  <span className="font-semibold text-gray-900">{e.rep.name}</span>
                  <span className="text-xs text-gray-400">{e.rep.repCode}</span>
                  {e.shift ? <Badge color="green">وردية نشطة</Badge> : <Badge color="gray">غير نشط</Badge>}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {e.lastLocation
                    ? `آخر تحديث: ${formatDate(e.lastLocation.at)}`
                    : 'لا يوجد موقع مسجّل'}
                  {e.shift && e.shift.durationMinutes > 0 ? ` · ${minutes(e.shift.durationMinutes)}` : ''}
                </div>
              </button>
            ))
          )}
          {selected?.lastLocation ? (
            <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
              <div className="mb-1 font-semibold text-gray-900">{selected.rep.name} — تفاصيل</div>
              <div className="space-y-1 text-gray-600">
                <div>الحالة: {selected.shift ? 'وردية نشطة' : 'لا وردية حالياً'}</div>
                {selected.shift ? <div>مدة الوردية: {minutes(selected.shift.durationMinutes)}</div> : null}
                <div>موقع: {formatDate(selected.lastLocation.at)}</div>
                {selected.lastLocation.accuracy != null ? <div>الدقة: {selected.lastLocation.accuracy.toFixed(0)} م</div> : null}
                <div>زيارات اليوم: {selected.todayVisitCount}</div>
                <div>مسافة اليوم: {km(selected.todayDistanceM)} كم</div>
                {selected.lastVisit ? (
                  <div>
                    آخر زيارة: {selected.lastVisit.customer} ({STATUS_STYLE[selected.lastVisit.status]?.text ?? selected.lastVisit.status})
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReplayTab() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [repId, setRepId] = useState<string>('');
  const [rows, setRows] = useState<GeoShiftListItem[]>([]);
  const [repOptions, setRepOptions] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(0);
  const [route, setRoute] = useState<GeoRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<GeoShiftListItem[]>(`/geo/shifts${qs({ from, to, repId: repId ? Number(repId) : undefined })}`)
      .then((d) => {
        if (!cancelled) {
          setRows(d);
          setError(null);
          const map = new Map<number, string>();
          for (const s of d) map.set(s.rep.id, s.rep.name);
          setRepOptions(Array.from(map.entries()).map(([id, name]) => ({ id, name })));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          if (err instanceof Error && (err as { status?: number }).status === 403) {
            setError('ميزة تتبع المندوبين غير مفعّلة أو لا تملك الصلاحية');
          } else {
            setError(err instanceof Error ? err.message : 'فشل تحميل الورديات');
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const runSearch = () => {
    setLoading(true);
    setSearch((s) => s + 1);
  };

  const openRoute = (id: number, name: string) => {
    setRouteLoading(true);
    setError(null);
    setSelectedName(name);
    get<GeoRoute>(`/geo/shifts/${id}/route`)
      .then((r) => setRoute(r))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'فشل تحميل المسار');
        setRoute(null);
      })
      .finally(() => setRouteLoading(false));
  };

  const visitMarkers: GeoMapMarker[] = (route?.visits ?? [])
    .filter((v) => v.lat != null && v.lng != null)
    .map((v) => ({
      id: `visit-${v.id}`,
      lat: v.lat!,
      lng: v.lng!,
      label: v.customer,
      color: STATUS_STYLE[v.status]?.color ?? 'amber',
      ring: v.outOfRange,
    }));

  if (route) {
    const st = route.shift;
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setRoute(null)}>
            ← الرجوع للقائمة
          </Button>
          <span className="text-sm font-semibold text-gray-700">
            مسار {selectedName ?? st.rep.name} — {formatDate(st.startedAt)}
          </span>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="المسافة" value={`${km(route.totalDistanceM)} كم`} />
          <StatCard label="التوقف عند العملاء" value={minutes(route.estimatedDwellMinutes)} />
          <StatCard label="نقاط المسار" value={route.points.length.toLocaleString('ar-EG')} />
          <StatCard label="الزيارات" value={route.visits.length.toLocaleString('ar-EG')} />
        </div>
        <GeoMap markers={visitMarkers} path={route.points.map((p) => ({ lat: p.lat, lng: p.lng }))} className="mb-4 h-[420px]" emptyText="لا توجد نقاط في هذه الوردية" />
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-max border-collapse">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <Th>العميل</Th>
                <Th>الوقت</Th>
                <Th>الحالة</Th>
                <Th>سبب عدم الزيارة</Th>
              </tr>
            </thead>
            <tbody>
              {route.visits.length === 0 ? (
                <tr>
                  <Td className="py-4 text-center text-gray-400">لا زيارات في هذه الوردية</Td>
                </tr>
              ) : (
                route.visits.map((v) => {
                  const stl = STATUS_STYLE[v.status];
                  return (
                    <tr key={v.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <Td className="font-semibold">{v.customer}</Td>
                      <Td>{formatDate(v.at)}</Td>
                      <Td>
                        {stl ? <Badge color={stl.color}>{stl.text}</Badge> : v.status}
                        {v.outOfRange ? <span className="mr-1 text-xs text-red-600">(تجاوز 150م)</span> : null}
                      </Td>
                      <Td className="max-w-xs truncate text-gray-500">{v.reason ?? '—'}</Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-gray-700">من</span>
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-gray-700">إلى</span>
          <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-gray-700">المندوب</span>
          <Select value={repId} onChange={(e) => setRepId(e.target.value)}>
            <option value="">كل المندوبين</option>
            {repOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </label>
        <Button onClick={runSearch} disabled={loading}>
          بحث
        </Button>
      </div>
      {error ? <ErrorBox message={error} onRetry={runSearch} /> : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>التاريخ</Th>
              <Th>المندوب</Th>
              <Th>المواقع</Th>
              <Th>الزيارات</Th>
              <Th>الحالة</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا توجد ورديات في هذه الفترة</Td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-semibold">{formatDate(s.startedAt)}</Td>
                  <Td>{s.rep.name}</Td>
                  <Td>{s._count.locations}</Td>
                  <Td>{s._count.visits}</Td>
                  <Td>{s.endedAt ? <Badge color="gray">مغلقة</Badge> : <Badge color="blue">نشطة</Badge>}</Td>
                  <Td>
                    <Button variant="ghost" onClick={() => openRoute(s.id, s.rep.name)} disabled={routeLoading}>
                      {routeLoading ? '…' : 'عرض المسار'}
                    </Button>
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

function ReportTab() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState<GeoReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(0);

  useEffect(() => {
    let cancelled = false;
    get<GeoReportRow[]>(`/geo/reports/summary${qs({ from, to })}`)
      .then((d) => {
        if (!cancelled) {
          setRows(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          if (err instanceof Error && (err as { status?: number }).status === 403) {
            setError('ميزة تتبع المندوبين غير مفعّلة أو لا تملك الصلاحية');
          } else {
            setError(err instanceof Error ? err.message : 'فشل تحميل التقرير');
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const runSearch = () => {
    setLoading(true);
    setSearch((s) => s + 1);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-gray-700">من</span>
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-gray-700">إلى</span>
          <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <Button onClick={runSearch} disabled={loading}>
          عرض
        </Button>
      </div>
      {error ? <ErrorBox message={error} onRetry={runSearch} /> : null}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-400">جارِ التحميل…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-400">لا توجد بيانات</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <div key={r.rep.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold text-gray-900">{r.rep.name}</div>
                {r.hasActiveShift ? <Badge color="blue">وردية نشطة</Badge> : null}
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2 text-sm text-gray-600">
                <MiniStat label="المسافة" value={`${km(r.totalDistanceM)} كم`} />
                <MiniStat label="زيارات" value={`${r.visitsCount} (${r.missedVisits} لم تتم)`} />
                <MiniStat label="التوقف عند العملاء" value={minutes(r.totalDwellAtCustomersMinutes)} />
                <MiniStat label="الورديات" value={`${r.closedShifts} مغلقة / ${r.shiftsCount} إجمالاً`} />
                <MiniStat label="عملاء مفوّضون" value={r.customersAssigned} />
                <MiniStat label="تمت زيارتهم" value={r.customersVisited} />
              </div>
              {r.notVisitedCustomers.length > 0 ? (
                <div className="border-t border-gray-100 pt-2">
                  <div className="mb-1 text-sm font-semibold text-gray-700">
                    لم يزرهم ({r.notVisitedCustomers.length}):
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.notVisitedCustomers.map((c) => (
                      <span key={c.id} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {c.nameAr}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-gray-900">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-800">{value}</div>
    </div>
  );
}