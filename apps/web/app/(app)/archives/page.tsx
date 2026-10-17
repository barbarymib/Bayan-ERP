'use client';

import { useEffect, useState } from 'react';
import {
  API_URL,
  can,
  get,
  getToken,
  post,
  qs,
  type ArchiveCheck,
  type ArchiveConfirmResult,
  type ArchiveRestoreResult,
  type ArchiveRun,
  type ArchiveRunResult,
  type ArchiveStatus,
  type ArchiveSummary,
  type ArchiveViewer,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  Button,
  ErrorBox,
  Field,
  Notice,
  PageHeader,
  Select,
  Spinner,
  Td,
  TextInput,
  Th,
  formatDate,
  today,
} from '@/components/ui';

type Tab = 'wizard' | 'log' | 'viewer';

const STATUS: Record<ArchiveStatus, { label: string; color: string }> = {
  PRECHECKS: { label: 'قيد الفحص', color: 'gray' },
  READY: { label: 'جاهزة للتأكيد', color: 'blue' },
  CONFIRMED: { label: 'مُرحّلة', color: 'green' },
  RESTORED: { label: 'مُستعادة', color: 'gray' },
  FAILED: { label: 'فاشلة', color: 'red' },
};

async function downloadBundle(id: number, code: string, setError: (m: string | null) => void): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/archives/${id}/bundle`, {
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    });
    if (!res.ok) throw new Error(`فشل تنزيل الحزمة (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${code}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'فشل تنزيل الحزمة');
  }
}

export default function ArchivesPage() {
  const { user } = useAuth();
  const canRun = can(user, 'archive.run');

  const [tab, setTab] = useState<Tab>('wizard');

  if (!canRun) {
    return (
      <div>
        <PageHeader title="الترحيل والأرشفة" />
        <ErrorBox message="ليست لديك صلاحية تشغيل عمليات الترحيل" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'wizard', label: 'ترحيل جديد' },
    { id: 'log', label: 'سجل العمليات' },
    { id: 'viewer', label: 'عارض الأرشيف' },
  ];

  return (
    <div>
      <PageHeader title="الترحيل والأرشفة" />
      <ReminderBanner />
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
      {tab === 'wizard' ? <WizardPane /> : null}
      {tab === 'log' ? <LogPane onView={() => setTab('viewer')} /> : null}
      {tab === 'viewer' ? <ViewerPane /> : null}
    </div>
  );
}

function ReminderBanner() {
  const [summary, setSummary] = useState<ArchiveSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<ArchiveSummary>('/archives/summary')
      .then((d) => {
        if (!cancelled) setSummary(d);
      })
      .catch(() => {
        /* يتجاهل — الشريط اختياري */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary) return null;
  if (summary.reminder) {
    return (
      <div className="mb-4">
        <Notice type="error">{summary.reminder}</Notice>
      </div>
    );
  }
  if (summary.readyRuns > 0) {
    return (
      <div className="mb-4">
        <Notice type="success">لديك {summary.readyRuns} حزمة جاهزة بانتظار التأكيد في سجل العمليات.</Notice>
      </div>
    );
  }
  return null;
}

function CheckList({ checks }: { checks: ArchiveCheck[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {checks.map((c) => (
        <div key={c.key} className="flex items-center justify-between border-b border-gray-100 px-4 py-2 last:border-b-0">
          <div className="flex items-center gap-2">
            {c.ok ? <Badge color="green">سليم</Badge> : <Badge color="red">متوقف</Badge>}
            <span className="text-sm font-semibold text-gray-800">{c.label}</span>
          </div>
          {c.detail ? <span className="text-xs text-gray-500">{c.detail}</span> : null}
        </div>
      ))}
    </div>
  );
}

function fmtRange(r: { fromDate: string; toDate: string }): string {
  return `${r.fromDate.slice(0, 10)} ← ${r.toDate.slice(0, 10)}`;
}

function WizardPane() {
  const [fromDate, setFromDate] = useState('2020-01-01');
  const [toDate, setToDate] = useState(today());
  const [note, setNote] = useState('');
  const [checks, setChecks] = useState<ArchiveCheck[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ArchiveRunResult | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [bundleSaved, setBundleSaved] = useState(false);
  const [bundleLocation, setBundleLocation] = useState('');
  const [confirmed, setConfirmed] = useState<ArchiveConfirmResult | null>(null);

  const allOk = !!checks && checks.every((c) => c.ok);

  const doPrecheck = () => {
    setBusy(true);
    setError(null);
    setConfirmed(null);
    post<ArchiveCheck[]>('/archives/prechecks', { fromDate, toDate })
      .then((d) => setChecks(d))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل الفحص'))
      .finally(() => setBusy(false));
  };

  const doRun = () => {
    setBusy(true);
    setError(null);
    setConfirmed(null);
    post<ArchiveRunResult>('/archives/run', { fromDate, toDate, note })
      .then((d) => {
        setResult(d);
        if (d.checks) setChecks(d.checks);
        if (!d.id) setError(d.message ?? 'فشل فحص ما قبل الترحيل');
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل تنفيذ الترحيل'))
      .finally(() => setBusy(false));
  };

  const doConfirm = () => {
    if (!result?.id) return;
    setBusy(true);
    setError(null);
    post<ArchiveConfirmResult>(`/archives/${result.id}/confirm`, {
      confirmText,
      bundleSaved,
      bundleLocation: bundleLocation.trim() || undefined,
    })
      .then((d) => {
        setConfirmed(d);
        setResult(null);
        setChecks(null);
        setConfirmText('');
        setBundleSaved(false);
        setBundleLocation('');
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل التأكيد'))
      .finally(() => setBusy(false));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="من تاريخ">
            <TextInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </Field>
          <Field label="إلى تاريخ" hint="كل البيانات قبل تاريخ البداية يجب أن تكون مُرحّلة">
            <TextInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </Field>
          <Field label="ملاحظة">
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={doPrecheck} disabled={busy}>
            فحص ما قبل الترحيل
          </Button>
          <Button onClick={doRun} disabled={busy || (!!checks && !allOk)}>
            تنفيذ الترحيل (نسخة + تصدير)
          </Button>
        </div>
      </div>

      {busy ? <Spinner /> : null}
      {error ? <ErrorBox message={error} /> : null}
      {checks ? <CheckList checks={checks} /> : null}

      {result?.id ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="mb-2 text-sm font-bold text-blue-800">
            الحزمة {result.code} جاهزة — {fmtRange(result.manifest ?? { fromDate, toDate })}
          </div>
          <Notice type="success">
            تم إنشاء النسخة الاحتياطية والتصدير ومطابقة الأعداد. الخطوة ١: نزّل الحزمة واحفظها في مكان آمن
            (قرص خارجي / مشاركة شبكة). الخطوة ٢: أقرّ بحفظها ثم اكتب كلمة «أرشفة» وأكّد الحذف.
          </Notice>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => downloadBundle(result.id!, result.code ?? '', setError)} disabled={busy}>
              تنزيل حزمة النسخ الاحتياطي (zip)
            </Button>
            {result.bundleSha256 ? (
              <span className="font-mono text-xs text-gray-500" dir="ltr">
                SHA-256: {result.bundleSha256.slice(0, 16)}…
              </span>
            ) : null}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={bundleSaved} onChange={(e) => setBundleSaved(e.target.checked)} />
            أقرّ بأنني حفظت حزمة النسخ الاحتياطي في مكان آمن بعيدًا عن الخادم
          </label>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field label="مكان حفظ الحزمة (اختياري)">
              <TextInput
                value={bundleLocation}
                onChange={(e) => setBundleLocation(e.target.value)}
                placeholder="قرص خارجي / مشاركة الشبكة"
              />
            </Field>
            <Field label='اكتب كلمة "أرشفة" للتأكيد'>
              <TextInput value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </Field>
            <Button
              variant="danger"
              onClick={doConfirm}
              disabled={busy || !bundleSaved || confirmText.trim() !== 'أرشفة'}
            >
              تأكيد الترحيل والحذف
            </Button>
          </div>
        </div>
      ) : null}

      {confirmed ? (
        <Notice type="success">
          تم ترحيل الحزمة {confirmed.code} بنجاح — حُذف:{' '}
          {Object.entries(confirmed.deleted)
            .filter(([, n]) => n > 0)
            .map(([k, n]) => `${k}=${n}`)
            .join('، ') || 'لا شيء'}
          ؛ أرصدة افتتاحية: {Object.entries(confirmed.openingBalances).map(([k, n]) => `${k}=${n}`).join('، ')}؛
          حسابات دفتر مرحّلة: {confirmed.rolledLedgerAccounts}
          {confirmed.bundleSaved
            ? `؛ تم إقرار حفظ الحزمة${confirmed.bundleLocation ? ` في: ${confirmed.bundleLocation}` : ''}.`
            : ''}
        </Notice>
      ) : null}
    </div>
  );
}

function LogPane({ onView }: { onView: () => void }) {
  const [runs, setRuns] = useState<ArchiveRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<ArchiveRun[]>('/archives')
      .then((d) => {
        if (!cancelled) {
          setRuns(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل السجل');
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const doRestore = (run: ArchiveRun) => {
    const word = window.prompt('الاستعادة تُعيد البيانات المحذوفة. اكتب كلمة "استعادة" للتأكيد:', '');
    if (word === null) return;
    setNotice(null);
    post<ArchiveRestoreResult>(`/archives/${run.id}/restore`, { confirmText: word })
      .then((d) => {
        setNotice(`تمت استعادة الحزمة ${d.code} — ${Object.values(d.restored).reduce((a, b) => a + b, 0)} سجلاً`);
        setReload((x) => x + 1);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشلت الاستعادة'));
  };

  if (!runs) {
    return error ? <ErrorBox message={error} onRetry={() => setReload((x) => x + 1)} /> : <Spinner />;
  }

  return (
    <div className="space-y-3">
      {error ? <ErrorBox message={error} /> : null}
      {notice ? <Notice type="success">{notice}</Notice> : null}
      {runs.length === 0 ? <ErrorBox message="لا توجد عمليات ترحيل بعد" /> : null}
      {runs.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <Th>الكود</Th>
                <Th>الفترة</Th>
                <Th>الحالة</Th>
                <Th>أنشأها</Th>
                <Th>تاريخ الإنشاء</Th>
                <Th>إجراءات</Th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const st = STATUS[r.status];
                return (
                  <tr key={r.id} className="border-t border-gray-100">
                    <Td className="font-mono">{r.code}</Td>
                    <Td>{fmtRange(r)}</Td>
                    <Td>{st ? <Badge color={st.color}>{st.label}</Badge> : r.status}</Td>
                    <Td>{r.createdBy?.name ?? '—'}</Td>
                    <Td>{formatDate(r.createdAt)}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        {r.bundlePath ? (
                          <button
                            className="text-sm font-semibold text-blue-600 hover:underline"
                            onClick={() => downloadBundle(r.id, r.code, setError)}
                          >
                            تنزيل
                          </button>
                        ) : null}
                        {r.bundlePath ? (
                          <button
                            className="text-sm font-semibold text-blue-600 hover:underline"
                            onClick={() => {
                              window.localStorage.setItem('bayan_archive_view', String(r.id));
                              onView();
                            }}
                          >
                            عرض
                          </button>
                        ) : null}
                        {r.status === 'CONFIRMED' ? (
                          <button
                            className="text-sm font-semibold text-red-600 hover:underline"
                            onClick={() => doRestore(r)}
                          >
                            استعادة
                          </button>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function ViewerPane() {
  const [runs, setRuns] = useState<ArchiveRun[] | null>(null);
  const [runId, setRunId] = useState<number | ''>('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState<ArchiveViewer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<ArchiveRun[]>('/archives')
      .then((d) => {
        if (cancelled) return;
        const withBundle = d.filter((r) => r.bundlePath);
        setRuns(withBundle);
        const preselect = Number(window.localStorage.getItem('bayan_archive_view') ?? '');
        if (preselect && withBundle.some((r) => r.id === preselect)) setRunId(preselect);
        else if (withBundle.length > 0) setRunId(withBundle[0].id);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل الحزم');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = () => {
    if (!runId) return;
    setBusy(true);
    setError(null);
    get<ArchiveViewer>(`/archives/${runId}/data${qs({ type: type || undefined, q, limit: 200 })}`)
      .then((d) => setData(d))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل تحميل بيانات الحزمة'))
      .finally(() => setBusy(false));
  };

  if (!runs) {
    return error ? <ErrorBox message={error} /> : <Spinner />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <Field label="الحزمة">
          <Select value={runId} onChange={(e) => setRunId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">— اختر —</option>
            {(runs ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {fmtRange(r)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الجدول">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">كل الجداول</option>
            {data
              ? Object.keys(data.counts).map((k) => (
                  <option key={k} value={k}>
                    {data.labels[k] ?? k}
                  </option>
                ))
              : null}
          </Select>
        </Field>
        <Field label="بحث">
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="نص للبحث" />
        </Field>
        <Button onClick={load} disabled={busy || runId === ''}>
          تحميل
        </Button>
        {data ? (
          <Button variant="secondary" onClick={() => window.print()}>
            طباعة
          </Button>
        ) : null}
      </div>

      {error ? <ErrorBox message={error} /> : null}
      {busy ? <Spinner /> : null}
      {(runs ?? []).length === 0 ? <ErrorBox message="لا توجد حزم قابلة للعرض" /> : null}

      {data ? (
        <div className="space-y-4">
          <div className="text-sm text-gray-500">
            الحزمة {data.code} — {fmtRange(data)} {data.truncated ? '— النتائج مختصرة' : ''}
          </div>
          {Object.entries(data.rows).map(([table, rows]) => (
            <TableBlock
              key={table}
              title={data.labels[table] ?? table}
              rows={rows}
              empty={data.counts[table] ?? 0}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TableBlock({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Record<string, unknown>[];
  empty: number;
}) {
  const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm font-bold text-gray-700">
        {title} <span className="text-xs font-normal text-gray-400">({empty})</span>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-3 text-sm text-gray-400">لا بيانات</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {cols.map((c) => (
                  <Th key={c}>{c}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-gray-100">
                  {cols.map((c) => (
                    <Td key={c}>{typeof r[c] === 'object' ? JSON.stringify(r[c]) : String(r[c] ?? '')}</Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}