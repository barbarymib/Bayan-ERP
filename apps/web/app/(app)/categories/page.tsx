'use client';

import { useEffect, useState } from 'react';
import { can, del, get, patch, post, qs, type CategoriesPage, type CategoryRow } from '@/lib/api';
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

export default function CategoriesPage() {
  const { user } = useAuth();
  const manage = can(user, 'item.manage');

  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<CategoryRow | 'new' | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<CategoriesPage>(`/categories${qs({})}`)
      .then((d) => {
        if (!cancelled) {
          setRows(d.categories);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل التصنيفات');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function remove(c: CategoryRow) {
    if (!confirm(`حذف التصنيف ${c.nameAr}؟`)) return;
    try {
      await del(`/categories/${c.id}`);
      setNotice(`تم حذف التصنيف ${c.nameAr}`);
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حذف التصنيف');
    }
  }

  return (
    <div>
      <PageHeader
        title="التصنيفات"
        action={manage ? <Button onClick={() => setEditing('new')}>+ تصنيف جديد</Button> : undefined}
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
              <Th>الاسم الإنجليزي</Th>
              <Th>التصنيف الأب</Th>
              <Th>أصناف</Th>
              <Th>تصنيفات فرعية</Th>
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
                <Td className="py-6 text-center text-gray-400">لا توجد تصنيفات</Td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-mono font-semibold">{c.code}</Td>
                  <Td className="font-semibold">{c.nameAr}</Td>
                  <Td>{c.nameEn ?? '—'}</Td>
                  <Td>{c.parent?.nameAr ?? '—'}</Td>
                  <Td>
                    <Badge color={c._count.items > 0 ? 'blue' : 'gray'}>{c._count.items}</Badge>
                  </Td>
                  <Td>{c._count.children}</Td>
                  {manage ? (
                    <Td>
                      <div className="flex gap-1">
                        <Button variant="ghost" onClick={() => setEditing(c)}>
                          تعديل
                        </Button>
                        <Button variant="danger" onClick={() => remove(c)} disabled={c._count.items > 0 || c._count.children > 0}>
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
        <CategoryModal
          rows={rows}
          category={editing === 'new' ? null : editing}
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

function CategoryModal({
  rows,
  category,
  onClose,
  onSaved,
}: {
  rows: CategoryRow[];
  category: CategoryRow | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [code, setCode] = useState(category?.code ?? '');
  const [nameAr, setNameAr] = useState(category?.nameAr ?? '');
  const [nameEn, setNameEn] = useState(category?.nameEn ?? '');
  const [parentCode, setParentCode] = useState(category?.parent?.code ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (category) {
        await patch(`/categories/${category.id}`, {
          nameAr: nameAr.trim(),
          nameEn: nameEn.trim() || undefined,
          parentCode: parentCode || undefined,
        });
        onSaved(`تم تحديث التصنيف ${nameAr}`);
      } else {
        await post('/categories', {
          code: code.trim(),
          nameAr: nameAr.trim(),
          nameEn: nameEn.trim() || undefined,
          parentCode: parentCode || undefined,
        });
        onSaved(`تم إنشاء التصنيف ${nameAr}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ التصنيف');
      setBusy(false);
    }
  }

  return (
    <Modal title={category ? `تعديل ${category.nameAr}` : 'تصنيف جديد'} onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="الكود">
          <TextInput value={code} onChange={(e) => setCode(e.target.value)} disabled={!!category} required />
        </Field>
        <Field label="الاسم">
          <TextInput value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
        </Field>
        <Field label="الاسم الإنجليزي">
          <TextInput value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </Field>
        <Field label="التصنيف الأب">
          <Select value={parentCode} onChange={(e) => setParentCode(e.target.value)}>
            <option value="">بدون</option>
            {rows
              .filter((r) => r.id !== category?.id)
              .map((r) => (
                <option key={r.id} value={r.code}>
                  {r.code} — {r.nameAr}
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
        <Button onClick={submit} disabled={busy || !code.trim() || !nameAr.trim()}>
          {busy ? 'جارِ الحفظ…' : 'حفظ'}
        </Button>
      </div>
    </Modal>
  );
}
