'use client';

import { useEffect, useState } from 'react';
import { can, get, post, patch, put, qs, type Permission, type Role, type User, type UsersPage } from '@/lib/api';
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

export default function UsersPage() {
  const { user: me } = useAuth();
  const manage = can(me, 'user.manage');

  const [rows, setRows] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [q, setQ] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<Role[]>('/roles')
      .then((data) => {
        if (!cancelled) setRoles(data);
      })
      .catch(() => undefined);
    if (manage) {
      get<Permission[]>('/permissions')
        .then((data) => {
          if (!cancelled) setPermissions(data);
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [manage, refresh]);

  useEffect(() => {
    let cancelled = false;
    get<UsersPage>(`/users${qs({ q, limit: 100 })}`)
      .then((data) => {
        if (!cancelled) setRows(data.users);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل المستخدمين');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, refresh]);

  return (
    <div className="space-y-6">
      <PageHeader title="المستخدمون والأدوار (حدود الخصم)" action={manage ? <Button onClick={() => setCreateOpen(true)}>+ مستخدم جديد</Button> : undefined} />

      {notice ? (
        <div className="mb-3">
          <Notice type="success">{notice}</Notice>
        </div>
      ) : null}

      {me ? (
        (() => {
          const myRow = rows.find((u) => u.id === me.id);
          const itemPct = myRow?.maxItemDiscountPct ?? (me.roleCode === 'ADMIN' ? 100 : 0);
          const invoicePct = myRow?.maxInvoiceDiscountPct ?? (me.roleCode === 'ADMIN' ? 100 : 0);
          return (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              حدود الخصم الخاصة بك: أقصى خصم صنف{' '}
              <b>{Number(itemPct).toLocaleString('ar-EG')}%</b> — أقصى خصم فاتورة{' '}
              <b>{Number(invoicePct).toLocaleString('ar-EG')}%</b> — تُضبط لكل مستخدم من صفحة المستخدمين
            </div>
          );
        })()
      ) : null}

      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الهاتف…" className="w-64" />
          <Button variant="secondary" onClick={() => setRefresh((s) => s + 1)}>
            تحديث
          </Button>
        </div>
        {error ? <ErrorBox message={error} onRetry={() => setRefresh((s) => s + 1)} /> : null}
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-max border-collapse">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <Th>الاسم</Th>
                <Th>الهاتف</Th>
                <Th>الدور</Th>
                <Th>كود المندوب</Th>
                <Th>أقصى خصم صنف</Th>
                <Th>أقصى خصم فاتورة</Th>
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
                  <Td className="py-6 text-center text-gray-400">لا يوجد مستخدمون</Td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <Td className="font-semibold">
                      {u.name}
                      {me?.id === u.id ? <span className="ml-2 text-xs text-gray-400">(أنت)</span> : null}
                    </Td>
                    <Td dir="ltr">{u.phone ?? '—'}</Td>
                    <Td>{u.role?.nameAr ?? u.role?.code ?? '—'}</Td>
                    <Td className="font-mono">{u.repCode ?? '—'}</Td>
                    <Td>{Number(u.maxItemDiscountPct).toLocaleString('ar-EG')}%</Td>
                    <Td>{Number(u.maxInvoiceDiscountPct).toLocaleString('ar-EG')}%</Td>
                    <Td>{u.active ? <Badge color="green">نشط</Badge> : <Badge color="red">موقوف</Badge>}</Td>
                    <Td>
                      {manage ? (
                        <Button variant="ghost" onClick={() => setEditRow(u)}>
                          تعديل
                        </Button>
                      ) : null}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-base font-bold text-gray-900">الأدوار والصلاحيات</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div className="text-sm font-bold text-gray-900">
                  {r.nameAr} <span className="font-mono text-xs text-gray-400">({r.code})</span>
                </div>
                {manage ? (
                  r.code === 'ADMIN' ? (
                    <Badge color="blue">محمي</Badge>
                  ) : (
                    <Button variant="ghost" onClick={() => setEditRole(r)}>
                      تعديل الصلاحيات والحدود
                    </Button>
                  )
                ) : null}
              </div>
              <div className="mb-2 text-[11px] text-gray-500">
                حد الخصم: صنف{' '}
                {r.maxItemDiscountPct == null ? 'حسب المستخدم' : `${Number(r.maxItemDiscountPct).toLocaleString('ar-EG')}%`}
                {' · '}بيان{' '}
                {r.maxInvoiceDiscountPct == null ? 'حسب المستخدم' : `${Number(r.maxInvoiceDiscountPct).toLocaleString('ar-EG')}%`}
              </div>
              <div className="flex flex-wrap gap-1">
                {r.permissions.length === 0 ? (
                  <span className="text-xs text-gray-400">بدون صلاحيات</span>
                ) : (
                  r.permissions.map((p) => (
                    <span key={p.code} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
                      {p.nameAr}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {createOpen ? (
        <UserModal
          roles={roles}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            setNotice('تم إنشاء المستخدم');
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}

      {editRow ? (
        <UserModal
          user={editRow}
          roles={roles}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null);
            setNotice('تم تحديث المستخدم');
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}

      {editRole ? (
        <RolePermissionsModal
          role={editRole}
          permissions={permissions}
          onClose={() => setEditRole(null)}
          onSaved={() => {
            setEditRole(null);
            setNotice('تم تحديث صلاحيات الدور');
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function UserModal({
  user,
  roles,
  onClose,
  onSaved,
}: {
  user?: User;
  roles: Role[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user?.name ?? '');
  const [roleCode, setRoleCode] = useState(user?.role?.code ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [repCode, setRepCode] = useState(user?.repCode ?? '');
  const [password, setPassword] = useState('');
  const [maxItemDiscountPct, setMaxItemDiscountPct] = useState(user?.maxItemDiscountPct ?? '0');
  const [maxInvoiceDiscountPct, setMaxInvoiceDiscountPct] = useState(user?.maxInvoiceDiscountPct ?? '0');
  const [active, setActive] = useState(user?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const body = {
      name: name.trim(),
      roleCode,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      repCode: repCode.trim() || undefined,
      maxItemDiscountPct: Number(maxItemDiscountPct) || 0,
      maxInvoiceDiscountPct: Number(maxInvoiceDiscountPct) || 0,
      ...(user ? { active } : {}),
      ...(password ? { password } : {}),
    };
    try {
      if (user) await patch(`/users/${user.id}`, body);
      else await post('/users', body);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ المستخدم');
      setBusy(false);
    }
  }

  return (
    <Modal title={user ? `تعديل ${user.name}` : 'مستخدم جديد'} onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="الاسم">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="الدور">
          <Select value={roleCode} onChange={(e) => setRoleCode(e.target.value)} required>
            <option value="">اختر دوراً</option>
            {roles.map((r) => (
              <option key={r.id} value={r.code}>
                {r.nameAr} ({r.code})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="البريد الإلكتروني">
          <TextInput value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        </Field>
        <Field label="الهاتف">
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
        </Field>
        <Field label="كود المندوب (أوفلاين)">
          <TextInput value={repCode} onChange={(e) => setRepCode(e.target.value)} placeholder="M01" />
        </Field>
        <Field label="كلمة المرور" hint={user ? 'اتركها فارغة للإبقاء على الحالية' : '6 أحرف على الأقل'}>
          <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={user ? '••••••••' : ''} />
        </Field>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3">
        <Field label="أقصى خصم صنف (%)">
          <TextInput value={maxItemDiscountPct} onChange={(e) => setMaxItemDiscountPct(e.target.value)} type="number" min="0" max="100" />
        </Field>
        <Field label="أقصى خصم فاتورة (%)">
          <TextInput value={maxInvoiceDiscountPct} onChange={(e) => setMaxInvoiceDiscountPct(e.target.value)} type="number" min="0" max="100" />
        </Field>
      </div>
      {user ? (
        <div className="mb-4">
          <Field label="الحالة">
            <Select value={active ? '1' : '0'} onChange={(e) => setActive(e.target.value === '1')}>
              <option value="1">نشط</option>
              <option value="0">موقوف</option>
            </Select>
          </Field>
        </div>
      ) : null}
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

function groupPermissions(permissions: Permission[]): { key: string; items: Permission[] }[] {
  const map = new Map<string, Permission[]>();
  for (const p of permissions) {
    const key = p.code.split('.')[0] ?? p.code;
    const arr = map.get(key) ?? [];
    arr.push(p);
    map.set(key, arr);
  }
  return [...map.entries()].map(([key, items]) => ({ key, items }));
}

function RolePermissionsModal({
  role,
  permissions,
  onClose,
  onSaved,
}: {
  role: Role;
  permissions: Permission[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(role.permissions.map((p) => p.code)));
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const protectedRole = role.code === 'ADMIN';
  const [maxItem, setMaxItem] = useState(
    role.maxItemDiscountPct == null ? '' : String(role.maxItemDiscountPct),
  );
  const [maxInvoice, setMaxInvoice] = useState(
    role.maxInvoiceDiscountPct == null ? '' : String(role.maxInvoiceDiscountPct),
  );

  const query = q.trim().toLowerCase();
  const groups = groupPermissions(permissions)
    .map(({ key, items }) => ({
      key,
      items: query
        ? items.filter((p) => p.code.toLowerCase().includes(query) || p.nameAr.includes(q.trim()))
        : items,
    }))
    .filter(({ items }) => items.length > 0);

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleGroup(items: Permission[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const it of items) {
        if (on) next.add(it.code);
        else next.delete(it.code);
      }
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (!protectedRole) {
        await put(`/roles/${role.id}/limits`, {
          maxItemDiscountPct: maxItem.trim() === '' ? null : Number(maxItem),
          maxInvoiceDiscountPct: maxInvoice.trim() === '' ? null : Number(maxInvoice),
        });
      }
      await put(`/roles/${role.id}/permissions`, { permissionCodes: [...selected] });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ الصلاحيات');
      setBusy(false);
    }
  }

  return (
    <Modal title={`صلاحيات وحدود: ${role.nameAr} (${role.code})`} onClose={onClose}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في الصلاحيات…" className="w-64" />
        <span className="text-xs text-gray-500">
          محدد {selected.size} من {permissions.length}
        </span>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3">
        <Field label="حد خصم الصنف للدور (%)">
          <TextInput
            value={maxItem}
            onChange={(e) => setMaxItem(e.target.value)}
            type="number"
            min="0"
            max="100"
            placeholder="اتركه فارغاً لحد المستخدم"
            disabled={protectedRole}
          />
        </Field>
        <Field label="حد خصم البيان للدور (%)">
          <TextInput
            value={maxInvoice}
            onChange={(e) => setMaxInvoice(e.target.value)}
            type="number"
            min="0"
            max="100"
            placeholder="اتركه فارغاً لحد المستخدم"
            disabled={protectedRole}
          />
        </Field>
      </div>
      <div className="mb-4 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
        {groups.length === 0 ? (
          <p className="text-sm text-gray-400">لا توجد صلاحيات مطابقة</p>
        ) : (
          groups.map(({ key, items }) => {
            const allOn = items.every((i) => selected.has(i.code));
            return (
              <div key={key} className="rounded-lg border border-gray-200 p-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-500">{key}</span>
                  <Button variant="ghost" onClick={() => toggleGroup(items, !allOn)}>
                    {allOn ? 'إلغاء الكل' : 'تحديد الكل'}
                  </Button>
                </div>
                <div className="grid gap-1 sm:grid-cols-2">
                  {items.map((p) => (
                    <label key={p.code} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-gray-50">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-blue-600"
                        checked={selected.has(p.code)}
                        onChange={() => toggle(p.code)}
                      />
                      <span>
                        {p.nameAr} <span className="font-mono text-[11px] text-gray-400">{p.code}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })
        )}
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