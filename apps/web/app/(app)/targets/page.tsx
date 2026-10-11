'use client';

import { useEffect, useState } from 'react';
import {
  can,
  del,
  get,
  post,
  qs,
  type CommissionReport,
  type RepTarget,
  type RepTargetsPage,
  type User,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  Button,
  ErrorBox,
  Field,
  formatMoney,
  Modal,
  Notice,
  PageHeader,
  Select,
  Td,
  TextInput,
  Th,
} from '@/components/ui';

const BASE_LABEL = { SALES: 'المبيعات المعتمدة', COLLECTED: 'المحصّل الفعلي' } as const;

const monthBounds = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`,
    to: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    )}`,
  };
};

export default function RepTargetsPage() {
  const { user } = useAuth();
  const manage = can(user, 'user.manage');
  const canReport = can(user, 'report.view');

  const [items, setItems] = useState<RepTarget[]>([]);
  const [report, setReport] = useState<CommissionReport | null>(null);
  const [period, setPeriod] = useState(monthBounds());
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const targetsReq = get<RepTargetsPage>(`/rep-targets${qs({ limit: 200 })}`);
    const reportReq = canReport
      ? get<CommissionReport>(`/rep-targets/report${qs({ from: period.from, to: period.to })}`)
      : Promise.resolve(null);
    Promise.all([targetsReq, reportReq])
      .then(([t, r]) => {
        if (!cancelled) {
          setItems(t.items);
          setReport(r);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل التحميل');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period.from, period.to, refresh, canReport]);

  async function recalculate(id: number) {
    setBusyId(id);
    try {
      const res = await post<RepTarget>(`/rep-targets/${id}/recalculate`, {});
      setNotice(
        `أُعيد الحساب: الإنجاز ${formatMoney(res.achieved)} والعمولة ${formatMoney(res.commissionDue)}`,
      );
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إعادة الحساب');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    if (!confirm('حذف التارجت؟')) return;
    try {
      await del(`/rep-targets/${id}`);
      setNotice('تم الحذف');
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحذف');
    }
  }

  return (
    <div>
      <PageHeader
        title="التارجت والعمولات"
        action={manage ? <Button onClick={() => setCreateOpen(true)}>+ تارجت جديد</Button> : undefined}
      />

      {notice ? (
        <div className="mb-3">
          <Notice type="success">{notice}</Notice>
        </div>
      ) : null}
      {error ? <div className="mb-3"><ErrorBox message={error} /></div> : null}

      <div className="mb-6 overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>المندوب</Th>
              <Th>الفترة</Th>
              <Th>الهدف</Th>
              <Th>الإنجاز</Th>
              <Th>نسبة الإنجاز</Th>
              <Th>العمولة</Th>
              <Th>أساس العمولة</Th>
              <Th>الحالة</Th>
              {manage ? <Th>إجراءات</Th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400" colSpan={manage ? 9 : 8}>
                  جارِ التحميل…
                </Td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400" colSpan={manage ? 9 : 8}>
                  لا توجد أهداف محددة
                </Td>
              </tr>
            ) : (
              items.map((t) => (
                <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-semibold">
                    {t.rep.name}{' '}
                    <span className="font-mono text-xs text-gray-400">{t.rep.repCode}</span>
                  </Td>
                  <Td>
                    {new Date(t.fromDate).toLocaleDateString('ar-EG')} —{' '}
                    {new Date(t.toDate).toLocaleDateString('ar-EG')}
                  </Td>
                  <Td className="font-semibold">{formatMoney(t.targetAmount)}</Td>
                  <Td className="font-semibold">{formatMoney(t.achieved)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded bg-gray-200">
                        <div
                          className="h-full rounded bg-blue-600"
                          style={{ width: `${Math.min(100, t.achievementPct)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{t.achievementPct}%</span>
                    </div>
                  </Td>
                  <Td className="font-semibold">{formatMoney(t.commissionDue)}</Td>
                  <Td>
                    <Badge color="blue">{BASE_LABEL[t.commissionBase]}</Badge>
                  </Td>
                  <Td>
                    {t.active ? <Badge color="green">نشط</Badge> : <Badge color="red">موقوف</Badge>}
                  </Td>
                  {manage ? (
                    <Td>
                      <div className="flex gap-1">
                        <Button
                          variant="secondary"
                          disabled={busyId === t.id}
                          onClick={() => void recalculate(t.id)}
                        >
                          إعادة حساب
                        </Button>
                        <Button variant="secondary" onClick={() => void remove(t.id)}>
                          حذف
                        </Button>
                      </div>
                    </Td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canReport ? (
        <>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <h2 className="text-lg font-bold text-gray-900">تقرير العمولات</h2>
            <Field label="من">
              <TextInput
                type="date"
                value={period.from}
                onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))}
              />
            </Field>
            <Field label="إلى">
              <TextInput
                type="date"
                value={period.to}
                onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))}
              />
            </Field>
            <Button variant="secondary" onClick={() => setRefresh((s) => s + 1)}>
              تحديث
            </Button>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3">
            <StatCard label="إجمالي الأهداف" value={formatMoney(report?.totals.target ?? 0)} />
            <StatCard label="إجمالي الإنجاز" value={formatMoney(report?.totals.achieved ?? 0)} />
            <StatCard
              label="إجمالي العمولات المستحقة"
              value={formatMoney(report?.totals.commission ?? 0)}
              accent
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-max border-collapse">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <Th>المندوب</Th>
                  <Th>الهدف</Th>
                  <Th>الإنجاز</Th>
                  <Th>نسبة الإنجاز</Th>
                  <Th>العمولة</Th>
                </tr>
              </thead>
              <tbody>
                {(report?.rows ?? []).length === 0 ? (
                  <tr>
                    <Td className="py-6 text-center text-gray-400" colSpan={5}>
                      لا توجد بيانات للفترة المحددة
                    </Td>
                  </tr>
                ) : (
                  (report?.rows ?? []).map((r) => (
                    <tr key={r.id} className="border-b border-gray-100 last:border-0">
                      <Td className="font-semibold">
                        {r.rep.name}{' '}
                        <span className="font-mono text-xs text-gray-400">{r.rep.repCode}</span>
                      </Td>
                      <Td>{formatMoney(r.targetAmount)}</Td>
                      <Td className="font-semibold">{formatMoney(r.achieved)}</Td>
                      <Td>{r.achievementPct}%</Td>
                      <Td className="font-semibold">{formatMoney(r.commissionDue)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {createOpen ? (
        <TargetModal
          onClose={() => setCreateOpen(false)}
          onSaved={(msg) => {
            setCreateOpen(false);
            setNotice(msg);
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${accent ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}
    >
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-black ${accent ? 'text-blue-700' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
}

function TargetModal({ onClose, onSaved }: { onClose: () => void; onSaved: (msg: string) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [repCode, setRepCode] = useState('');
  const [periodType, setPeriodType] = useState('MONTHLY');
  const [fromDate, setFromDate] = useState(monthBounds().from);
  const [toDate, setToDate] = useState(monthBounds().to);
  const [targetAmount, setTargetAmount] = useState('');
  const [commissionBase, setCommissionBase] = useState<'SALES' | 'COLLECTED'>('SALES');
  const [commissionRate, setCommissionRate] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get<{ users: User[] }>('/users?limit=200')
      .then((d) => setUsers(d.users.filter((u) => u.repCode)))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل تحميل المستخدمين'));
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await post('/rep-targets', {
        repCode,
        periodType,
        fromDate,
        toDate,
        targetAmount: Number(targetAmount),
        commissionBase,
        commissionRate: Number(commissionRate),
      });
      onSaved('تم إنشاء التارجت');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحفظ');
      setBusy(false);
    }
  }

  return (
    <Modal title="تارجت جديد" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="المندوب">
          <Select value={repCode} onChange={(e) => setRepCode(e.target.value)} required>
            <option value="">— اختر —</option>
            {users.map((u) => (
              <option key={u.id} value={u.repCode ?? ''}>
                {u.repCode} — {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="نوع الفترة">
          <Select value={periodType} onChange={(e) => setPeriodType(e.target.value)}>
            <option value="MONTHLY">شهري</option>
            <option value="QUARTERLY">ربع سنوي</option>
            <option value="CUSTOM">مخصص</option>
          </Select>
        </Field>
        <Field label="من تاريخ">
          <TextInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </Field>
        <Field label="إلى تاريخ">
          <TextInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </Field>
        <Field label="قيمة الهدف">
          <TextInput
            type="number"
            min={0}
            step="any"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            dir="ltr"
            required
          />
        </Field>
        <Field label="نسبة العمولة %">
          <TextInput
            type="number"
            min={0}
            max={100}
            step="any"
            value={commissionRate}
            onChange={(e) => setCommissionRate(e.target.value)}
            dir="ltr"
            required
          />
        </Field>
        <Field label="أساس العمولة">
          <Select
            value={commissionBase}
            onChange={(e) => setCommissionBase(e.target.value as 'SALES' | 'COLLECTED')}
          >
            <option value="SALES">المبيعات المعتمدة</option>
            <option value="COLLECTED">المحصّل فعلياً</option>
          </Select>
        </Field>
      </div>
      <div className="mb-3 text-xs text-gray-400">
        تُحسب الإنجاز والعمولة آلياً من السندات المعتمدة أو التحصيلات حسب الأساس المختار.
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
        <Button onClick={() => void submit()} disabled={busy}>
          {busy ? 'جارِ الحفظ…' : 'حفظ'}
        </Button>
      </div>
    </Modal>
  );
}
