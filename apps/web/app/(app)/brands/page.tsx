'use client';

import { useEffect, useState } from 'react';
import { can, del, get, patch, post, qs, type BrandRow, type BrandsPage } from '@/lib/api';
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

export default function BrandsPage() {
  const { user } = useAuth();
  const manage = can(user, 'item.manage');

  const [rows, setRows] = useState<BrandRow[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<BrandRow | 'new' | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<BrandsPage>(`/brands${qs({})}`)
      .then((d) => {
        if (!cancelled) {
          setRows(d.brands);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل الماركات');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function remove(b: BrandRow) {
    if (!confirm(`حذف الماركة ${b.nameAr}؟`)) return;
    try {
      await del(`/brands/${b.id}`);
      setNotice(`تم حذف الماركة ${b.nameAr}`);
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حذف الماركة');
    }
  }

  return (
    <div>
      <PageHeader
        title="الماركات"
        action={manage ? <Button onClick={() => setEditing('new')}>+ ماركة جديدة</Button> : undefined}
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
              <Th>الكود</Th>
              <Th>الاسم</Th>
              <Th>أصناف</Th>
              {manage ? <Th></Th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا توجد ماركات</Td>
              </tr>
            ) : (
              rows.map((b) => (
                <tr key={b.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-mono font-semibold">{b.code}</Td>
                  <Td className="font-semibold">{b.nameAr}</Td>
                  <Td>
                    <Badge color={b._count.items > 0 ? 'blue' : 'gray'}>{b._count.items}</Badge>
                  </Td>
                  {manage ? (
                    <Td>
                      <div className="flex gap-1">
                        <Button variant="ghost" onClick={() => setEditing(b)}>
                          تعديل
                        </Button>
                        <Button variant="danger" onClick={() => remove(b)} disabled={b._count.items > 0}>
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

      {editing ? (
        <BrandModal
          brand={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            setNotice(msg);
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function BrandModal({
  brand,
  onClose,
  onSaved,
}: {
  brand: BrandRow | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [code, setCode] = useState(brand?.code ?? '');
  const [nameAr, setNameAr] = useState(brand?.nameAr ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (brand) {
        await patch(`/brands/${brand.id}`, { nameAr: nameAr.trim() });
        onSaved(`تم تحديث الماركة ${nameAr}`);
      } else {
        await post('/brands', { code: code.trim(), nameAr: nameAr.trim() });
        onSaved(`تم إنشاء الماركة ${nameAr}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ الماركة');
      setBusy(false);
    }
  }

  return (
    <Modal title={brand ? `تعديل ${brand.nameAr}` : 'ماركة جديدة'} onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="الكود">
          <TextInput value={code} onChange={(e) => setCode(e.target.value)} disabled={!!brand} required />
        </Field>
        <Field label="الاسم">
          <TextInput value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
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
