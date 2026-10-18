'use client';

import { useEffect, useState } from 'react';
import { can, get, post, qs, type Supplier, type SuppliersPage, type SupplierStatement } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  Button,
  ErrorBox,
  Field,
  Modal,
  Notice,
  PageHeader,
  Td,
  TextInput,
  Th,
  formatDate,
  formatMoney,
} from '@/components/ui';

export default function SuppliersPage() {
  const { user } = useAuth();
  const manage = can(user, 'supplier.manage');
  const canViewStatement = can(user, 'ledger.view') || can(user, 'report.view');

  const [rows, setRows] = useState<Supplier[]>([]);
  const [q, setQ] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [statementRow, setStatementRow] = useState<Supplier | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<SuppliersPage>(`/suppliers${qs({ q, limit: 100 })}`)
      .then((data) => {
        if (!cancelled) setRows(data.suppliers);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل الموردين');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, refresh]);

  return (
    <div>
      <PageHeader title="الموردون" action={manage ? <Button onClick={() => setCreateOpen(true)}>+ مورد جديد</Button> : undefined} />

      {notice ? (
        <div className="mb-3">
          <Notice type="success">{notice}</Notice>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث بالاسم…"
          className="w-64"
        />
        <Button variant="secondary" onClick={() => setRefresh((s) => s + 1)}>
          تحديث
        </Button>
      </div>

      {error ? <ErrorBox message={error} onRetry={() => setRefresh((s) => s + 1)} /> : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الكود</Th>
              <Th>الاسم</Th>
              <Th>الهاتف</Th>
              <Th>العنوان</Th>
              <Th>الحالة</Th>
              <Th>كشف الحساب</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا يوجد موردون</Td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-mono font-semibold">{s.code}</Td>
                  <Td className="font-semibold">{s.nameAr}</Td>
                  <Td dir="ltr">{s.phone ?? '—'}</Td>
                  <Td>{s.address ?? '—'}</Td>
                  <Td>{s.active ? <Badge color="green">نشط</Badge> : <Badge color="red">موقوف</Badge>}</Td>
                  <Td>
                    {canViewStatement ? (
                      <Button variant="secondary" onClick={() => setStatementRow(s)}>
                        كشف حساب
                      </Button>
                    ) : (
                      '—'
                    )}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {createOpen ? (
        <CreateSupplierModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            setNotice('تم إنشاء المورد');
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}

      {statementRow ? <SupplierStatementModal supplier={statementRow} onClose={() => setStatementRow(null)} /> : null}
    </div>
  );
}

function CreateSupplierModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [nameAr, setNameAr] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await post('/suppliers', {
        nameAr: nameAr.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء المورد');
      setBusy(false);
    }
  }

  return (
    <Modal title="مورد جديد" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="الاسم">
          <TextInput value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
        </Field>
        <Field label="الهاتف">
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
        </Field>
        <Field label="العنوان">
          <TextInput value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
      </div>
      <div className="mb-3 text-xs text-gray-400">يُولَّد كود المورد تلقائياً (S0001, …).</div>
      {error ? (
        <div className="mb-3">
          <ErrorBox message={error} />
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          إلغاء
        </Button>
        <Button onClick={submit} disabled={busy}>
          {busy ? 'جارِ الحفظ…' : 'حفظ'}
        </Button>
      </div>
    </Modal>
  );
}

function SupplierStatementModal({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const [data, setData] = useState<SupplierStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<SupplierStatement>(`/suppliers/${supplier.id}/statement`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل كشف الحساب');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supplier.id]);

  return (
    <Modal title={`كشف حساب ${supplier.code} — ${supplier.nameAr}`} onClose={onClose}>
      {loading ? <div className="py-6 text-center text-gray-400">جارِ التحميل…</div> : null}
      {error ? <ErrorBox message={error} /> : null}
      {data ? (
        <>
          <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-gray-200 p-2">
              <div className="text-gray-500">رصيد أول المدة</div>
              <div className="font-semibold">{formatMoney(data.openingBalance)}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-2">
              <div className="text-gray-500">رصيد آخر المدة</div>
              <div className="font-semibold">{formatMoney(data.closingBalance)}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-2">
              <div className="text-gray-500">إجمالي المستحق</div>
              <div className="font-semibold">{formatMoney(data.totalOutstanding)}</div>
            </div>
          </div>

          <div className="mb-3 max-h-64 overflow-y-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50">
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
                    <Td className="py-3 text-center text-gray-400" colSpan={5}>
                      لا توجد حركات
                    </Td>
                  </tr>
                ) : (
                  data.movements.map((m) => (
                    <tr key={m.id} className="border-b border-gray-100 last:border-0">
                      <Td>{formatDate(m.date)}</Td>
                      <Td>{m.description}</Td>
                      <Td className="text-end">{m.debit ? formatMoney(m.debit) : '—'}</Td>
                      <Td className="text-end">{m.credit ? formatMoney(m.credit) : '—'}</Td>
                      <Td className="text-end font-semibold">{formatMoney(m.balance)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data.outstandingStatements.length > 0 ? (
            <div>
              <div className="mb-1 text-sm font-bold text-gray-700">فواتير مشتريات غير مسددة</div>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>الرقم</Th>
                      <Th>التاريخ</Th>
                      <Th>الصافي</Th>
                      <Th>المدفوع</Th>
                      <Th>المتبقي</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.outstandingStatements.map((s) => (
                      <tr key={s.statementId} className="border-b border-gray-100 last:border-0">
                        <Td className="font-mono">{s.number}</Td>
                        <Td>{formatDate(s.date)}</Td>
                        <Td className="text-end">{formatMoney(s.net)}</Td>
                        <Td className="text-end">{formatMoney(s.paid)}</Td>
                        <Td className="text-end font-semibold">{formatMoney(s.outstanding)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}