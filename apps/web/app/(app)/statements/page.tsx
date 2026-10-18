'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  can,
  delBody,
  get,
  post,
  qs,
  type CompanySettings,
  type Customer,
  type CustomersPage,
  type Item,
  type ItemsPage,
  type PriceStatement,
  type PricingAlert,
  type StatementStatus,
  type StatementsPage,
  type Warehouse,
} from '@/lib/api';
import { calcStatementTotals, convertDiscount } from '@bayan/shared';
import { isLineQtyAllowed } from '@/lib/units';
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

const statusLabel: Record<StatementStatus, string> = {
  DRAFT: 'بانتظار الموافقة',
  PENDING_REVIEW: 'قيد المراجعة',
  APPROVED: 'معتمد',
  ARCHIVED: 'مؤرشف',
  CANCELLED: 'ملغي',
};

const statusColor: Record<StatementStatus, string> = {
  DRAFT: 'blue',
  PENDING_REVIEW: 'blue',
  APPROVED: 'green',
  ARCHIVED: 'gray',
  CANCELLED: 'red',
};

const pricingAlertLabel: Record<PricingAlert['type'], string> = {
  below_cost: 'أقل من التكلفة',
  below_min_price: 'أقل من حد السعر الأدنى',
};

function unitOptions(item: Item | undefined) {
  if (!item) return [] as { code: string; nameAr: string | null }[];
  const opts = [item.baseUnit, ...item.itemUnits.map((iu) => iu.unit)];
  return opts.filter((u, i, arr) => arr.findIndex((x) => x.code === u.code) === i);
}

export default function StatementsPage() {
  const { user } = useAuth();
  const canCreate = can(user, 'statement.create');
  const canCancel = can(user, 'statement.cancel');

  const [rows, setRows] = useState<PriceStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [status, setStatus] = useState('');
  const [staleDraftDays, setStaleDraftDays] = useState(3);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewRow, setViewRow] = useState<PriceStatement | null>(null);
  const [cancelRow, setCancelRow] = useState<PriceStatement | null>(null);
  const [pricingAlerts, setPricingAlerts] = useState<PricingAlert[]>([]);

  useEffect(() => {
    let cancelled = false;
    get<StatementsPage>(`/price-statements${qs({ status, limit: 50 })}`)
      .then((d) => {
        if (!cancelled) {
          setRows(d.items);
          setStaleDraftDays(d.staleDraftDays ?? 3);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل البيانات');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, refresh]);

  const staleDrafts = rows.filter((s) => s.isStaleDraft);

  return (
    <div>
      <PageHeader
        title="بيانات الأسعار"
        action={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>+ بيان أسعار جديد</Button>
          ) : undefined
        }
      />

      {notice ? (
        <div className="mb-3">
          <Notice type="success">{notice}</Notice>
        </div>
      ) : null}

      {staleDrafts.length > 0 ? (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          تنبيه: {staleDrafts.length} بيان مسودة مضى عليه أكثر من {staleDraftDays} يوم دون اعتماد — راجع
          الأسعار فقد تكون تغيّرت.
        </div>
      ) : null}

      {pricingAlerts.length > 0 ? (
        <div className="mb-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="mb-1 font-semibold">
            تنبيهات تسعير ({pricingAlerts.length}) — يحتاج إقراراً:
          </div>
          <ul className="list-disc space-y-1 ps-5">
            {pricingAlerts.map((a, i) => (
              <li key={`${a.itemCode}-${a.type}-${i}`}>
                الصنف {a.itemCode}: سعر الوحدة {formatMoney(a.unitPrice)} {pricingAlertLabel[a.type]}{' '}
                (الحد {formatMoney(a.threshold)})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Field label="الحالة">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
            <option value="">الكل</option>
            {(Object.keys(statusLabel) as StatementStatus[]).map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="secondary" onClick={() => setRefresh((s) => s + 1)}>
          تحديث
        </Button>
        <span className="text-sm text-gray-500">{rows.length} بيان</span>
      </div>

      {error ? <ErrorBox message={error} onRetry={() => setRefresh((s) => s + 1)} /> : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الرقم</Th>
              <Th>التاريخ</Th>
              <Th>العميل</Th>
              <Th>الدفع</Th>
              <Th>الصافي</Th>
              <Th>الاستحقاق</Th>
              <Th>البند</Th>
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
                <Td className="py-6 text-center text-gray-400">لا توجد بيانات</Td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-mono font-semibold">{s.number}</Td>
                  <Td>{formatDate(s.date)}</Td>
                  <Td>
                    <div className="font-semibold">{s.customer.nameAr}</div>
                    <div className="text-xs text-gray-400">{s.customer.code}</div>
                  </Td>
                  <Td>{s.paymentTerm}</Td>
                  <Td className="font-bold">{formatMoney(s.net)}</Td>
                  <Td>
                    <div>{s.dueDate ? formatDate(s.dueDate) : '—'}</div>
                    {s.overdue ? <Badge color="red">متأخر</Badge> : null}
                  </Td>
                  <Td>{s._count?.lines ?? '—'}</Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge color={statusColor[s.status]}>{statusLabel[s.status]}</Badge>
                      {s.isStaleDraft ? (
                        <Badge color="amber">مسودة قديمة {s.ageDays} يوم</Badge>
                      ) : null}
                    </div>
                  </Td>
                  <Td className="flex gap-1">
                    <Button variant="ghost" onClick={() => setViewRow(s)}>
                      عرض
                    </Button>
                    <Link
                      href={`/statements/${s.id}/print`}
                      className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      طباعة
                    </Link>
                    {canCancel && s.status !== 'CANCELLED' && s.status !== 'ARCHIVED' ? (
                      <Button variant="ghost" onClick={() => setCancelRow(s)}>
                        إلغاء
                      </Button>
                    ) : null}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {createOpen ? (
        <CreateStatementModal
          onClose={() => setCreateOpen(false)}
          onSaved={(msg, alerts) => {
            setCreateOpen(false);
            setNotice(msg);
            setPricingAlerts(alerts ?? []);
            setRefresh((r) => r + 1);
          }}
        />
      ) : null}

      {viewRow ? (
        <StatementDetailModal statement={viewRow} onClose={() => setViewRow(null)} />
      ) : null}

      {cancelRow ? (
        <CancelStatementModal
          statement={cancelRow}
          onClose={() => setCancelRow(null)}
          onDone={(msg) => {
            setCancelRow(null);
            setNotice(msg);
            setRefresh((r) => r + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function CreateStatementModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (msg: string, alerts?: PricingAlert[]) => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [paymentTerm, setPaymentTerm] = useState('CREDIT');
  const [date, setDate] = useState(todayStr());
  const [discType, setDiscType] = useState('');
  const [discValue, setDiscValue] = useState('');
  const [shipping, setShipping] = useState('0');
  const [paid, setPaid] = useState('0');
  const [taxPercent, setTaxPercent] = useState('0');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      get<CustomersPage>(`/customers${qs({ limit: 200 })}`),
      get<{ warehouses: Warehouse[] }>('/warehouses'),
      get<ItemsPage>(`/items${qs({ limit: 200 })}`),
    ])
      .then(([c, w, it]) => {
        if (!cancelled) {
          setCustomers(c.customers);
          setWarehouses(w.warehouses);
          setItems(it.items);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    get<CompanySettings>('/company')
      .then((d) => {
        if (!cancelled) setTaxPercent(String(d.company.taxPercent));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function addLine() {
    setLines([...lines, { itemCode: '', unitCode: '', qty: '1', unitPrice: '', discType: '', discValue: '', weightNote: '' }]);
  }

  function updateLine(i: number, patch: Partial<LineRow>) {
    const next = [...lines];
    next[i] = { ...next[i], ...patch };
    if (patch.itemCode) {
      const item = items.find((x) => x.code === patch.itemCode);
      if (item) next[i].unitCode = item.baseUnit.code;
    }
    setLines(next);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const cleaned = lines
      .filter((l) => l.itemCode && Number(l.qty) > 0)
      .map((l) => {
        const item = items.find((x) => x.code === l.itemCode);
        const weightNote = item?.category?.code === 'STEEL' ? l.weightNote.trim() : '';
        return {
          itemCode: l.itemCode,
          unitCode: l.unitCode || undefined,
          qty: Number(l.qty),
          unitPrice: l.unitPrice !== '' ? Number(l.unitPrice) : undefined,
          discount: l.discType ? { type: l.discType as 'percent' | 'amount', value: Number(l.discValue) || 0 } : undefined,
          weightNote: weightNote || undefined,
        };
      });
    const badQty = cleaned.find((l) => {
      const item = items.find((x) => x.code === l.itemCode);
      return item ? !isLineQtyAllowed(item, l.unitCode, l.qty) : false;
    });
    if (badQty) {
      setError(`الكمية ${badQty.qty} غير مقبولة للوحدة المختارة للصنف ${badQty.itemCode} (وحدة عددية لا تقبل كسوراً)`);
      setBusy(false);
      return;
    }
    const geoPromise = getGeo();
    try {
      const pos = await geoPromise;
      const res = await post<PriceStatement & { creditWarning: PriceStatement['creditWarning'] }>('/price-statements', {
        customerId: Number(customerId),
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
        paymentTerm: paymentTerm as 'CASH' | 'CREDIT' | 'MIXED',
        date,
        lines: cleaned,
        discount: discType ? { type: discType as 'percent' | 'amount', value: Number(discValue) || 0 } : undefined,
        shipping: Number(shipping) || 0,
        paid: Number(paid) || 0,
        taxPercent: Number(taxPercent) || 0,
        ...(pos ? { lat: pos.lat, lng: pos.lng } : {}),
        notes: notes.trim() || undefined,
      });
      const warning = res.creditWarning
        ? ` (تحذير: الرصيد المتوقع ${formatMoney(res.creditWarning.projectedBalance)} ج مقابل حد ${formatMoney(res.creditWarning.creditLimit)} ج)`
        : '';
      const freeze = res.freezeWarning ? ` [${res.freezeWarning}]` : '';
      onSaved(
        `تم إنشاء ${res.number} برقم مرجعي ${res.id}${warning}${freeze}`,
        res.pricingAlerts ?? [],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء البيان');
      setBusy(false);
    }
  }

  const previewLines = lines.map((l) => ({
    qty: Number(l.qty) || 0,
    unitPrice: Number(l.unitPrice) || 0,
    ...(l.discType && Number(l.discValue) > 0
      ? { discount: { type: l.discType as 'percent' | 'amount', value: Number(l.discValue) } }
      : {}),
  }));
  let previewSubtotal = 0;
  try {
    previewSubtotal = calcStatementTotals({ lines: previewLines }).subtotal;
  } catch {
    previewSubtotal = 0;
  }

  return (
    <Modal title="بيان أسعار جديد" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="العميل">
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">اختر عميلاً</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="المخزن">
          <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">المخزن الافتراضي</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="تاريخ البيان">
          <TextInput value={date} onChange={(e) => setDate(e.target.value)} type="date" />
        </Field>
        <Field label="شروط الدفع">
          <Select value={paymentTerm} onChange={(e) => setPaymentTerm(e.target.value)}>
            <option value="CREDIT">آجل</option>
            <option value="CASH">نقدي</option>
            <option value="MIXED">مختلط</option>
          </Select>
        </Field>
        <Field label="نوع خصم البيان">
          <Select value={discType} onChange={(e) => setDiscType(e.target.value)}>
            <option value="">بدون</option>
            <option value="percent">نسبة %</option>
            <option value="amount">قيمة ثابتة</option>
          </Select>
        </Field>
        {discType ? (
          <Field
            label="قيمة الخصم"
            hint={
              discType && Number(discValue) > 0
                ? discType === 'percent'
                  ? `القيمة المكافئة ≈ ${formatMoney(convertDiscount({ type: 'percent', value: Number(discValue) }, previewSubtotal).amount)} ج`
                  : `النسبة المكافئة ≈ ${convertDiscount({ type: 'amount', value: Number(discValue) }, previewSubtotal).percent} %`
                : undefined
            }
          >
            <TextInput value={discValue} onChange={(e) => setDiscValue(e.target.value)} type="number" min="0" step="any" />
          </Field>
        ) : null}
        <Field label="الشحن (ج)">
          <TextInput value={shipping} onChange={(e) => setShipping(e.target.value)} type="number" min="0" step="any" />
        </Field>
        <Field label="المدفوع نقداً (ج)">
          <TextInput value={paid} onChange={(e) => setPaid(e.target.value)} type="number" min="0" step="any" />
        </Field>
        <Field label="ضريبة %">
          <TextInput value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} type="number" min="0" max="100" />
        </Field>
      </div>

      <div className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-700">البنود</span>
          {lines.length < 100 ? (
            <Button variant="secondary" onClick={addLine}>
              + إضافة بند
            </Button>
          ) : null}
        </div>
        {lines.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-sm text-gray-400">
            أضف بنوداً للبيان
          </div>
        ) : (
          <div className="space-y-2">
            {lines.map((l, i) => {
              const item = items.find((x) => x.code === l.itemCode);
              return (
                <div key={i} className="rounded-lg border border-gray-200 p-2">
                  <div className="grid grid-cols-12 items-end gap-2">
                    <div className="col-span-3">
                      <Field label="الصنف">
                        <Select value={l.itemCode} onChange={(e) => updateLine(i, { itemCode: e.target.value })}>
                          <option value="">—</option>
                          {items.map((it) => (
                            <option key={it.id} value={it.code}>
                              {it.code} — {it.nameAr}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Field label="الوحدة">
                        <Select value={l.unitCode} onChange={(e) => updateLine(i, { unitCode: e.target.value })}>
                          {unitOptions(item).map((u) => (
                            <option key={u.code} value={u.code}>
                              {u.nameAr ?? u.code}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Field label="الكمية">
                        <TextInput value={l.qty} onChange={(e) => updateLine(i, { qty: e.target.value })} type="number" min="0.001" step="any" />
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Field label="السعر">
                        <TextInput value={l.unitPrice} onChange={(e) => updateLine(i, { unitPrice: e.target.value })} type="number" min="0" step="any" placeholder="تلقائي" />
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Field label="الخصم">
                        <Select value={l.discType} onChange={(e) => updateLine(i, { discType: e.target.value })}>
                          <option value="">بدون</option>
                          <option value="percent">%</option>
                          <option value="amount">ج</option>
                        </Select>
                      </Field>
                    </div>
                    {l.discType ? (
                      <div className="col-span-1">
                        <Field
                          label="القيمة"
                          hint={
                            Number(l.discValue) > 0 &&
                            (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) > 0
                              ? l.discType === 'percent'
                                ? `≈ ${formatMoney(convertDiscount({ type: 'percent', value: Number(l.discValue) }, (Number(l.qty) || 0) * (Number(l.unitPrice) || 0)).amount)} ج`
                                : `≈ ${convertDiscount({ type: 'amount', value: Number(l.discValue) }, (Number(l.qty) || 0) * (Number(l.unitPrice) || 0)).percent} %`
                              : undefined
                          }
                        >
                          <TextInput value={l.discValue} onChange={(e) => updateLine(i, { discValue: e.target.value })} type="number" min="0" step="any" />
                        </Field>
                      </div>
                    ) : null}
                    <div className="col-span-1 flex justify-end">
                      <Button variant="danger" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                        ×
                      </Button>
                    </div>
                  </div>
                  {item?.category?.code === 'STEEL' ? (
                    <div className="mt-2">
                      <Field label="ملاحظة الوزن الفعلي (الحديد §5.2)">
                        <TextInput
                          value={l.weightNote}
                          onChange={(e) => updateLine(i, { weightNote: e.target.value })}
                          placeholder="مثال: النظري 1000كج — الفعلي 985كج"
                        />
                      </Field>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Field label="ملاحظات">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>

      {error ? (
        <div className="mb-3">
          <ErrorBox message={error} />
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          إلغاء
        </Button>
        <Button onClick={submit} disabled={busy || !customerId || cleanedCount(lines) === 0}>
          {busy ? 'جارِ الحفظ…' : 'حفظ البيان'}
        </Button>
      </div>
    </Modal>
  );
}

function cleanedCount(lines: LineRow[]): number {
  return lines.filter((l) => l.itemCode && Number(l.qty) > 0).length;
}

function StatementDetailModal({ statement, onClose }: { statement: PriceStatement; onClose: () => void }) {
  const [data, setData] = useState<PriceStatement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<PriceStatement>(`/price-statements/${statement.id}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل التفاصيل');
      });
    return () => {
      cancelled = true;
    };
  }, [statement.id]);

  const s = data ?? statement;

  return (
    <Modal title={`${s.number} — ${s.customer.nameAr}`} onClose={onClose}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge color={statusColor[s.status]}>{statusLabel[s.status]}</Badge>
        <span className="text-gray-500">{formatDate(s.date)}</span>
        <span className="text-gray-500">دفع: {s.paymentTerm}</span>
        {s.dueDate ? <span className="text-gray-500">يستحق: {formatDate(s.dueDate)}</span> : null}
        {s.overdue ? <Badge color="red">متأخر السداد</Badge> : null}
        <span className="text-gray-500">المخزن: {s.warehouse.nameAr}</span>
      </div>

      {s.isStaleDraft ? (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          هذه مسودة مضى عليها {s.ageDays} يوم دون اعتماد — تحقق من الأسعار قبل الاعتماد.
        </div>
      ) : null}

      {error ? (
        <div className="mb-3">
          <ErrorBox message={error} />
        </div>
      ) : null}

      {data ? (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <Th>الصنف</Th>
                <Th>الوحدة</Th>
                <Th>الكمية</Th>
                <Th>سعر الوحدة</Th>
                <Th>الخصم</Th>
                <Th>الصافي</Th>
              </tr>
            </thead>
            <tbody>
              {s.lines.map((l) => (
                <tr key={l.id} className="border-b border-gray-100 last:border-0">
                  <Td>
                    <div className="font-semibold">{l.item.nameAr}</div>
                    <div className="text-xs text-gray-400">{l.item.code}</div>
                    {l.weightNote ? (
                      <div className="text-xs text-amber-700">وزن فعلي: {l.weightNote}</div>
                    ) : null}
                  </Td>
                  <Td>{l.unit.nameAr ?? l.unit.code}</Td>
                  <Td>{formatMoney(l.qty)} {l.unit.code}</Td>
                  <Td>{formatMoney(l.unitPrice)}</Td>
                  <Td>
                    {l.lineDiscountAmount !== '0' ? (
                      <span>
                        {formatMoney(l.lineDiscountAmount)}
                        {l.lineDiscountType ? ` (${l.lineDiscountType})` : ''}
                      </span>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td className="font-bold">{formatMoney(l.netLine)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="text-gray-500">الإجمالي (قبل الخصم):</div>
        <div className="text-end font-semibold">{formatMoney(s.subtotal)}</div>
        <div className="text-gray-500">خصم البيان:</div>
        <div className="text-end font-semibold">{formatMoney(s.discountAmount)}</div>
        <div className="text-gray-500">الشحن:</div>
        <div className="text-end font-semibold">{formatMoney(s.shipping)}</div>
        <div className="text-gray-500">الضريبة:</div>
        <div className="text-end font-semibold">{formatMoney(s.taxAmount)}</div>
        <div className="text-gray-500">الصافي:</div>
        <div className="text-end text-base font-black text-blue-700">{formatMoney(s.net)}</div>
        {Number(s.paid) > 0 ? (
          <>
            <div className="text-gray-500">المدفوع:</div>
            <div className="text-end font-semibold">{formatMoney(s.paid)}</div>
          </>
        ) : null}
      </div>

      {s.creditWarning ? (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          تحذير ائتماني: الرصيد المتوقع {formatMoney(s.creditWarning.projectedBalance)} ج مقابل حد {formatMoney(s.creditWarning.creditLimit)} ج
        </div>
      ) : null}

      {s.approvals && s.approvals.length > 0 ? (
        <div className="mt-3">
          <div className="mb-1 text-sm font-bold text-gray-700">الموافقات</div>
          {s.approvals.map((a) => (
            <div key={a.id} className="mb-1 rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
              {a.type} • {a.status} • بواسطة {a.requestedBy?.name ?? '—'}
              {a.decidedBy ? ` • قرر: ${a.decidedBy.name}` : ''}
            </div>
          ))}
        </div>
      ) : null}

      {s.notes ? <div className="mt-3 text-xs text-gray-500">ملاحظات: {s.notes}</div> : null}

      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          إغلاق
        </Button>
      </div>
    </Modal>
  );
}

function CancelStatementModal({
  statement,
  onClose,
  onDone,
}: {
  statement: PriceStatement;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await delBody(`/price-statements/${statement.id}/cancel`, { reason });
      onDone(`تم إلغاء ${statement.number}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الإلغاء');
      setBusy(false);
    }
  }

  return (
    <Modal title={`إلغاء ${statement.number}`} onClose={onClose}>
      <div className="mb-3 text-sm text-gray-600">
        سيتم عكس أثر المخزون وسجل المحاسبة عند الإلغاء.
      </div>
      <Field label="سبب الإلغاء (إلزامي)">
        <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: خطأ في البيانات" />
      </Field>
      {error ? (
        <div className="mb-3">
          <ErrorBox message={error} />
        </div>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          تراجع
        </Button>
        <Button onClick={submit} disabled={busy || !reason.trim()}>
          {busy ? 'جارِ الإلغاء…' : 'تأكيد الإلغاء'}
        </Button>
      </div>
    </Modal>
  );
}

type LineRow = {
  itemCode: string;
  unitCode: string;
  qty: string;
  unitPrice: string;
  discType: string;
  discValue: string;
  weightNote: string;
};

function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function getGeo(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 },
    );
  });
}