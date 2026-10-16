'use client';

import { useEffect, useState } from 'react';
import {
  can,
  del,
  get,
  post,
  qs,
  type Customer,
  type CustomersPage,
  type PriceStatement,
  type ReturnStatementDoc,
  type ReturnsPage,
  type ReturnSettlement,
  type ReturnStatus,
  type StatementsPage,
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
  Textarea,
  Th,
  formatDate,
  formatMoney,
} from '@/components/ui';

const reasonOptions: { code: string; nameAr: string }[] = [
  { code: 'DEFECT', nameAr: 'عيب صناعة' },
  { code: 'WRONG_ORDER', nameAr: 'خطأ في الطلب' },
  { code: 'DAMAGED', nameAr: 'تلف' },
  { code: 'OTHER', nameAr: 'أخرى' },
];

const returnStatusLabel: Record<ReturnStatus, string> = {
  DRAFT: 'بانتظار الموافقة',
  APPROVED: 'معتمد',
  CANCELLED: 'ملغي',
};

const returnStatusColor: Record<ReturnStatus, string> = {
  DRAFT: 'blue',
  APPROVED: 'green',
  CANCELLED: 'red',
};

const settlementLabels: Record<ReturnSettlement, string> = {
  BALANCE: 'خصم من رصيد العميل',
  CASH: 'رد نقدية',
  CREDIT: 'رصيد دائن للعميل',
};

export default function ReturnsPage() {
  const { user } = useAuth();
  const canCreate = can(user, 'return.create');
  const canCashRefund = can(user, 'return.cash_refund');

  const [rows, setRows] = useState<ReturnStatementDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [status, setStatus] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewRow, setViewRow] = useState<ReturnStatementDoc | null>(null);
  const [cancelRow, setCancelRow] = useState<ReturnStatementDoc | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<ReturnsPage>(`/returns${qs({ status, limit: 50 })}`)
      .then((d) => {
        if (!cancelled) {
          setRows(d.items);
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
  }, [status, refresh]);

  return (
    <div>
      <PageHeader
        title="المرتجعات"
        action={canCreate ? <Button onClick={() => setCreateOpen(true)}>+ مرتجع جديد</Button> : undefined}
      />

      {notice ? (
        <div className="mb-3">
          <Notice type="success">{notice}</Notice>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Field label="الحالة">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
            <option value="">الكل</option>
            {(Object.keys(returnStatusLabel) as ReturnStatus[]).map((s) => (
              <option key={s} value={s}>
                {returnStatusLabel[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="secondary" onClick={() => setRefresh((s) => s + 1)}>
          تحديث
        </Button>
        <span className="text-sm text-gray-500">{rows.length} مرتجع</span>
      </div>

      {error ? <ErrorBox message={error} onRetry={() => setRefresh((s) => s + 1)} /> : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الرقم</Th>
              <Th>التاريخ</Th>
              <Th>العميل</Th>
              <Th>النوع</Th>
              <Th>السبب</Th>
              <Th>الأثر المالي</Th>
              <Th>الإجمالي</Th>
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
                <Td className="py-6 text-center text-gray-400">لا توجد مرتجعات</Td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-mono font-semibold">{r.number}</Td>
                  <Td>{formatDate(r.date)}</Td>
                  <Td>
                    <div className="font-semibold">{r.customer.nameAr}</div>
                    <div className="text-xs text-gray-400">{r.customer.code}</div>
                  </Td>
                  <Td>{r.mode === 'BY_CUSTOMER' ? 'حسب العميل' : 'حسب المندوب'}</Td>
                  <Td>{r.reason?.nameAr ?? '—'}</Td>
                  <Td className="text-xs text-gray-600">{settlementLabels[r.settlement] ?? r.settlement}</Td>
                  <Td className="font-bold">{formatMoney(r.total)}</Td>
                  <Td>
                    <Badge color={returnStatusColor[r.status]}>{returnStatusLabel[r.status]}</Badge>
                  </Td>
                  <Td className="flex gap-1">
                    <Button variant="ghost" onClick={() => setViewRow(r)}>
                      عرض
                    </Button>
                    {canCreate && r.status === 'DRAFT' ? (
                      <Button variant="ghost" onClick={() => setCancelRow(r)}>
                        إلغاء
                      </Button>
                    ) : null}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {createOpen ? (
        <CreateReturnModal
          canCashRefund={canCashRefund}
          onClose={() => setCreateOpen(false)}
          onSaved={(msg) => {
            setCreateOpen(false);
            setNotice(msg);
            setRefresh((x) => x + 1);
          }}
        />
      ) : null}

      {viewRow ? <ReturnDetailModal r={viewRow} onClose={() => setViewRow(null)} /> : null}

      {cancelRow ? (
        <CancelReturnModal
          r={cancelRow}
          onClose={() => setCancelRow(null)}
          onDone={() => {
            setCancelRow(null);
            setNotice(`تم إلغاء ${cancelRow.number}`);
            setRefresh((x) => x + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function CreateReturnModal({
  canCashRefund,
  onClose,
  onSaved,
}: {
  canCashRefund: boolean;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [mode, setMode] = useState('BY_CUSTOMER');
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [reasonCode, setReasonCode] = useState('DEFECT');
  const [settlement, setSettlement] = useState<ReturnSettlement>('BALANCE');
  const [notes, setNotes] = useState('');
  const [statements, setStatements] = useState<PriceStatement[]>([]);
  const [statementId, setStatementId] = useState('');
  const [sourceDoc, setSourceDoc] = useState<PriceStatement | null>(null);
  const [lines, setLines] = useState<ReturnLineRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    get<CustomersPage>(`/customers${qs({ limit: 200 })}`)
      .then((d) => {
        if (!cancelled) setCustomers(d.customers);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadStatements(cId: string) {
    if (!cId) {
      setStatements([]);
      setSourceDoc(null);
      return;
    }
    try {
      const d = await get<StatementsPage>(`/price-statements${qs({ customerId: Number(cId), status: 'APPROVED', limit: 50 })}`);
      setStatements(d.items);
      setStatementId('');
      setSourceDoc(null);
      setLines([]);
    } catch {
      setStatements([]);
    }
  }

  async function loadSource(id: string) {
    if (!id) {
      setSourceDoc(null);
      setLines([]);
      return;
    }
    try {
      const d = await get<PriceStatement>(`/price-statements/${id}`);
      setSourceDoc(d);
      setLines([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحميل البيان الأصلي');
    }
  }

  function addLine() {
    setLines([...lines, { sourceLineId: '', qty: '1', unitCode: '', condition: 'GOOD' }]);
  }

  function updateLine(i: number, patch: Partial<ReturnLineRow>) {
    const next = [...lines];
    next[i] = { ...next[i], ...patch };
    setLines(next);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const cleaned = lines
        .filter((l) => l.sourceLineId && Number(l.qty) > 0)
        .map((l) => ({
          sourceLineId: Number(l.sourceLineId),
          qty: Number(l.qty),
          unitCode: l.unitCode || undefined,
          condition: l.condition as 'GOOD' | 'DAMAGED',
        }));
      const res = await post<ReturnStatementDoc>('/returns', {
        mode: mode as 'BY_CUSTOMER' | 'BY_REP',
        customerId: Number(customerId),
        date,
        reasonCode,
        settlement,
        notes: notes.trim() || undefined,
        lines: cleaned,
      });
      onSaved(`تم إنشاء مرتجع ${res.number}${res.status === 'DRAFT' ? ' (بانتظار الموافقة)' : ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء المرتجع');
      setBusy(false);
    }
  }

  const checkedLines = lines.filter((l) => l.sourceLineId && Number(l.qty) > 0);

  return (
    <Modal title="مرتجع جديد" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="النوع">
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="BY_CUSTOMER">حسب العميل</option>
            <option value="BY_REP">حسب المندوب</option>
          </Select>
        </Field>
        <Field label="العميل">
          <Select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              void loadStatements(e.target.value);
            }}
          >
            <option value="">اختر عميلاً</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="التاريخ">
          <TextInput value={date} onChange={(e) => setDate(e.target.value)} type="date" />
        </Field>
        <Field label="السبب">
          <Select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
            {reasonOptions.map((r) => (
              <option key={r.code} value={r.code}>
                {r.nameAr}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mb-4">
        <Field label="الأثر المالي">
          <Select value={settlement} onChange={(e) => setSettlement(e.target.value as ReturnSettlement)}>
            <option value="BALANCE">خصم من رصيد العميل</option>
            <option value="CREDIT">رصيد دائن للعميل</option>
            {canCashRefund ? <option value="CASH">رد نقدية من الخزينة</option> : null}
          </Select>
        </Field>
      </div>

      {customerId ? (
        <div className="mb-3">
          <Field label="بيان البيع الأصلي (معتمد)">
            <Select
              value={statementId}
              onChange={(e) => {
                setStatementId(e.target.value);
                void loadSource(e.target.value);
              }}
            >
              <option value="">—</option>
              {statements.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.number} — {formatDate(s.date)} — صافي {formatMoney(s.net)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}

      {sourceDoc ? (
        <div className="mb-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">بنود المرتجع (من {sourceDoc.number})</span>
            <Button variant="secondary" onClick={addLine}>
              + إضافة بند
            </Button>
          </div>
          {sourceDoc.lines.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-sm text-gray-400">
              البيان الأصلي بلا بنود
            </div>
          ) : (
            <div className="space-y-2">
              {lines.map((l, i) => {
                const src = sourceDoc.lines.find((x) => String(x.id) === String(l.sourceLineId));
                return (
                  <div key={i} className="rounded-lg border border-gray-200 p-2">
                    <div className="grid grid-cols-12 items-end gap-2">
                      <div className="col-span-4">
                        <Field label="بند البيع">
                          <Select value={l.sourceLineId} onChange={(e) => updateLine(i, { sourceLineId: e.target.value, unitCode: sourceDoc.lines.find((x) => String(x.id) === e.target.value)?.unit.code ?? '' })}>
                            <option value="">—</option>
                            {sourceDoc.lines.map((sl) => (
                              <option key={sl.id} value={sl.id}>
                                {sl.item.code} — {sl.item.nameAr} ({formatMoney(sl.qty)} {sl.unit.code} × {formatMoney(sl.unitPrice)})
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                      <div className="col-span-2">
                        <Field label="الكمية">
                          <TextInput value={l.qty} onChange={(e) => updateLine(i, { qty: e.target.value })} type="number" min="0.001" step="any" />
                        </Field>
                      </div>
                      <div className="col-span-2">
                        <Field label="الوحدة">
                          <Select value={l.unitCode} onChange={(e) => updateLine(i, { unitCode: e.target.value })}>
                            {src ? (
                              <option value={src.unit.code}>{src.unit.nameAr ?? src.unit.code}</option>
                            ) : (
                              <option value="">—</option>
                            )}
                          </Select>
                        </Field>
                      </div>
                      <div className="col-span-3">
                        <Field label="الحالة">
                          <Select value={l.condition} onChange={(e) => updateLine(i, { condition: e.target.value })}>
                            <option value="GOOD">سليم</option>
                            <option value="DAMAGED">تالف</option>
                          </Select>
                        </Field>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button variant="danger" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                          ×
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      <Field label="ملاحظات">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>

      {error ? (
        <div className="mb-3">
          <ErrorBox message={error} />
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          إلغاء
        </Button>
        <Button onClick={submit} disabled={busy || !customerId || !statementId || checkedLines.length === 0}>
          {busy ? 'جارِ الحفظ…' : 'حفظ المرتجع'}
        </Button>
      </div>
    </Modal>
  );
}

function ReturnDetailModal({ r, onClose }: { r: ReturnStatementDoc; onClose: () => void }) {
  const [data, setData] = useState<ReturnStatementDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<ReturnStatementDoc>(`/returns/${r.id}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل التفاصيل');
      });
    return () => {
      cancelled = true;
    };
  }, [r.id]);

  const doc = data ?? r;

  return (
    <Modal title={`${doc.number} — ${doc.customer.nameAr}`} onClose={onClose}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge color={returnStatusColor[doc.status]}>{returnStatusLabel[doc.status]}</Badge>
        <span className="text-gray-500">{formatDate(doc.date)}</span>
        <span className="text-gray-500">
          {doc.mode === 'BY_CUSTOMER' ? 'حسب العميل' : 'حسب المندوب'} • {doc.reason?.nameAr ?? '—'}
        </span>
        <span className="text-gray-500">الأثر المالي: {settlementLabels[doc.settlement] ?? doc.settlement}</span>
        {doc.withoutStatement ? <Badge color="amber">بدون بيان</Badge> : null}
        {doc.rep ? <span className="text-gray-500">المندوب: {doc.rep.name}</span> : null}
      </div>

      {error ? (
        <div className="mb-3">
          <ErrorBox message={error} />
        </div>
      ) : null}

      {data ? (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <Th>البيان الأصلي</Th>
                <Th>الصنف</Th>
                <Th>الوحدة</Th>
                <Th>الكمية</Th>
                <Th>سعر الوحدة الصافي</Th>
                <Th>الإجمالي</Th>
                <Th>الحالة</Th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l) => (
                <tr key={l.id} className="border-b border-gray-100 last:border-0">
                  <Td>
                    <div className="font-mono text-xs">{l.sourceLine?.statement.number ?? '—'}</div>
                  </Td>
                  <Td>
                    <div className="font-semibold">{l.item.nameAr}</div>
                    <div className="text-xs text-gray-400">{l.item.code}</div>
                  </Td>
                  <Td>{l.unit.nameAr ?? l.unit.code}</Td>
                  <Td>{formatMoney(l.qty)} {l.unit.code}</Td>
                  <Td>{formatMoney(l.unitNetPrice)}</Td>
                  <Td className="font-bold">{formatMoney(l.lineTotal)}</Td>
                  <Td>{l.condition === 'GOOD' ? 'سليم' : 'تالف'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="text-gray-500">الإجمالي:</div>
        <div className="text-end text-base font-black text-blue-700">{formatMoney(doc.total)}</div>
      </div>

      {doc.approvals && doc.approvals.length > 0 ? (
        <div className="mt-3">
          <div className="mb-1 text-sm font-bold text-gray-700">الموافقات</div>
          {doc.approvals.map((a) => (
            <div key={a.id} className="mb-1 rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
              {a.type} • {a.status} • بواسطة {a.requestedBy?.name ?? '—'}
              {a.decidedBy ? ` • قرر: ${a.decidedBy.name}` : ''}
            </div>
          ))}
        </div>
      ) : null}

      {doc.notes ? <div className="mt-3 text-xs text-gray-500">ملاحظات: {doc.notes}</div> : null}

      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          إغلاق
        </Button>
      </div>
    </Modal>
  );
}

function CancelReturnModal({
  r,
  onClose,
  onDone,
}: {
  r: ReturnStatementDoc;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await del(`/returns/${r.id}/cancel`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الإلغاء');
      setBusy(false);
    }
  }

  return (
    <Modal title={`إلغاء ${r.number}`} onClose={onClose}>
      <div className="mb-3 text-sm text-gray-600">لا يمكن إلغاء مرتجع معتمد.</div>
      {error ? (
        <div className="mb-3">
          <ErrorBox message={error} />
        </div>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          تراجع
        </Button>
        <Button onClick={submit} disabled={busy}>
          {busy ? 'جارِ الإلغاء…' : 'تأكيد الإلغاء'}
        </Button>
      </div>
    </Modal>
  );
}

type ReturnLineRow = {
  sourceLineId: string;
  qty: string;
  unitCode: string;
  condition: string;
};

function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}