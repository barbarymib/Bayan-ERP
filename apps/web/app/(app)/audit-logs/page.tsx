'use client';

import { Fragment, useEffect, useState } from 'react';
import { can, get, qs, type AuditLogDoc, type AuditLogsPage, type User } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  ErrorBox,
  Field,
  PageHeader,
  Select,
  Td,
  TextInput,
  Th,
  formatDate,
} from '@/components/ui';

const ACTION_COLOR: Record<string, string> = {
  'price.change': 'blue',
  'approval.decide': 'orange',
  create: 'green',
  update: 'blue',
  delete: 'red',
};

const FIELD_LABELS: Record<string, { ar: string; en: string }> = {
  creditLimit: { ar: 'الحد الائتماني', en: 'Credit Limit' },
  balance: { ar: 'الرصيد القائم', en: 'Balance' },
  status: { ar: 'الحالة التشغيلية', en: 'Status' },
  net: { ar: 'الصافي النهائي', en: 'Net Amount' },
  subtotal: { ar: 'المجموع قبل الضريبة', en: 'Subtotal' },
  taxAmount: { ar: 'مبلغ الضريبة', en: 'Tax Amount' },
  taxPercent: { ar: 'نسبة الضريبة', en: 'Tax %' },
  discountAmount: { ar: 'مبلغ الخصم', en: 'Discount Amount' },
  discountValue: { ar: 'قيمة/نسبة الخصم', en: 'Discount Value' },
  discountType: { ar: 'نوع الخصم', en: 'Discount Type' },
  unitPrice: { ar: 'سعر الوحدة', en: 'Unit Price' },
  qty: { ar: 'الكمية', en: 'Quantity' },
  phone: { ar: 'رقم الهاتف', en: 'Phone' },
  nameAr: { ar: 'الاسم بالعربي', en: 'Arabic Name' },
  nameEn: { ar: 'الاسم بالإنجليزي', en: 'English Name' },
  name: { ar: 'الاسم', en: 'Name' },
  code: { ar: 'الكود / الرمز', en: 'Code' },
  email: { ar: 'البريد الإلكتروني', en: 'Email' },
  paymentTerm: { ar: 'شروط السداد', en: 'Payment Term' },
  enabledFeatures: { ar: 'الميزات المفعلة', en: 'Features' },
  isActive: { ar: 'مفعل', en: 'Active' },
  role: { ar: 'الدور الوظيفي', en: 'Role' },
  warehouseId: { ar: 'المستودع', en: 'Warehouse ID' },
  customerId: { ar: 'العميل', en: 'Customer ID' },
  itemId: { ar: 'الصنف', en: 'Item ID' },
  unitId: { ar: 'الوحدة', en: 'Unit ID' },
  barcode: { ar: 'الباركود', en: 'Barcode' },
  minPrice: { ar: 'الحد الأدنى للسعر', en: 'Min Price' },
  costPrice: { ar: 'سعر التكلفة', en: 'Cost Price' },
  notes: { ar: 'الملاحظات', en: 'Notes' },
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'نعم (Yes)' : 'لا (No)';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function AuditDiffInspector({ log }: { log: AuditLogDoc }) {
  const [mode, setMode] = useState<'diff' | 'json'>('diff');
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [copied, setCopied] = useState<'before' | 'after' | null>(null);

  const beforeObj =
    log.beforeJson && typeof log.beforeJson === 'object' && !Array.isArray(log.beforeJson)
      ? (log.beforeJson as Record<string, unknown>)
      : null;
  const afterObj =
    log.afterJson && typeof log.afterJson === 'object' && !Array.isArray(log.afterJson)
      ? (log.afterJson as Record<string, unknown>)
      : null;

  const isObjectComparison = Boolean(beforeObj || afterObj);

  // Compute diffs
  const allKeys = Array.from(
    new Set([...Object.keys(beforeObj || {}), ...Object.keys(afterObj || {})]),
  );

  type DiffItem = {
    key: string;
    label: { ar: string; en: string };
    type: 'added' | 'removed' | 'changed' | 'unchanged';
    beforeVal: unknown;
    afterVal: unknown;
  };

  const diffItems: DiffItem[] = allKeys.map((key) => {
    const hasBefore = beforeObj ? key in beforeObj : false;
    const hasAfter = afterObj ? key in afterObj : false;
    const beforeVal = beforeObj ? beforeObj[key] : undefined;
    const afterVal = afterObj ? afterObj[key] : undefined;
    const label = FIELD_LABELS[key] || { ar: key, en: key };

    if (!hasBefore && hasAfter) {
      return { key, label, type: 'added', beforeVal: null, afterVal };
    }
    if (hasBefore && !hasAfter) {
      return { key, label, type: 'removed', beforeVal, afterVal: null };
    }

    const same = JSON.stringify(beforeVal) === JSON.stringify(afterVal);
    return {
      key,
      label,
      type: same ? 'unchanged' : 'changed',
      beforeVal,
      afterVal,
    };
  });

  const modifiedItems = diffItems.filter((i) => i.type !== 'unchanged');
  const unchangedItems = diffItems.filter((i) => i.type === 'unchanged');

  const copyJson = (data: unknown, target: 'before' | 'after') => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      setCopied(target);
      setTimeout(() => setCopied(null), 1800);
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      {/* Header bar with mode switch & summary */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">سجل النشاط #{log.id}</span>
          <Badge color={ACTION_COLOR[log.action] ?? 'gray'}>{log.action}</Badge>
          <span className="text-xs text-slate-400">({log.entity} #{log.entityId})</span>
          {modifiedItems.length > 0 ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-2xs font-bold text-amber-700 border border-amber-200">
              {modifiedItems.length} تغيير(ات)
            </span>
          ) : isObjectComparison && !beforeObj ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-2xs font-bold text-emerald-700 border border-emerald-200">
              إنشاء سجل جديد
            </span>
          ) : isObjectComparison && !afterObj ? (
            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-2xs font-bold text-rose-700 border border-rose-200">
              حذف السجل
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setMode('diff')}
            className={`rounded-md px-2.5 py-1 transition-all ${
              mode === 'diff' ? 'bg-white font-bold text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            فروقات التعديل (Diff)
          </button>
          <button
            type="button"
            onClick={() => setMode('json')}
            className={`rounded-md px-2.5 py-1 transition-all ${
              mode === 'json' ? 'bg-white font-bold text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            عرض JSON كامل
          </button>
        </div>
      </div>

      {mode === 'diff' ? (
        <div>
          {!isObjectComparison ? (
            <div className="p-4 text-center text-xs text-slate-400">
              لا توجد حمولة كائن مهيكلة لمقارنتها بصرياً. يرجى التبديل إلى عرض JSON الكامل.
            </div>
          ) : modifiedItems.length === 0 && unchangedItems.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              لا توجد حقول مسجلة في هذه العملية.
            </div>
          ) : (
            <div>
              {modifiedItems.length === 0 && (
                <div className="mb-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500 text-center">
                  لم يتم رصد أي اختلاف بين القيم السابقة والجديدة المسجلة.
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="p-2.5 font-bold">الحقل (Field)</th>
                      <th className="p-2.5 font-bold">الحالة</th>
                      <th className="p-2.5 font-bold">القيمة السابقة (Before)</th>
                      <th className="p-2.5 font-bold">القيمة الجديدة (After)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {modifiedItems.map((item) => (
                      <tr
                        key={item.key}
                        className={
                          item.type === 'changed'
                            ? 'bg-amber-50/50 hover:bg-amber-50'
                            : item.type === 'added'
                            ? 'bg-emerald-50/50 hover:bg-emerald-50'
                            : 'bg-rose-50/50 hover:bg-rose-50'
                        }
                      >
                        <td className="p-2.5 font-medium text-slate-900">
                          <div>{item.label.ar}</div>
                          <span className="font-mono text-2xs text-slate-400">{item.key}</span>
                        </td>
                        <td className="p-2.5">
                          {item.type === 'changed' && (
                            <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-2xs font-bold text-amber-800">
                              تعديل
                            </span>
                          )}
                          {item.type === 'added' && (
                            <span className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-2xs font-bold text-emerald-800">
                              إضافة
                            </span>
                          )}
                          {item.type === 'removed' && (
                            <span className="inline-block rounded bg-rose-100 px-2 py-0.5 text-2xs font-bold text-rose-800">
                              حذف
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-rose-700 line-through">
                          {formatValue(item.beforeVal)}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-emerald-700">
                          {formatValue(item.afterVal)}
                        </td>
                      </tr>
                    ))}

                    {showUnchanged &&
                      unchangedItems.map((item) => (
                        <tr key={item.key} className="bg-white text-slate-400 hover:bg-slate-50/70">
                          <td className="p-2.5 font-medium">
                            <div>{item.label.ar}</div>
                            <span className="font-mono text-2xs text-slate-400">{item.key}</span>
                          </td>
                          <td className="p-2.5">
                            <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-500">
                              ثابت
                            </span>
                          </td>
                          <td className="p-2.5 font-mono" colSpan={2}>
                            {formatValue(item.afterVal)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {unchangedItems.length > 0 && (
                <div className="mt-2.5 text-start">
                  <button
                    type="button"
                    onClick={() => setShowUnchanged((s) => !s)}
                    className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    <span>{showUnchanged ? 'إخفاء' : 'عرض'} الحقول غير المعدلة ({unchangedItems.length})</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-900 p-3 text-start">
            <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="text-xs font-bold uppercase text-slate-400">Before / قبل التعديل</span>
              {log.beforeJson ? (
                <button
                  type="button"
                  onClick={() => copyJson(log.beforeJson, 'before')}
                  className="rounded bg-slate-800 px-2 py-0.5 text-2xs font-medium text-slate-300 hover:bg-slate-700"
                >
                  {copied === 'before' ? '✓ تم النسخ' : 'نسخ JSON'}
                </button>
              ) : null}
            </div>
            <pre className="max-h-72 overflow-auto text-2xs font-mono text-emerald-400 dir-ltr" dir="ltr">
              {log.beforeJson ? JSON.stringify(log.beforeJson, null, 2) : '// No previous state recorded'}
            </pre>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-900 p-3 text-start">
            <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="text-xs font-bold uppercase text-slate-400">After / بعد التعديل</span>
              {log.afterJson ? (
                <button
                  type="button"
                  onClick={() => copyJson(log.afterJson, 'after')}
                  className="rounded bg-slate-800 px-2 py-0.5 text-2xs font-medium text-slate-300 hover:bg-slate-700"
                >
                  {copied === 'after' ? '✓ تم النسخ' : 'نسخ JSON'}
                </button>
              ) : null}
            </div>
            <pre className="max-h-72 overflow-auto text-2xs font-mono text-cyan-400 dir-ltr" dir="ltr">
              {log.afterJson ? JSON.stringify(log.afterJson, null, 2) : '// No subsequent state recorded'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuditLogsPage() {
  const { user } = useAuth();
  const allowed = can(user, 'audit.view');

  const [page, setPage] = useState<AuditLogsPage | null>(null);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!allowed) return;
    get<{ users: User[] }>('/users?limit=200')
      .then((d) => setUsers(d.users))
      .catch(() => undefined);
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    get<AuditLogsPage>(`/audit-logs${qs({ entity, action, userId, from, to, limit: 100 })}`)
      .then((data) => {
        if (!cancelled) {
          setPage(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load audit logs');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, entity, action, userId, from, to, refresh]);

  if (!allowed) {
    return (
      <div>
        <PageHeader title="Audit Log" />
        <ErrorBox message="You do not have permission to view the audit log" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Audit Log" />
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-5">
        <Field label="Entity">
          <TextInput value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="price_statement" />
        </Field>
        <Field label="Action">
          <TextInput value={action} onChange={(e) => setAction(e.target.value)} placeholder="price.change" />
        </Field>
        <Field label="User">
          <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">All</option>
            {users.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From">
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((r) => r + 1)} /> : null}
      {page ? <div className="mb-2 text-sm text-gray-500">{page.total} entries</div> : null}
      <div className="rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-right text-xs uppercase text-gray-400">
              <Th>Date</Th>
              <Th>User</Th>
              <Th>Entity</Th>
              <Th>Action</Th>
              <Th>Entity ID</Th>
              <Th>Details</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td colSpan={6}>Loading...</Td>
              </tr>
            ) : !page || page.items.length === 0 ? (
              <tr>
                <Td colSpan={6}>No audit entries</Td>
              </tr>
            ) : (
              page.items.map((log: AuditLogDoc) => (
                <Fragment key={log.id}>
                  <tr className="border-b border-gray-100 text-right">
                    <Td>{formatDate(log.at)}</Td>
                    <Td className="font-semibold">{log.user?.name ?? '-'}</Td>
                    <Td>{log.entity}</Td>
                    <Td>
                      <Badge color={ACTION_COLOR[log.action] ?? 'gray'}>{log.action}</Badge>
                    </Td>
                    <Td>{log.entityId}</Td>
                    <Td>
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      >
                        {expanded === log.id ? 'Hide' : 'View'}
                      </button>
                    </Td>
                  </tr>
                  {expanded === log.id ? (
                    <tr className="border-b border-gray-100 bg-slate-50/60">
                      <Td colSpan={6} className="p-3">
                        <AuditDiffInspector log={log} />
                      </Td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
