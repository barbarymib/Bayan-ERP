'use client';

import { useEffect, useState } from 'react';
import { can, get, post, qs, type Warehouse, type WarehousesPage } from '@/lib/api';
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
} from '@/components/ui';

const TYPES = ['MAIN', 'TRANSIT', 'BLIND'];

export default function WarehousesPage() {
  const { user } = useAuth();
  const manage = can(user, 'warehouse.manage');

  const [rows, setRows] = useState<Warehouse[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<WarehousesPage>(`/warehouses${qs({ limit: 100 })}`)
      .then((data) => {
        if (!cancelled) setRows(data.warehouses);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل المخازن');
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
      <PageHeader title="المخازن" action={manage ? <Button onClick={() => setCreateOpen(true)}>+ مخزن جديد</Button> : undefined} />

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
              <Th>الكود</Th>
              <Th>الاسم</Th>
              <Th>النوع</Th>
              <Th>أمين المخزن</Th>
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
                <Td className="py-6 text-center text-gray-400">لا توجد مخازن</Td>
              </tr>
            ) : (
              rows.map((w) => (
                <tr key={w.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-mono font-semibold">{w.code}</Td>
                  <Td className="font-semibold">{w.nameAr}</Td>
                  <Td>
                    <Badge color="blue">{w.type}</Badge>
                  </Td>
                  <Td>{w.keeper?.name ?? '—'}</Td>
                  <Td>{w.active ? <Badge color="green">نشط</Badge> : <Badge color="red">موقوف</Badge>}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {createOpen ? (
        <CreateWarehouseModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            setNotice('تم إنشاء المخزن');
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function CreateWarehouseModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [type, setType] = useState('MAIN');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await post('/warehouses', {
        code: code.trim(),
        nameAr: nameAr.trim(),
        type,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء المخزن');
      setBusy(false);
    }
  }

  return (
    <Modal title="مخزن جديد" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="الكود">
          <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="MAIN-1" required />
        </Field>
        <Field label="الاسم">
          <TextInput value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
        </Field>
        <Field label="النوع">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
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
        <Button onClick={submit} disabled={busy}>
          {busy ? 'جارِ الحفظ…' : 'حفظ'}
        </Button>
      </div>
    </Modal>
  );
}