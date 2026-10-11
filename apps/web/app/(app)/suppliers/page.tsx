'use client';

import { useEffect, useState } from 'react';
import { can, get, post, qs, type Supplier, type SuppliersPage } from '@/lib/api';
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
} from '@/components/ui';

export default function SuppliersPage() {
  const { user } = useAuth();
  const manage = can(user, 'supplier.manage');

  const [rows, setRows] = useState<Supplier[]>([]);
  const [q, setQ] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
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