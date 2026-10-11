'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  can,
  get,
  post,
  qs,
  type Customer,
  type CustomersPage,
  type UsersPage,
  type VisitPlan,
  type VisitPlanLineDoc,
  type VisitPlansPage,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  Button,
  ErrorBox,
  Field,
  Modal,
  Notice,
  PageHeader,
  Select,
  Td,
  TextInput,
  Th,
  formatDate,
  today,
} from '@/components/ui';

const STATUS_LABEL: Record<VisitPlanLineDoc['status'], { text: string; color: string }> = {
  PLANNED: { text: 'مخطط', color: 'blue' },
  DONE: { text: 'تمت', color: 'green' },
  MISSED: { text: 'لم تتم', color: 'red' },
};

export default function VisitPlansPage() {
  const { user } = useAuth();
  const canView = can(user, 'visit.plan.view');
  const canManage = can(user, 'visit.plan.manage');

  const [rows, setRows] = useState<VisitPlan[]>([]);
  const [reps, setReps] = useState<{ id: number; name: string; repCode: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    get<VisitPlansPage>(`/visits/plans${qs({ limit: 30 })}`)
      .then((d) => {
        if (!cancelled) {
          setRows(d.items);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل خطط الزيارات');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    get<UsersPage>(`/users${qs({ limit: 200 })}`)
      .then((u) => {
        if (!cancelled) setReps(u.users.filter((x) => x.repCode).map((x) => ({ id: x.id, name: x.name, repCode: x.repCode })));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [refresh, canView]);

  if (!canView) {
    return (
      <div>
        <PageHeader title="خطط الزيارات" />
        <ErrorBox message="ليست لديك صلاحية عرض خطط الزيارات" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="خطط الزيارات"
        action={canManage ? <Button onClick={() => setCreateOpen(true)}>+ خطة زيارات</Button> : undefined}
      />
      {notice ? (
        <div className="mb-3">
          <Notice type="success">{notice}</Notice>
        </div>
      ) : null}
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((s) => s + 1)} /> : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>التاريخ</Th>
              <Th>المندوب</Th>
              <Th>الزيارات</Th>
              <Th>المنفّذة</Th>
              <Th>ملاحظات</Th>
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
                <Td className="py-6 text-center text-gray-400">لا توجد خطط زيارات</Td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-semibold">{formatDate(p.date)}</Td>
                  <Td>{reps.find((r) => r.id === p.repId)?.name ?? `#${p.repId}`}</Td>
                  <Td>{p._count?.lines ?? 0}</Td>
                  <Td>{p._count?.done ?? 0}</Td>
                  <Td className="max-w-xs truncate text-gray-500">{p.notes ?? '—'}</Td>
                  <Td>
                    <Button variant="ghost" onClick={() => setDetailId(p.id)}>
                      عرض
                    </Button>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {createOpen ? (
        <CreatePlanModal
          reps={reps}
          defaultRepId={user?.sub ?? null}
          onClose={() => setCreateOpen(false)}
          onSaved={(date) => {
            setCreateOpen(false);
            setNotice(`تم حفظ خطة زيارات ${date}`);
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}
      {detailId ? (
        <PlanDetailModal
          planId={detailId}
          canManage={canManage}
          onClose={() => setDetailId(null)}
          onChanged={() => setRefresh((s) => s + 1)}
        />
      ) : null}
    </div>
  );
}

type LineRow = { customerId: string; notes: string };

function CreatePlanModal({
  reps,
  defaultRepId,
  onClose,
  onSaved,
}: {
  reps: { id: number; name: string; repCode: string | null }[];
  defaultRepId: number | null;
  onClose: () => void;
  onSaved: (date: string) => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [repId, setRepId] = useState(defaultRepId ? String(defaultRepId) : '');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineRow[]>([{ customerId: '', notes: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    get<CustomersPage>(`/customers${qs({ limit: 500 })}`)
      .then((d) => {
        if (!cancelled) setCustomers(d.customers);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function updateLine(i: number, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const cleaned = lines
      .filter((l) => l.customerId)
      .map((l, i) => ({ customerId: Number(l.customerId), sequence: i + 1, notes: l.notes.trim() || undefined }));
    try {
      await post('/visits/plans', {
        repId: repId ? Number(repId) : undefined,
        date,
        notes: notes.trim() || undefined,
        lines: cleaned,
      });
      onSaved(date);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ خطة الزيارات');
      setBusy(false);
    }
  }

  return (
    <Modal title="خطة زيارات" onClose={onClose}>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Field label="المندوب">
          <Select value={repId} onChange={(e) => setRepId(e.target.value)}>
            <option value="">المستخدم الحالي</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.repCode} — {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="التاريخ">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="ملاحظات">
          <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      <div className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-700">العملاء المخطط زيارتهم</span>
          <Button variant="secondary" onClick={() => setLines([...lines, { customerId: '', notes: '' }])}>
            + إضافة عميل
          </Button>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-gray-200 p-2">
              <div className="col-span-6">
                <Field label="العميل">
                  <Select value={l.customerId} onChange={(e) => updateLine(i, { customerId: e.target.value })}>
                    <option value="">—</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.nameAr}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="col-span-5">
                <Field label="ملاحظات">
                  <TextInput value={l.notes} onChange={(e) => updateLine(i, { notes: e.target.value })} />
                </Field>
              </div>
              <div className="col-span-1 flex justify-end">
                <Button variant="danger" onClick={() => setLines(lines.filter((_, j) => j !== i))} disabled={lines.length === 1}>
                  ×
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <div className="mb-3">
          <ErrorBox message={error} />
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          إلغاء
        </Button>
        <Button onClick={submit} disabled={busy || lines.every((l) => !l.customerId)}>
          {busy ? 'جارِ الحفظ…' : 'حفظ الخطة'}
        </Button>
      </div>
    </Modal>
  );
}

function PlanDetailModal({
  planId,
  canManage,
  onClose,
  onChanged,
}: {
  planId: number;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [plan, setPlan] = useState<VisitPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyLine, setBusyLine] = useState<number | null>(null);

  const load = useCallback(() => {
    get<VisitPlan>(`/visits/plans/${planId}`)
      .then((d) => setPlan(d))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل تحميل الخطة'));
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(lineId: number, status: VisitPlanLineDoc['status']) {
    setBusyLine(lineId);
    try {
      await post(`/visits/plans/${planId}/lines/${lineId}/status`, { status });
      load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحديث الحالة');
    } finally {
      setBusyLine(null);
    }
  }

  const lines = plan?.lines ?? [];

  return (
    <Modal title={plan ? `خطة زيارات ${formatDate(plan.date)}` : 'خطة زيارات'} onClose={onClose}>
      {error ? <ErrorBox message={error} /> : null}
      {!plan ? (
        <div className="py-6 text-center text-gray-400">جارِ التحميل…</div>
      ) : lines.length === 0 ? (
        <div className="py-6 text-center text-gray-400">لا توجد زيارات في الخطة</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full min-w-max">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <Th>#</Th>
                <Th>العميل</Th>
                <Th>الهاتف</Th>
                <Th>الحالة</Th>
                {canManage ? <Th></Th> : null}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const st = STATUS_LABEL[l.status];
                return (
                  <tr key={l.id} className="border-b border-gray-100 last:border-0">
                    <Td>{l.sequence}</Td>
                    <Td>
                      <div className="font-semibold">{l.customer?.nameAr}</div>
                      <div className="text-xs text-gray-400">{l.customer?.code}</div>
                    </Td>
                    <Td dir="ltr">{l.customer?.phone ?? '—'}</Td>
                    <Td>
                      <Badge color={st.color}>{st.text}</Badge>
                    </Td>
                    {canManage ? (
                      <Td>
                        <div className="flex gap-1">
                          {(['PLANNED', 'DONE', 'MISSED'] as const).map((s) => (
                            <Button
                              key={s}
                              variant={l.status === s ? 'primary' : 'secondary'}
                              disabled={busyLine === l.id || l.status === s}
                              onClick={() => setStatus(l.id, s)}
                            >
                              {STATUS_LABEL[s].text}
                            </Button>
                          ))}
                        </div>
                      </Td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          إغلاق
        </Button>
      </div>
    </Modal>
  );
}
