'use client';

import { useEffect, useState } from 'react';
import {
  can,
  get,
  qs,
  type GeoMapEntry,
  type GeoReportRow,
  type GeoRoute,
  type GeoRouteVisit,
  type GeoShiftListItem,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  Button,
  ErrorBox,
  Field,
  PageHeader,
  Spinner,
  Td,
  TextInput,
  Th,
  formatDate,
} from '@/components/ui';

type Tab = 'map' | 'report' | 'routes';

export default function RepsPage() {
  const { user } = useAuth();
  const canView = can(user, 'rep.track');

  const [tab, setTab] = useState<Tab>('map');

  if (!canView) {
    return (
      <div>
        <PageHeader title="المتابعة الميدانية" />
        <ErrorBox message="ليست لديك صلاحية تتبع وزيارات المندوبين" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'map', label: 'الخريطة الحية' },
    { id: 'report', label: 'تقرير المندوبين' },
    { id: 'routes', label: 'إعادة عرض المسارات' },
  ];

  return (
    <div>
      <PageHeader title="المتابعة الميدانية" />
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
      {tab === 'map' ? <MapPane /> : null}
      {tab === 'report' ? <ReportPane /> : null}
      {tab === 'routes' ? <RoutesPane /> : null}
    </div>
  );
}

function km(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} كم` : `${m} م`;
}

function embed(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
}

function routeLink(r: GeoRoute): string | null {
  const inRng = r.points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (inRng.length === 0) return null;
  const first = inRng[0];
  const last = inRng[inRng.length - 1];
  const waypoints = inRng.slice(1, -1).map((p) => `${p.lat},${p.lng}`).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${first.lat},${first.lng}&destination=${last.lat},${last.lng}${
    waypoints ? `&waypoints=${waypoints}` : ''
  }`;
}

function MapPane() {
  const [data, setData] = useState<GeoMapEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    get<GeoMapEntry[]>('/geo/map')
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل الخريطة');
      });
    const timer = setInterval(() => setRefresh((x) => x + 1), 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refresh]);

  if (!data) {
    return error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : <Spinner />;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          آخر تحديث تلقائي كل 30 ثانية — {data.length} مندوباً
        </div>
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث الآن
        </Button>
      </div>
      {error ? <ErrorBox message={error} /> : null}
      {data.length === 0 ? <ErrorBox message="لا يوجد مندوبون بعد" /> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((e) => (
          <div key={e.rep.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <div className="font-semibold text-gray-800">{e.rep.name}</div>
                <div className="text-xs text-gray-500">
                  {e.rep.repCode}
                  {e.rep.phone ? ` — ${e.rep.phone}` : ''}
                </div>
              </div>
              {e.shift ? (
                <Badge color="green">وردية نشطة ({e.shift.durationMinutes} د)</Badge>
              ) : (
                <Badge color="gray">لا توجد وردية</Badge>
              )}
            </div>
            <div className="relative h-48">
              {e.lastLocation ? (
                <iframe
                  src={embed(e.lastLocation.lat, e.lastLocation.lng)}
                  className="h-full w-full border-0"
                  loading="lazy"
                  title={`موقع ${e.rep.name}`}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                  لا يوجد موقع بعد
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 text-center rtl:divide-x-reverse">
              <div className="px-2 py-3">
                <div className="text-lg font-bold text-gray-800">{km(e.todayDistanceM)}</div>
                <div className="text-xs text-gray-500">اليوم</div>
              </div>
              <div className="px-2 py-3">
                <div className="text-lg font-bold text-gray-800">{e.todayVisitCount}</div>
                <div className="text-xs text-gray-500">زيارة</div>
              </div>
              <div className="px-2 py-3">
                <div className="text-xs font-semibold text-gray-700">
                  {e.lastVisit
                    ? `${e.lastVisit.customer} (${formatDate(e.lastVisit.at)})`
                    : 'لا زيارات بعد'}
                </div>
                <div className="text-xs text-gray-500">آخر زيارة</div>
              </div>
            </div>
            {e.lastLocation ? (
              <a
                href={`https://www.google.com/maps?q=${e.lastLocation.lat},${e.lastLocation.lng}&z=15`}
                target="_blank"
                rel="noreferrer"
                className="block border-t border-gray-100 px-4 py-2 text-center text-sm text-blue-600 hover:bg-blue-50"
              >
                فتح في خرائط جوجل
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportPane() {
  const [data, setData] = useState<GeoReportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    get<GeoReportRow[]>(`/geo/reports/summary${qs({ from: from, to: to })}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل التقرير');
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, refresh]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Field label="من تاريخ">
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="إلى تاريخ">
          <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث
        </Button>
      </div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      {!data ? <Spinner /> : null}
      {data && data.length === 0 ? <ErrorBox message="لا توجد بيانات" /> : null}
      {data && data.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-600">
                <Th>المندوب</Th>
                <Th>الورديات</Th>
                <Th>المسافة</Th>
                <Th>وقت التوقف</Th>
                <Th>الزيارات</Th>
                <Th>لم تتم زيارتها</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.rep.id} className="border-b border-gray-50">
                  <Td>
                    <div className="font-semibold text-gray-800">{r.rep.name}</div>
                    <div className="text-xs text-gray-400">{r.rep.repCode}</div>
                  </Td>
                  <Td>
                    {r.shiftsCount} {r.hasActiveShift ? <Badge color="green">جارية</Badge> : null}
                  </Td>
                  <Td>
                    <div title={`${r.totalDistanceM} م`}>{km(r.totalDistanceM)}</div>
                  </Td>
                  <Td>{r.totalDwellAtCustomersMinutes} د</Td>
                  <Td>
                    {r.visitsCount}
                    {r.missedVisits > 0 ? (
                      <span className="mr-1 text-red-600">({r.missedVisits} متأخرة)</span>
                    ) : null}
                  </Td>
                  <Td>
                    <div className="text-xs text-gray-500">
                      {r.customersAssigned} مطلوب · {r.customersVisited} منجز
                    </div>
                    {r.notVisitedCustomers.length > 0 ? (
                      <div className="text-xs text-gray-400">
                        {r.notVisitedCustomers.map((c) => c.nameAr).join('، ')}
                      </div>
                    ) : (
                      <div className="text-xs text-green-600">تمت كل الزيارات</div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function RoutesPane() {
  const [shifts, setShifts] = useState<GeoShiftListItem[] | null>(null);
  const [selected, setSelected] = useState<GeoRoute | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<GeoShiftListItem[]>('/geo/shifts')
      .then((d) => {
        if (!cancelled) setShifts(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل الورديات');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const view = (id: number) => {
    setSelected(null);
    get<GeoRoute>(`/geo/shifts/${id}/route`)
      .then((d) => setSelected(d))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل تحميل المسار'));
  };

  return (
    <div>
      {error ? <ErrorBox message={error} /> : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white lg:col-span-1">
          <div className="border-b border-gray-100 px-4 py-3 font-semibold text-gray-800">
            الورديات (آخر 50)
          </div>
          {!shifts ? <div className="p-4"><Spinner /></div> : null}
          {shifts && shifts.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">لا توجد ورديات في هذه الفترة</div>
          ) : null}
          <div className="max-h-[520px] overflow-y-auto">
            {shifts?.map((s) => (
              <button
                key={s.id}
                onClick={() => view(s.id)}
                className="flex w-full items-center justify-between border-b border-gray-50 px-4 py-3 text-right hover:bg-blue-50"
              >
                <div>
                  <div className="text-sm font-semibold text-gray-800">
                    {s.rep.name} <span className="font-normal text-gray-400">({s.rep.repCode})</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(s.startedAt)}
                    {s.endedAt ? '' : ' — جارية الآن'}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {s._count.locations} موضع · {s._count.visits} زيارة
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-300 text-sm text-gray-400">
              اختر وردية لعرض مسارها
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div className="font-semibold text-gray-800">
                  مسار {selected.shift.rep.name}
                  <span className="mr-2 text-xs font-normal text-gray-400">
                    {formatDate(selected.shift.startedAt)}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {(function () {
                    const link = routeLink(selected);
                    return link ? (
                      <a href={link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                        فتح المسار في خرائط جوجل
                      </a>
                    ) : null;
                  })()}
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 text-center rtl:divide-x-reverse">
                <div className="px-2 py-3">
                  <div className="text-lg font-bold text-gray-800">{km(selected.totalDistanceM)}</div>
                  <div className="text-xs text-gray-500">المسافة</div>
                </div>
                <div className="px-2 py-3">
                  <div className="text-lg font-bold text-gray-800">{selected.estimatedDwellMinutes} د</div>
                  <div className="text-xs text-gray-500">وقت التوقف</div>
                </div>
                <div className="px-2 py-3">
                  <div className="text-lg font-bold text-gray-800">{selected.points.length}</div>
                  <div className="text-xs text-gray-500">نقطة مسار</div>
                </div>
              </div>
              {selected.visits.length > 0 ? (
                <div className="border-b border-gray-100 px-4 py-3">
                  <div className="mb-2 text-sm font-semibold text-gray-700">الزيارات الميدانية</div>
                  <div className="flex flex-wrap gap-2">
                    {selected.visits.map((v: GeoRouteVisit) => (
                      <span
                        key={v.id}
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-1 text-xs ${
                          v.status === 'MISSED'
                            ? 'bg-red-50 text-red-700'
                            : v.outOfRange
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-green-50 text-green-700'
                        }`}
                      >
                        {v.customer} ({formatDate(v.at)})
                        {v.outOfRange ? ' — خارج النطاق' : null}
                        {v.reason ? <span className="text-gray-500">{v.reason}</span> : null}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {selected.points.length === 0 ? (
                <div className="p-6 text-sm text-gray-400">لا توجد نقاط مسار مسجلة لهذه الوردية</div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto px-4 py-3">
                  <div className="text-sm text-gray-500">
                    {selected.points.map((p, i) => (
                      <div key={p.id} className="my-1 flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                          {i + 1}
                        </span>
                        <span className="font-mono text-xs">
                          {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                        </span>
                        <span className="text-xs text-gray-400">{formatDate(p.at)}</span>
                        {i < selected.points.length - 1 ? (
                          <span className="text-gray-300">←</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}