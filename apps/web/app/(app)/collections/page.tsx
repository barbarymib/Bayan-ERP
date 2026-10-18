'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  API_URL,
  can,
  get,
  getToken,
  post,
  qs,
  type ChequeDoc,
  type Customer,
  type CustomerStatement,
  type CustomersPage,
  type PaymentDoc,
  type ReceiptDoc,
  type Supplier,
  type SuppliersPage,
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

type Tab = 'receipts' | 'payments' | 'cheques' | 'kashf';

const methodLabel: Record<string, string> = {
  CASH: 'نقدي',
  TRANSFER: 'تحويل',
  CHEQUE: 'شيك',
  VODAFONE_CASH: 'فودافون كاش',
  INSTAPAY: 'إنستاباي',
  WALLET: 'محفظة (قديم)',
};

const chequeStatusLabel: Record<string, string> = {
  UNDER_COLLECTION: 'تحت التحصيل',
  COLLECTED: 'محصل',
  RETURNED: 'مرتد',
};

const chequeStatusColor: Record<string, string> = {
  UNDER_COLLECTION: 'blue',
  COLLECTED: 'green',
  RETURNED: 'red',
};

async function downloadArchiveBundle(
  id: number,
  code: string,
  setError: (m: string | null) => void,
): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/archives/${id}/bundle`, {
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    });
    if (!res.ok) throw new Error(`فشل تنزيل حزمة الأرشيف (${res.status})`);
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
    setError(err instanceof Error ? err.message : 'فشل تنزيل حزمة الأرشيف');
  }
}

export default function CollectionsPage() {
  const { user } = useAuth();
  const canCreate = can(user, 'collection.create');
  const canLedger = can(user, 'ledger.view') || can(user, 'report.view');

  const [tab, setTab] = useState<Tab>('receipts');
  const [notice, setNotice] = useState<string | null>(null);

  const tabs: { id: Tab; label: string; cond?: boolean }[] = [
    { id: 'receipts', label: 'سندات القبض', cond: canCreate || canLedger },
    { id: 'payments', label: 'سندات الصرف', cond: canCreate || canLedger },
    { id: 'cheques', label: 'حافظة الشيكات', cond: canCreate || canLedger },
    { id: 'kashf', label: 'كشف حساب عميل', cond: canLedger },
  ];

  return (
    <div>
      <PageHeader title="التحصيل والخزينة" />

      {notice ? (
        <div className="mb-3">
          <Notice type="success">{notice}</Notice>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1">
        {tabs
          .filter((t) => t.cond !== false)
          .map((t) => (
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

      {tab === 'receipts' ? <ReceiptsPane canCreate={canCreate} onDone={(m) => setNotice(m)} /> : null}
      {tab === 'payments' ? <PaymentsPane canCreate={canCreate} onDone={(m) => setNotice(m)} /> : null}
      {tab === 'cheques' ? <ChequesPane canCreate={canCreate} onDone={(m) => setNotice(m)} /> : null}
      {tab === 'kashf' ? <KashfPane /> : null}
    </div>
  );
}

function ReceiptsPane({ canCreate, onDone }: { canCreate: boolean; onDone: (m: string) => void }) {
  const [rows, setRows] = useState<ReceiptDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    get<{ items: ReceiptDoc[] }>(`/receipts${qs({ limit: 50 })}`)
      .then((d) => {
        if (!cancelled) {
          setRows(d.items);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل سندات القبض');
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
        {canCreate ? <Button onClick={() => setOpen(true)}>+ سند قبض</Button> : null}
        <span className="text-sm text-gray-500">{rows.length} سند</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الرقم</Th>
              <Th>التاريخ</Th>
              <Th>العميل</Th>
              <Th>القيمة</Th>
              <Th>الطريقة</Th>
              <Th>البيان المرتبط</Th>
              <Th></Th>
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
                <Td className="py-6 text-center text-gray-400">لا توجد سندات قبض</Td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-mono font-semibold">{r.number}</Td>
                  <Td>{formatDate(r.receivedAt)}</Td>
                  <Td>
                    <div className="font-semibold">{r.customer.nameAr}</div>
                    <div className="text-xs text-gray-400">{r.customer.code}</div>
                  </Td>
                  <Td className="font-bold">{formatMoney(r.amount)}</Td>
                  <Td>{methodLabel[r.method] ?? r.method}</Td>
                  <Td>
                    {r.allocations.length > 0 ? (
                      r.allocations.map((a) => (
                        <div key={a.id} className="text-xs">
                          بيان #{a.statementId} — {formatMoney(a.amount)}
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">على الحساب</span>
                    )}
                  </Td>
                  <Td>{r.cheque ? <Badge color="blue">شيك #{r.cheque.number}</Badge> : null}</Td>
                  <Td>
                    <Link
                      href={`/collections/receipts/${r.id}/print`}
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

      {open ? (
        <ReceiptModal
          onClose={() => setOpen(false)}
          onDone={(m) => {
            setOpen(false);
            onDone(m);
            setRefresh((x) => x + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function ReceiptModal({ onClose, onDone }: { onClose: () => void; onDone: (m: string) => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [statementId, setStatementId] = useState('');
  const [receivedAt, setReceivedAt] = useState(todayStr());
  const [chequeNumber, setChequeNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [chequeDueDate, setChequeDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [statements, setStatements] = useState<{ id: number; number: string; outstanding: number }[]>([]);
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

  async function loadStatements() {
    if (!customerId) return;
    try {
      const d = await get<CustomerStatement>(`/customers/${customerId}/statement`);
      setStatements(
        d.outstandingStatements
          .filter((s) => s.outstanding > 0)
          .map((s) => ({ id: s.statementId, number: s.number, outstanding: s.outstanding })),
      );
    } catch {
      setStatements([]);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        customerId: Number(customerId),
        amount: Number(amount),
        method,
        receivedAt,
        notes: notes.trim() || undefined,
      };
      if (statementId) body.statementId = Number(statementId);
      if (method === 'CHEQUE') {
        if (!chequeNumber.trim()) {
          setError('رقم الشيك مطلوب لطريقة الدفع بالشيك');
          setBusy(false);
          return;
        }
        body.chequeNumber = chequeNumber.trim();
        if (bankName) body.bankName = bankName.trim();
        if (chequeDueDate) body.chequeDueDate = chequeDueDate;
      }
      const res = await post<ReceiptDoc>('/receipts', body);
      onDone(`تم إنشاء سند قبض ${res.number}${res.cheque ? ` مع شيك ${res.cheque.number}` : ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء سند القبض');
      setBusy(false);
    }
  }

  return (
    <Modal title="سند قبض جديد" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="العميل">
          <Select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setStatementId('');
              void loadStatements();
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
        <Field label="القيمة (ج)">
          <TextInput value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0.01" step="any" />
        </Field>
        <Field label="الطريقة">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">نقدي</option>
            <option value="TRANSFER">تحويل</option>
            <option value="CHEQUE">شيك</option>
            <option value="VODAFONE_CASH">فودافون كاش</option>
            <option value="INSTAPAY">إنستاباي</option>
          </Select>
        </Field>
        <Field label="التاريخ">
          <TextInput value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} type="date" />
        </Field>
        {statements.length > 0 ? (
          <div className="col-span-2">
            <Field label="ربط ببيان (اختياري)">
              <Select value={statementId} onChange={(e) => setStatementId(e.target.value)}>
                <option value="">على الحساب</option>
                {statements.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.number} — متبقي {formatMoney(s.outstanding)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}
        {method === 'CHEQUE' ? (
          <>
            <Field label="رقم الشيك">
              <TextInput value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} dir="ltr" />
            </Field>
            <Field label="اسم البنك">
              <TextInput value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </Field>
            <Field label="تاريخ الاستحقاق">
              <TextInput value={chequeDueDate} onChange={(e) => setChequeDueDate(e.target.value)} type="date" />
            </Field>
          </>
        ) : null}
        <div className="col-span-2">
          <Field label="ملاحظات">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
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
        <Button onClick={submit} disabled={busy || !customerId || !amount || Number(amount) <= 0}>
          {busy ? 'جارِ الحفظ…' : 'حفظ السند'}
        </Button>
      </div>
    </Modal>
  );
}

function PaymentsPane({ canCreate, onDone }: { canCreate: boolean; onDone: (m: string) => void }) {
  const [rows, setRows] = useState<PaymentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    get<{ items: PaymentDoc[] }>(`/payments${qs({ limit: 50 })}`)
      .then((d) => {
        if (!cancelled) {
          setRows(d.items);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل سندات الصرف');
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
        {canCreate ? <Button onClick={() => setOpen(true)}>+ سند صرف</Button> : null}
        <span className="text-sm text-gray-500">{rows.length} سند</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الرقم</Th>
              <Th>التاريخ</Th>
              <Th>المورد</Th>
              <Th>القيمة</Th>
              <Th>الطريقة</Th>
              <Th>ملاحظات</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا توجد سندات صرف</Td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-mono font-semibold">{p.number}</Td>
                  <Td>{formatDate(p.paidAt)}</Td>
                  <Td>
                    <div className="font-semibold">{p.supplier.nameAr}</div>
                    <div className="text-xs text-gray-400">{p.supplier.code}</div>
                  </Td>
                  <Td className="font-bold">{formatMoney(p.amount)}</Td>
                  <Td>{methodLabel[p.method] ?? p.method}</Td>
                  <Td className="text-xs text-gray-500">{p.notes ?? '—'}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open ? (
        <PaymentModal
          onClose={() => setOpen(false)}
          onDone={(m) => {
            setOpen(false);
            onDone(m);
            setRefresh((x) => x + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function PaymentModal({ onClose, onDone }: { onClose: () => void; onDone: (m: string) => void }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [paidAt, setPaidAt] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    get<SuppliersPage>(`/suppliers${qs({ limit: 200 })}`)
      .then((d) => {
        if (!cancelled) setSuppliers(d.suppliers);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await post<PaymentDoc>('/payments', {
        supplierId: Number(supplierId),
        amount: Number(amount),
        method,
        paidAt,
        notes: notes.trim() || undefined,
      });
      onDone(`تم إنشاء سند صرف ${res.number}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء سند الصرف');
      setBusy(false);
    }
  }

  return (
    <Modal title="سند صرف جديد" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="المورد">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">اختر مورداً</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="القيمة (ج)">
          <TextInput value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0.01" step="any" />
        </Field>
        <Field label="الطريقة">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">نقدي</option>
            <option value="TRANSFER">تحويل</option>
            <option value="CHEQUE">شيك</option>
            <option value="VODAFONE_CASH">فودافون كاش</option>
            <option value="INSTAPAY">إنستاباي</option>
          </Select>
        </Field>
        <Field label="التاريخ">
          <TextInput value={paidAt} onChange={(e) => setPaidAt(e.target.value)} type="date" />
        </Field>
        <div className="col-span-2">
          <Field label="ملاحظات">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
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
        <Button onClick={submit} disabled={busy || !supplierId || !amount || Number(amount) <= 0}>
          {busy ? 'جارِ الحفظ…' : 'حفظ السند'}
        </Button>
      </div>
    </Modal>
  );
}

function ChequesPane({ canCreate, onDone }: { canCreate: boolean; onDone: (m: string) => void }) {
  const [rows, setRows] = useState<ChequeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    get<{ items: ChequeDoc[] }>(`/cheques${qs({ limit: 50 })}`)
      .then((d) => {
        if (!cancelled) {
          setRows(d.items);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل الشيكات');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function setStatus(id: number, status: 'COLLECTED' | 'RETURNED') {
    try {
      await post(`/cheques/${id}/status`, { status });
      onDone(status === 'COLLECTED' ? 'تم تحصيل الشيك' : 'تم إرجاع الشيك');
      setRefresh((x) => x + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحديث حالة الشيك');
    }
  }

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      <div className="mb-3 flex items-center gap-2">
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث
        </Button>
        <span className="text-sm text-gray-500">{rows.length} شيك</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>رقم الشيك</Th>
              <Th>البنك</Th>
              <Th>الجهة</Th>
              <Th>الاستحقاق</Th>
              <Th>القيمة</Th>
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
                <Td className="py-6 text-center text-gray-400">لا توجد شيكات</Td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-mono font-semibold" dir="ltr">
                    {c.number}
                  </Td>
                  <Td>{c.bankName || '—'}</Td>
                  <Td>{c.customer?.nameAr ?? c.supplier?.nameAr ?? '—'}</Td>
                  <Td>{formatDate(c.dueDate)}</Td>
                  <Td className="font-bold">{formatMoney(c.amount)}</Td>
                  <Td>
                    <Badge color={chequeStatusColor[c.status]}>{chequeStatusLabel[c.status]}</Badge>
                  </Td>
                  <Td className="flex gap-1">
                    {canCreate && c.status === 'UNDER_COLLECTION' ? (
                      <>
                        <Button variant="ghost" onClick={() => void setStatus(c.id, 'COLLECTED')}>
                          تحصيل
                        </Button>
                        <Button variant="ghost" onClick={() => void setStatus(c.id, 'RETURNED')}>
                          إرجاع
                        </Button>
                      </>
                    ) : null}
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

function KashfPane() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [data, setData] = useState<CustomerStatement | null>(null);
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

  async function load() {
    if (!customerId) return;
    setBusy(true);
    setError(null);
    try {
      const d = await get<CustomerStatement>(`/customers/${customerId}/statement`);
      setData(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحميل كشف الحساب');
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-end gap-2">
        <Field label="العميل">
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-72">
            <option value="">اختر عميلاً</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Button onClick={load} disabled={!customerId || busy}>
          {busy ? 'جارِ التحميل…' : 'عرض'}
        </Button>
      </div>

      {error ? <ErrorBox message={error} /> : null}

      {data ? (
        <div>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-sm text-gray-500">رصيد افتتاحي</div>
              <div className="mt-1 text-xl font-black text-gray-900">{formatMoney(data.openingBalance)}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-sm text-gray-500">رصيد ختامي</div>
              <div className="mt-1 text-xl font-black text-blue-700">{formatMoney(data.closingBalance)}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-sm text-gray-500">إجمالي المستحق</div>
              <div className="mt-1 text-xl font-black text-red-600">{formatMoney(data.totalOutstanding)}</div>
            </div>
          </div>

          {data.migratedOpening ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div>
                <div className="text-sm font-bold text-amber-800">رصيد افتتاحي مُرحّل من الأرشيف</div>
                <div className="mt-1 text-xl font-black text-amber-900">{formatMoney(data.migratedOpening.amount)}</div>
                <div className="mt-1 text-xs text-amber-700">
                  حزمة {data.migratedOpening.runCode} — {formatDate(data.migratedOpening.fromDate)} إلى{' '}
                  {formatDate(data.migratedOpening.toDate)}
                  {data.migratedOpening.confirmedAt ? ` — أُكّدت ${formatDate(data.migratedOpening.confirmedAt)}` : ''}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {data.migratedOpening.bundleAvailable ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      downloadArchiveBundle(data.migratedOpening!.runId, data.migratedOpening!.runCode, setError)
                    }
                  >
                    تنزيل حزمة الأرشيف
                  </Button>
                ) : null}
                <Link
                  href="/archives"
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                >
                  عرض الأرشيف
                </Link>
              </div>
            </div>
          ) : null}

          <div className="mb-4 overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-2 text-sm font-bold text-gray-700">حركات الحساب</div>
            <table className="w-full min-w-max border-collapse">
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
                    <Td className="py-4 text-center text-gray-400">لا توجد حركات</Td>
                  </tr>
                ) : (
                  data.movements.map((m) => (
                    <tr key={m.id} className="border-b border-gray-100 last:border-0">
                      <Td>{formatDate(m.date)}</Td>
                      <Td>{m.description}</Td>
                      <Td className="font-semibold text-red-600">{m.debit ? formatMoney(m.debit) : '—'}</Td>
                      <Td className="font-semibold text-emerald-600">{m.credit ? formatMoney(m.credit) : '—'}</Td>
                      <Td className="font-bold">{formatMoney(m.balance)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-2 text-sm font-bold text-gray-700">مستحقات البيانات</div>
            <table className="w-full min-w-max border-collapse">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <Th>الرقم</Th>
                  <Th>التاريخ</Th>
                  <Th>الصافي</Th>
                  <Th>المدفوع</Th>
                  <Th>مخصص</Th>
                  <Th>مرتجع</Th>
                  <Th>المتبقي</Th>
                </tr>
              </thead>
              <tbody>
                {data.outstandingStatements.length === 0 ? (
                  <tr>
                    <Td className="py-4 text-center text-gray-400">لا توجد مستحقات</Td>
                  </tr>
                ) : (
                  data.outstandingStatements.map((s) => (
                    <tr key={s.statementId} className="border-b border-gray-100 last:border-0">
                      <Td className="font-mono font-semibold">{s.number}</Td>
                      <Td>{formatDate(s.date)}</Td>
                      <Td>{formatMoney(s.net)}</Td>
                      <Td>{formatMoney(s.paid)}</Td>
                      <Td>{formatMoney(s.allocated)}</Td>
                      <Td>{formatMoney(s.returned)}</Td>
                      <Td className="font-bold text-red-600">{formatMoney(s.outstanding)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}