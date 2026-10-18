'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  can,
  get,
  post,
  qs,
  type CashAccount,
  type CashAccountStatement,
  type CashAccountsResponse,
  type CashSummary,
  type CustodyHandoverDetail,
  type CustodyReconciliation,
  type DailyCloseRow,
  type HandoversResponse,
  type UsersPage,
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
  formatMoney,
  today,
} from '@/components/ui';

export default function TreasuryPage() {
  const { user } = useAuth();
  const canView = can(user, 'treasury.view');
  const canManage = can(user, 'treasury.manage');
  const canHandover = can(user, 'cash.handover');
  const canClose = can(user, 'daily_close.execute');
  const canStatement = can(user, 'ledger.view');

  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [handovers, setHandovers] = useState<HandoversResponse | null>(null);
  const [closes, setCloses] = useState<DailyCloseRow[]>([]);
  const [reps, setReps] = useState<{ id: number; name: string; repCode: string | null }[]>([]);

  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [statementId, setStatementId] = useState<number | null>(null);
  const [handoverDetailId, setHandoverDetailId] = useState<number | null>(null);

  const [reconRep, setReconRep] = useState('');
  const [reconFrom, setReconFrom] = useState('');
  const [reconTo, setReconTo] = useState('');
  const [recon, setRecon] = useState<CustodyReconciliation | null>(null);
  const [reconBusy, setReconBusy] = useState(false);

  const [closeDate, setCloseDate] = useState(today());
  const [counted, setCounted] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!canView) return;
    Promise.all([
      get<CashSummary>('/treasury/summary'),
      get<CashAccountsResponse>('/treasury/accounts'),
      get<HandoversResponse>(`/treasury/handovers${qs({ limit: 20 })}`),
      get<DailyCloseRow[]>('/treasury/daily-close'),
    ])
      .then(([s, a, h, c]) => {
        if (!cancelled) {
          setSummary(s);
          setAccounts(a.items);
          setHandovers(h);
          setCloses(c);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل بيانات الخزينة');
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

  const runClose = useCallback(async () => {
    setClosing(true);
    setError(null);
    try {
      const res = await post<DailyCloseRow>('/treasury/daily-close', {
        date: closeDate,
        countedBalance: counted ? Number(counted) : undefined,
        notes: closeNotes.trim() || undefined,
      });
      setNotice(`تم إقفال يوم ${closeDate} برصيد ختامي ${formatMoney(res.closingBalance)}`);
      setCounted('');
      setCloseNotes('');
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الإقفال اليومي');
    } finally {
      setClosing(false);
    }
  }, [closeDate, counted, closeNotes]);

  const runRecon = useCallback(async () => {
    if (!reconRep) return;
    setReconBusy(true);
    setError(null);
    try {
      const res = await get<CustodyReconciliation>(
        `/treasury/custody-reconciliation${qs({ repId: Number(reconRep), from: reconFrom || undefined, to: reconTo || undefined })}`,
      );
      setRecon(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل المطابقة');
    } finally {
      setReconBusy(false);
    }
  }, [reconRep, reconFrom, reconTo]);

  if (!canView) {
    return (
      <div>
        <PageHeader title="الخزينة والإقفال" />
        <ErrorBox message="ليست لديك صلاحية عرض الخزينة" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="الخزينة والإقفال" action={canManage ? <Button onClick={() => setAccountOpen(true)}>+ حساب خزينة</Button> : undefined} />

      {notice ? (
        <div className="mb-3">
          <Notice type="success">{notice}</Notice>
        </div>
      ) : null}
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((s) => s + 1)} /> : null}

      {summary ? (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="رصيد افتتاحي" value={summary.opening} />
          <Stat label="إجمالي القبض" value={summary.receiptsTotal} color="text-emerald-700" />
          <Stat label="إجمالي الصرف" value={summary.paymentsTotal} color="text-red-700" />
          <Stat label="تسليمات العهد" value={summary.handoversTotal} />
          <Stat label="الرصيد الحالي" value={summary.balance} color="text-blue-700" />
        </div>
      ) : null}

      <h2 className="mb-2 text-sm font-bold text-gray-800">حسابات الخزينة</h2>
      <div className="mb-5 overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الكود</Th>
              <Th>الاسم</Th>
              <Th>النوع</Th>
              <Th>رصيد افتتاحي</Th>
              <Th>الحالة</Th>
              {canStatement ? <Th></Th> : null}
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا توجد حسابات خزينة</Td>
              </tr>
            ) : (
              accounts.map((a) => (
                <tr key={a.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-mono font-semibold">{a.code}</Td>
                  <Td className="font-semibold">{a.nameAr}</Td>
                  <Td>
                    <Badge color="blue">{a.type}</Badge>
                  </Td>
                  <Td>{formatMoney(a.openingBalance)}</Td>
                  <Td>{a.active ? <Badge color="green">نشط</Badge> : <Badge color="red">موقوف</Badge>}</Td>
                  {canStatement ? (
                    <Td>
                      <Button variant="ghost" onClick={() => setStatementId(a.id)}>
                        كشف الحساب
                      </Button>
                    </Td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">تسليمات العهد</h2>
            {canHandover ? <Button variant="secondary" onClick={() => setHandoverOpen(true)}>+ تسليم عهدة</Button> : null}
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-max border-collapse">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <Th>الرقم</Th>
                  <Th>التاريخ</Th>
                  <Th>المندوب</Th>
                  <Th>المبلغ</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {!handovers || handovers.items.length === 0 ? (
                  <tr>
                    <Td className="py-6 text-center text-gray-400">لا توجد تسليمات</Td>
                  </tr>
                ) : (
                  handovers.items.map((h) => (
                    <tr key={h.id} className="border-b border-gray-100 last:border-0">
                      <Td className="font-mono font-semibold">{h.number}</Td>
                      <Td>{formatDate(h.date)}</Td>
                      <Td>{reps.find((r) => r.id === h.repId)?.name ?? `#${h.repId}`}</Td>
                      <Td className="font-bold">{formatMoney(h.amount)}</Td>
                      <Td>
                        <Button variant="ghost" onClick={() => setHandoverDetailId(h.id)}>
                          محضر
                        </Button>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-bold text-gray-800">الإقفال اليومي</h2>
          {canClose ? (
            <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-white p-3 sm:grid-cols-4">
              <Field label="التاريخ">
                <TextInput type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
              </Field>
              <Field label="النقد المعدّ (اختياري)">
                <TextInput type="number" min="0" step="any" value={counted} onChange={(e) => setCounted(e.target.value)} />
              </Field>
              <Field label="ملاحظات">
                <TextInput value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
              </Field>
              <div className="flex items-end">
                <Button onClick={runClose} disabled={closing}>
                  {closing ? 'جارِ الإقفال…' : 'تنفيذ الإقفال'}
                </Button>
              </div>
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-max border-collapse">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <Th>التاريخ</Th>
                  <Th>افتتاحي</Th>
                  <Th>قبض</Th>
                  <Th>صرف</Th>
                  <Th>عهد</Th>
                  <Th>ختامي</Th>
                  <Th>فرق</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {closes.length === 0 ? (
                  <tr>
                    <Td className="py-6 text-center text-gray-400">لا توجد إقفالات</Td>
                  </tr>
                ) : (
                  closes.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100 last:border-0">
                      <Td>{formatDate(c.date)}</Td>
                      <Td>{formatMoney(c.openingBalance)}</Td>
                      <Td className="text-emerald-700">{formatMoney(c.receiptsTotal)}</Td>
                      <Td className="text-red-700">{formatMoney(c.paymentsTotal)}</Td>
                      <Td>{formatMoney(c.handoversTotal)}</Td>
                      <Td className="font-bold">{formatMoney(c.closingBalance)}</Td>
                      <Td>{c.difference === null ? '—' : formatMoney(c.difference)}</Td>
                      <Td>
                        <Link
                          href={`/treasury/daily-close/print?date=${c.date.slice(0, 10)}`}
                          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                        >
                          طباعة
                        </Link>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h2 className="mb-2 text-sm font-bold text-gray-800">مطابقة عهدة المندوب</h2>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="w-56">
          <Field label="المندوب">
            <Select value={reconRep} onChange={(e) => setReconRep(e.target.value)}>
              <option value="">اختر مندوباً</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.repCode} — {r.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="من تاريخ">
          <TextInput type="date" value={reconFrom} onChange={(e) => setReconFrom(e.target.value)} />
        </Field>
        <Field label="إلى تاريخ">
          <TextInput type="date" value={reconTo} onChange={(e) => setReconTo(e.target.value)} />
        </Field>
        <Button variant="secondary" onClick={runRecon} disabled={reconBusy || !reconRep}>
          {reconBusy ? 'جارِ المطابقة…' : 'تطابق'}
        </Button>
      </div>

      {recon ? (
        <div className="mb-5">
          <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="إجمالي التحصيل" value={recon.collected} color="text-emerald-700" />
            <Stat label="إجمالي المُسلَّم للخزينة" value={recon.delivered} color="text-blue-700" />
            <Stat label="العهدة القائمة (الفرق)" value={recon.outstanding} color={recon.outstanding > 0 ? 'text-red-700' : 'text-gray-900'} />
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-400">السندات / المحاضر</div>
              <div className="mt-1 text-lg font-black text-gray-900">
                {recon.receiptCount} / {recon.handoverCount}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full min-w-max border-collapse">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <Th>سند القبض</Th>
                    <Th>التاريخ</Th>
                    <Th>العميل</Th>
                    <Th>المبلغ</Th>
                  </tr>
                </thead>
                <tbody>
                  {recon.receipts.length === 0 ? (
                    <tr>
                      <Td className="py-6 text-center text-gray-400">لا توجد تحصيلات في الفترة</Td>
                    </tr>
                  ) : (
                    recon.receipts.map((r) => (
                      <tr key={r.id} className="border-b border-gray-100 last:border-0">
                        <Td className="font-mono font-semibold">{r.number}</Td>
                        <Td>{formatDate(r.date)}</Td>
                        <Td>{r.customer?.nameAr ?? '—'}</Td>
                        <Td className="font-bold text-emerald-700">{formatMoney(r.amount)}</Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full min-w-max border-collapse">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <Th>محضر التسليم</Th>
                    <Th>التاريخ</Th>
                    <Th>الحالة</Th>
                    <Th>المبلغ</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {recon.handovers.length === 0 ? (
                    <tr>
                      <Td className="py-6 text-center text-gray-400">لا توجد تسليمات في الفترة</Td>
                    </tr>
                  ) : (
                    recon.handovers.map((h) => (
                      <tr key={h.id} className="border-b border-gray-100 last:border-0">
                        <Td className="font-mono font-semibold">{h.number}</Td>
                        <Td>{formatDate(h.date)}</Td>
                        <Td>{h.status === 'VOID' ? <Badge color="red">ملغى</Badge> : <Badge color="green">مستلَم</Badge>}</Td>
                        <Td className="font-bold text-blue-700">{formatMoney(h.amount)}</Td>
                        <Td>
                          <Button variant="ghost" onClick={() => setHandoverDetailId(h.id)}>
                            محضر
                          </Button>
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {accountOpen ? (
        <CreateAccountModal
          onClose={() => setAccountOpen(false)}
          onSaved={() => {
            setAccountOpen(false);
            setNotice('تم إنشاء حساب الخزينة');
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}

      {handoverOpen ? (
        <CreateHandoverModal
          reps={reps}
          accounts={accounts}
          onClose={() => setHandoverOpen(false)}
          onSaved={() => {
            setHandoverOpen(false);
            setNotice('تم تسجيل تسليم العهدة');
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}

      {statementId ? <StatementModal accountId={statementId} onClose={() => setStatementId(null)} /> : null}

      {handoverDetailId ? <HandoverModal handoverId={handoverDetailId} onClose={() => setHandoverDetailId(null)} /> : null}
    </div>
  );
}

function Stat({ label, value, color = 'text-gray-900' }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-xs font-semibold text-gray-400">{label}</div>
      <div className={`mt-1 text-lg font-black ${color}`}>{formatMoney(value)}</div>
    </div>
  );
}

function CreateAccountModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [type, setType] = useState('CASH');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await post('/treasury/accounts', {
        code: code.trim(),
        nameAr: nameAr.trim(),
        type,
        openingBalance: Number(openingBalance) || 0,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء الحساب');
      setBusy(false);
    }
  }

  return (
    <Modal title="حساب خزينة جديد" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="الكود">
          <TextInput value={code} onChange={(e) => setCode(e.target.value)} required />
        </Field>
        <Field label="الاسم">
          <TextInput value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
        </Field>
        <Field label="النوع">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="CASH">نقدي</option>
            <option value="BANK">بنك</option>
            <option value="WALLET">محفظة</option>
          </Select>
        </Field>
        <Field label="رصيد افتتاحي">
          <TextInput type="number" min="0" step="any" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
        </Field>
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
        <Button onClick={submit} disabled={busy || !code.trim() || !nameAr.trim()}>
          {busy ? 'جارِ الحفظ…' : 'حفظ'}
        </Button>
      </div>
    </Modal>
  );
}

function CreateHandoverModal({
  reps,
  accounts,
  onClose,
  onSaved,
}: {
  reps: { id: number; name: string; repCode: string | null }[];
  accounts: CashAccount[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [repId, setRepId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [cashAccountId, setCashAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await post('/treasury/handovers', {
        repId: Number(repId),
        amount: Number(amount),
        date: date || undefined,
        cashAccountId: cashAccountId ? Number(cashAccountId) : undefined,
        notes: notes.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تسجيل التسليم');
      setBusy(false);
    }
  }

  return (
    <Modal title="تسليم عهدة نقدية" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="المندوب">
          <Select value={repId} onChange={(e) => setRepId(e.target.value)}>
            <option value="">اختر مندوباً</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.repCode} — {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="المبلغ">
          <TextInput type="number" min="0.01" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="التاريخ">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="حساب الخزينة">
          <Select value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}>
            <option value="">الحساب الافتراضي</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.nameAr}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="ملاحظات">
        <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {error ? (
        <div className="mb-3 mt-3">
          <ErrorBox message={error} />
        </div>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          إلغاء
        </Button>
        <Button onClick={submit} disabled={busy || !repId || !(Number(amount) > 0)}>
          {busy ? 'جارِ الحفظ…' : 'حفظ'}
        </Button>
      </div>
    </Modal>
  );
}

function StatementModal({ accountId, onClose }: { accountId: number; onClose: () => void }) {
  const [data, setData] = useState<CashAccountStatement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<CashAccountStatement>(`/treasury/accounts/${accountId}/statement`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل كشف الحساب');
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  return (
    <Modal title={data ? `كشف حساب ${data.account.nameAr}` : 'كشف حساب الخزينة'} onClose={onClose}>
      {error ? <ErrorBox message={error} /> : null}
      {!data ? (
        <div className="py-6 text-center text-gray-400">جارِ التحميل…</div>
      ) : (
        <>
          <div className="mb-3 flex gap-4 text-sm">
            <span className="text-gray-500">افتتاحي: <b className="text-gray-800">{formatMoney(data.openingBalance)}</b></span>
            <span className="text-gray-500">ختامي: <b className="text-blue-700">{formatMoney(data.closingBalance)}</b></span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full min-w-max">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <Th>التاريخ</Th>
                  <Th>البيان</Th>
                  <Th>مدين</Th>
                  <Th>دائن</Th>
                  <Th>الرصيد</Th>
                </tr>
              </thead>
              <tbody>
                {data.movements.length === 0 ? (
                  <tr>
                    <Td className="py-6 text-center text-gray-400">لا توجد حركات</Td>
                  </tr>
                ) : (
                  data.movements.map((m) => (
                    <tr key={m.id} className="border-b border-gray-100 last:border-0">
                      <Td>{formatDate(m.date)}</Td>
                      <Td>{m.description ?? m.refType ?? '—'}</Td>
                      <Td className="text-emerald-700">{m.debit ? formatMoney(m.debit) : '—'}</Td>
                      <Td className="text-red-700">{m.credit ? formatMoney(m.credit) : '—'}</Td>
                      <Td className="font-semibold">{formatMoney(m.balance)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          إغلاق
        </Button>
      </div>
    </Modal>
  );
}

function HandoverModal({ handoverId, onClose }: { handoverId: number; onClose: () => void }) {
  const [data, setData] = useState<CustodyHandoverDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<CustodyHandoverDetail>(`/treasury/handovers/${handoverId}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل المحضر');
      });
    return () => {
      cancelled = true;
    };
  }, [handoverId]);

  return (
    <Modal title={data ? `محضر تسليم عهدة ${data.number}` : 'محضر تسليم عهدة'} onClose={onClose}>
      {error ? <ErrorBox message={error} /> : null}
      {!data ? (
        <div className="py-6 text-center text-gray-400">جارِ التحميل…</div>
      ) : (
        <div>
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 text-center text-base font-black text-gray-900">محضر تسليم عهدة نقدية</div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Row label="رقم المحضر" value={data.number} mono />
              <Row label="التاريخ" value={formatDate(data.date)} />
              <Row label="المندوب" value={data.rep ? `${data.rep.repCode ?? ''} — ${data.rep.name}` : `#${data.repId}`} />
              <Row label="المبلغ المسلَّم" value={formatMoney(data.amount)} strong />
              <Row label="حساب الخزينة" value={data.cashAccount ? `${data.cashAccount.code} — ${data.cashAccount.nameAr}` : '—'} />
              <Row label="مستلِم العهدة" value={data.receiver?.name ?? '—'} />
              <Row label="الحالة" value={data.status === 'VOID' ? 'ملغى' : 'مستلَم'} />
              <Row label="ملاحظات" value={data.notes ?? '—'} />
            </dl>
          </div>
          <p className="mb-4 text-xs text-gray-500">
            أقرّ باستلام المبلغ المذكور أعلاه من المندوب المذكور، ويُعدّ هذا المحضر سنداً رسمياً لتسليم العهدة النقدية.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => window.print()}>
              طباعة
            </Button>
            <Button variant="secondary" onClick={onClose}>
              إغلاق
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-2 border-b border-gray-200 pb-1">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`${mono ? 'font-mono ' : ''}${strong ? 'font-black text-blue-700' : 'font-semibold text-gray-800'}`}>{value}</dd>
    </div>
  );
}
