'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  can,
  get,
  post,
  qs,
  type Customer,
  type ItemBrief,
  type Quotation,
  type QuotationStatus,
  type QuotationsPage,
  type Warehouse,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  Button,
  ErrorBox,
  Field,
  formatMoney,
  Modal,
  Notice,
  PageHeader,
  Select,
  Td,
  TextInput,
  Th,
} from '@/components/ui';

const STATUS_LABEL: Record<QuotationStatus, string> = {
  DRAFT: 'مسودة',
  SENT: 'مُرسل',
  ACCEPTED: 'مقبول',
  REJECTED: 'مرفوض',
  CONVERTED: 'محوّل لبيان',
  EXPIRED: 'منتهي',
};

const STATUS_COLOR: Record<QuotationStatus, string> = {
  DRAFT: 'gray',
  SENT: 'blue',
  ACCEPTED: 'green',
  REJECTED: 'red',
  CONVERTED: 'blue',
  EXPIRED: 'red',
};

export default function QuotationsPage() {
  const { user } = useAuth();
  const canCreate = can(user, 'statement.create');
  const canApprove = can(user, 'statement.approve');

  const [rows, setRows] = useState<Quotation[]>([]);
  const [status, setStatus] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<QuotationsPage>(`/quotations${qs({ status, limit: 100 })}`)
      .then((data) => {
        if (!cancelled) setRows(data.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل عروض الأسعار');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, refresh]);

  async function action(id: number, verb: 'send' | 'accept' | 'reject' | 'convert') {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await post<{ statement?: { number: string } }>(`/quotations/${id}/${verb}`, {});
      if (verb === 'convert' && res.statement) {
        setNotice(`تم التحويل إلى بيان الأسعار ${res.statement.number}`);
      } else if (verb === 'send') {
        setNotice('تم إرسال العرض للعميل');
      } else if (verb === 'accept') {
        setNotice('تم قبول العرض');
      } else {
        setNotice('تم رفض العرض');
      }
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تنفيذ الإجراء');
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(
    () => rows.reduce((acc, r) => ({ ...acc, [r.effectiveStatus]: (acc[r.effectiveStatus] ?? 0) + 1 }), {} as Record<string, number>),
    [rows],
  );

  return (
    <div>
      <PageHeader
        title="عروض الأسعار"
        action={
          canCreate ? <Button onClick={() => setCreateOpen(true)}>+ عرض سعر جديد</Button> : undefined
        }
      />

      {notice ? (
        <div className="mb-3">
          <Notice type="success">{notice}</Notice>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
          <option value="">كل الحالات</option>
          <option value="DRAFT">مسودة</option>
          <option value="SENT">مُرسل</option>
          <option value="ACCEPTED">مقبول</option>
          <option value="REJECTED">مرفوض</option>
          <option value="CONVERTED">محوّل لبيان</option>
          <option value="EXPIRED">منتهي</option>
        </Select>
        <Button variant="secondary" onClick={() => setRefresh((s) => s + 1)}>
          تحديث
        </Button>
        <div className="text-xs text-gray-500">الإجمالي: {rows.length}</div>
        {Object.entries(counts).map(([k, v]) => (
          <span key={k} className="text-xs text-gray-400">
            {STATUS_LABEL[k as QuotationStatus]}: {v}
          </span>
        ))}
      </div>

      {error ? <ErrorBox message={error} onRetry={() => setRefresh((s) => s + 1)} /> : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الرقم</Th>
              <Th>التاريخ</Th>
              <Th>العميل</Th>
              <Th>الصافي</Th>
              <Th>عدد البنود</Th>
              <Th>الحالة</Th>
              <Th>إجراءات</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400" colSpan={7}>
                  جارِ التحميل…
                </Td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400" colSpan={7}>
                  لا توجد عروض أسعار
                </Td>
              </tr>
            ) : (
              rows.map((q) => {
                const st = q.effectiveStatus;
                const busy = busyId === q.id;
                const convertible = st !== 'CONVERTED' && st !== 'REJECTED' && st !== 'EXPIRED';
                return (
                  <tr
                    key={q.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  >
                    <Td className="font-mono font-semibold">
                      <Link className="text-blue-600 underline-offset-2 hover:underline" href={`/quotations/${q.id}`}>
                        {q.number}
                      </Link>
                    </Td>
                    <Td>{new Date(q.date).toLocaleDateString('ar-EG')}</Td>
                    <Td className="font-semibold">
                      {q.customer.nameAr}{' '}
                      <span className="font-mono text-xs text-gray-400">{q.customer.code}</span>
                    </Td>
                    <Td className="font-semibold">{formatMoney(q.net)}</Td>
                    <Td>{q._count?.lines ?? 0}</Td>
                    <Td>
                      <Badge color={STATUS_COLOR[st]}>{STATUS_LABEL[st]}</Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {canCreate && st === 'DRAFT' ? (
                          <Button variant="secondary" disabled={busy} onClick={() => void action(q.id, 'send')}>
                            إرسال
                          </Button>
                        ) : null}
                        {canApprove && (st === 'DRAFT' || st === 'SENT') ? (
                          <>
                            <Button variant="secondary" disabled={busy} onClick={() => void action(q.id, 'accept')}>
                              قبول
                            </Button>
                            <Button variant="secondary" disabled={busy} onClick={() => void action(q.id, 'reject')}>
                              رفض
                            </Button>
                          </>
                        ) : null}
                        {canCreate && convertible ? (
                          <Button disabled={busy} onClick={() => void action(q.id, 'convert')}>
                            تحويل لبيان
                          </Button>
                        ) : null}
                        {q.convertedStatementId ? (
                          <Link
                            href={`/statements/${q.convertedStatementId}`}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                          >
                            عرض البيان
                          </Link>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {createOpen ? (
        <CreateQuotationModal
          onClose={() => setCreateOpen(false)}
          onCreated={(num) => {
            setCreateOpen(false);
            setNotice(`تم إنشاء عرض السعر ${num}`);
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}
    </div>
  );
}

type LineDraft = { itemCode: string; qty: string; unitPrice: string };

function CreateQuotationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (number: string) => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<ItemBrief[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [customerId, setCustomerId] = useState<number | ''>('');
  const [warehouseId, setWarehouseId] = useState<number | ''>('');
  const [validUntil, setValidUntil] = useState('');
  const [taxPercent, setTaxPercent] = useState('0');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([{ itemCode: '', qty: '1', unitPrice: '' }]);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([
      get<{ customers: Customer[] }>('/customers?limit=200').then((d) => setCustomers(d.customers)),
      get<{ items: ItemBrief[] }>('/items?limit=500').then((d) => setItems(d.items)),
      get<{ warehouses: Warehouse[] }>('/warehouses?limit=100').then((d) => setWarehouses(d.warehouses)),
    ]).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'فشل تحميل البيانات');
    });
  }, []);

  function updateLine(i: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        customerId: Number(customerId),
        warehouseId: warehouseId === '' ? undefined : Number(warehouseId),
        validUntil: validUntil || undefined,
        taxPercent: Number(taxPercent) || 0,
        notes: notes.trim() || undefined,
        lines: lines
          .filter((l) => l.itemCode)
          .map((l) => ({
            itemCode: l.itemCode,
            qty: Number(l.qty) || 0,
            unitPrice: l.unitPrice.trim() ? Number(l.unitPrice) : undefined,
          })),
      };
      if (payload.lines.length === 0) throw new Error('أضف صنفاً واحداً على الأقل');
      const created = await post<{ number: string }>('/quotations', payload);
      onCreated(created.number);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء العرض');
      setBusy(false);
    }
  }

  const total = lines.reduce((sum, l) => {
    const qty = Number(l.qty) || 0;
    const price = Number(l.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  return (
    <Modal title="عرض سعر جديد" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="العميل">
          <Select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : '')}
            required
          >
            <option value="">— اختر —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="المخزن">
          <Select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">الافتراضي (MAIN)</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="صالح حتى" hint="اختياري">
          <TextInput type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </Field>
        <Field label="ضريبة %">
          <TextInput
            type="number"
            min={0}
            max={100}
            value={taxPercent}
            onChange={(e) => setTaxPercent(e.target.value)}
            dir="ltr"
          />
        </Field>
      </div>

      <div className="mb-2 text-sm font-semibold text-gray-700">البنود</div>
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 items-end gap-2">
            <div className="col-span-5">
              <Field label={i === 0 ? 'الصنف' : ''}>
                <Select value={l.itemCode} onChange={(e) => updateLine(i, { itemCode: e.target.value })}>
                  <option value="">— اختر —</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.code}>
                      {it.code} — {it.nameAr}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="col-span-2">
              <Field label={i === 0 ? 'الكمية' : ''}>
                <TextInput
                  type="number"
                  min={0}
                  step="any"
                  value={l.qty}
                  onChange={(e) => updateLine(i, { qty: e.target.value })}
                  dir="ltr"
                />
              </Field>
            </div>
            <div className="col-span-3">
              <Field label={i === 0 ? 'السعر (اتركه فارغاً للتسعير التلقائي)' : ''}>
                <TextInput
                  type="number"
                  min={0}
                  step="any"
                  value={l.unitPrice}
                  onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                  dir="ltr"
                />
              </Field>
            </div>
            <div className="col-span-2 pb-1">
              <Button
                variant="secondary"
                onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                disabled={lines.length === 1}
              >
                حذف
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mb-3 mt-2">
        <Button variant="secondary" onClick={() => setLines((prev) => [...prev, { itemCode: '', qty: '1', unitPrice: '' }])}>
          + بند
        </Button>
      </div>

      <Field label="ملاحظات">
        <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div className="mt-3 flex items-center justify-between text-sm font-semibold text-gray-700">
        <span>إجمالي تقديري (قبل الضريبة)</span>
        <span>{formatMoney(total)}</span>
      </div>

      {error ? (
        <div className="mt-3">
          <ErrorBox message={error} />
        </div>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
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
