'use client';

import { useEffect, useState } from 'react';
import { can, del, get, patch, post, qs, type Branch, type BranchesPage } from '@/lib/api';
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

const statusBadge = (active: boolean) =>
  active ? <Badge color="green">نشط</Badge> : <Badge color="red">موقوف</Badge>;

export default function BranchesPage() {
  const { user } = useAuth();
  const manage = can(user, 'warehouse.manage');

  const [rows, setRows] = useState<Branch[]>([]);
  const [q, setQ] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<BranchesPage>(`/branches${qs({ q, limit: 100 })}`)
      .then((data) => {
        if (!cancelled) setRows(data.branches);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل الفروع');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, refresh]);

  async function toggleActive(branch: Branch) {
    try {
      await patch(`/branches/${branch.id}`, { active: !branch.active });
      setNotice('تم تحديث حالة الفرع');
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التحديث');
    }
  }

  async function remove(branch: Branch) {
    if (!confirm(`حذف الفرع ${branch.code}؟`)) return;
    try {
      await del(`/branches/${branch.id}`);
      setNotice('تم حذف الفرع');
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحذف');
    }
  }

  return (
    <div>
      <PageHeader
        title="الفروع"
        action={
          manage ? <Button onClick={() => setCreateOpen(true)}>+ فرع جديد</Button> : undefined
        }
      />

      {notice ? (
        <div className="mb-3">
          <Notice type="success">{notice}</Notice>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث بالكود أو الاسم…"
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
              <Th>العنوان</Th>
              <Th>الهاتف</Th>
              <Th>الحالة</Th>
              {manage ? <Th>إجراءات</Th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400" colSpan={manage ? 6 : 5}>
                  جارِ التحميل…
                </Td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400" colSpan={manage ? 6 : 5}>
                  لا توجد فروع
                </Td>
              </tr>
            ) : (
              rows.map((b) => (
                <tr key={b.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-mono font-semibold">{b.code}</Td>
                  <Td className="font-semibold">{b.nameAr}</Td>
                  <Td>{b.address ?? '—'}</Td>
                  <Td dir="ltr">{b.phone ?? '—'}</Td>
                  <Td>{statusBadge(b.active)}</Td>
                  {manage ? (
                    <Td>
                      <div className="flex gap-1">
                        <Button variant="secondary" onClick={() => setEditing(b)}>
                          تعديل
                        </Button>
                        <Button variant="secondary" onClick={() => void toggleActive(b)}>
                          {b.active ? 'إيقاف' : 'تفعيل'}
                        </Button>
                        <Button variant="secondary" onClick={() => void remove(b)}>
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

      {createOpen || editing ? (
        <BranchModal
          branch={editing}
          onClose={() => {
            setCreateOpen(false);
            setEditing(null);
          }}
          onSaved={(msg) => {
            setCreateOpen(false);
            setEditing(null);
            setNotice(msg);
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function BranchModal({
  branch,
  onClose,
  onSaved,
}: {
  branch: Branch | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const editing = !!branch;
  const [code, setCode] = useState(branch?.code ?? '');
  const [nameAr, setNameAr] = useState(branch?.nameAr ?? '');
  const [address, setAddress] = useState(branch?.address ?? '');
  const [phone, setPhone] = useState(branch?.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body = {
        code: code.trim(),
        nameAr: nameAr.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
      };
      if (editing && branch) {
        await patch(`/branches/${branch.id}`, body);
        onSaved('تم تحديث الفرع');
      } else {
        await post('/branches', body);
        onSaved('تم إنشاء الفرع');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحفظ');
      setBusy(false);
    }
  }

  return (
    <Modal title={editing ? 'تعديل فرع' : 'فرع جديد'} onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="الكود">
          <TextInput value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" required />
        </Field>
        <Field label="الاسم">
          <TextInput value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
        </Field>
        <Field label="العنوان">
          <TextInput value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="الهاتف">
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
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
        <Button onClick={() => void submit()} disabled={busy}>
          {busy ? 'جارِ الحفظ…' : 'حفظ'}
        </Button>
      </div>
    </Modal>
  );
}
