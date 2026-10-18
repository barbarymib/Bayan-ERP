'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  can,
  get,
  post,
  qs,
  type Item,
  type ItemsPage,
  type PurchaseOrder,
  type PurchaseOrdersPage,
  type Supplier,
  type SuppliersPage,
  type Warehouse,
} from '@/lib/api';
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
  today,
} from '@/components/ui';

const STATUS_LABEL: Record<PurchaseOrder['status'], { text: string; color: string }> = {
  DRAFT: { text: 'مسودة', color: 'gray' },
  APPROVED: { text: 'معتمد', color: 'blue' },
  RECEIVED: { text: 'مستلم', color: 'green' },
  CANCELLED: { text: 'ملغى', color: 'red' },
  CLOSED: { text: 'مغلق', color: 'gray' },
};

export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const canView = can(user, 'purchase_order.view');
  const canCreate = can(user, 'purchase_order.create');
  const canApprove = can(user, 'purchase_order.approve');

  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewRow, setViewRow] = useState<PurchaseOrder | null>(null);
  const [receiveRow, setReceiveRow] = useState<PurchaseOrder | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    get<PurchaseOrdersPage>(`/purchase-orders${qs({ limit: 50 })}`)
      .then((d) => {
        if (!cancelled) {
          setRows(d.items);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل أوامر الشراء');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, canView]);

  async function approve(o: PurchaseOrder) {
    setBusyId(o.id);
    try {
      await post(`/purchase-orders/${o.id}/approve`, {});
      setNotice(`تم اعتماد أمر الشراء ${o.number}`);
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الاعتماد');
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(o: PurchaseOrder) {
    const reason = window.prompt('سبب الإلغاء (إلزامي):') ?? '';
    if (!reason.trim()) return;
    setBusyId(o.id);
    try {
      await post(`/purchase-orders/${o.id}/cancel`, { reason: reason.trim() });
      setNotice(`تم إلغاء أمر الشراء ${o.number}`);
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الإلغاء');
    } finally {
      setBusyId(null);
    }
  }

  if (!canView) {
    return (
      <div>
        <PageHeader title="أوامر الشراء" />
        <ErrorBox message="ليست لديك صلاحية عرض أوامر الشراء" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="أوامر الشراء"
        action={canCreate ? <Button onClick={() => setCreateOpen(true)}>+ أمر شراء</Button> : undefined}
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
              <Th>الرقم</Th>
              <Th>التاريخ</Th>
              <Th>المورد</Th>
              <Th>الصافي</Th>
              <Th>البنود</Th>
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
                <Td className="py-6 text-center text-gray-400">لا توجد أوامر شراء</Td>
              </tr>
            ) : (
              rows.map((o) => {
                const st = STATUS_LABEL[o.status];
                return (
                  <tr key={o.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <Td className="font-mono font-semibold">{o.number}</Td>
                    <Td>{formatDate(o.date)}</Td>
                    <Td>
                      <div className="font-semibold">{o.supplier.nameAr}</div>
                      <div className="text-xs text-gray-400">{o.supplier.code}</div>
                    </Td>
                    <Td className="font-bold">{formatMoney(o.net)}</Td>
                    <Td>{o._count.lines}</Td>
                    <Td>
                      <Badge color={st.color}>{st.text}</Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <Button variant="ghost" onClick={() => setViewRow(o)}>
                          عرض
                        </Button>
                        <Link
                          href={`/purchase-orders/${o.id}/print`}
                          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                        >
                          طباعة
                        </Link>
                        {canApprove && o.status === 'DRAFT' ? (
                          <Button variant="primary" disabled={busyId === o.id} onClick={() => approve(o)}>
                            اعتماد
                          </Button>
                        ) : null}
                        {canApprove && o.status === 'APPROVED' ? (
                          <Button variant="primary" onClick={() => setReceiveRow(o)}>
                            استلام
                          </Button>
                        ) : null}
                        {canApprove && (o.status === 'DRAFT' || o.status === 'APPROVED') ? (
                          <Button variant="danger" disabled={busyId === o.id} onClick={() => cancel(o)}>
                            إلغاء
                          </Button>
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
        <CreateOrderModal
          onClose={() => setCreateOpen(false)}
          onSaved={(num) => {
            setCreateOpen(false);
            setNotice(`تم إنشاء أمر الشراء ${num}`);
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}
      {viewRow ? <OrderDetailModal order={viewRow} onClose={() => setViewRow(null)} /> : null}
      {receiveRow ? (
        <ReceiveModal
          order={receiveRow}
          onClose={() => setReceiveRow(null)}
          onSaved={(num) => {
            setReceiveRow(null);
            setNotice(`تم استلام أمر الشراء ${num} وإنشاء بيان التوريد`);
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}
    </div>
  );
}

type LineRow = { itemId: string; unitId: string; qty: string; unitPrice: string; discType: string; discValue: string };

function CreateOrderModal({ onClose, onSaved }: { onClose: () => void; onSaved: (num: string) => void }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineRow[]>([{ itemId: '', unitId: '', qty: '1', unitPrice: '', discType: '', discValue: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      get<SuppliersPage>(`/suppliers${qs({ limit: 200 })}`),
      get<{ warehouses: Warehouse[] }>('/warehouses'),
      get<ItemsPage>(`/items${qs({ limit: 500 })}`),
    ])
      .then(([s, w, it]) => {
        if (!cancelled) {
          setSuppliers(s.suppliers);
          setWarehouses(w.warehouses);
          setItems(it.items);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function itemUnitOptions(itemId: string) {
    const item = items.find((x) => String(x.id) === itemId);
    if (!item) return [] as { id: number; label: string }[];
    const opts = [{ id: item.baseUnit.id, label: item.baseUnit.nameAr ?? item.baseUnit.code }, ...item.itemUnits.map((iu) => ({ id: iu.unit.id, label: iu.unit.nameAr ?? iu.unit.code }))];
    return opts.filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i);
  }

  function updateLine(i: number, patch: Partial<LineRow>) {
    setLines((prev) =>
      prev.map((l, j) => {
        if (j !== i) return l;
        const next = { ...l, ...patch };
        if (patch.itemId) {
          const item = items.find((x) => String(x.id) === patch.itemId);
          if (item) next.unitId = String(item.baseUnit.id);
        }
        return next;
      }),
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const cleaned = lines
      .filter((l) => l.itemId && Number(l.qty) > 0)
      .map((l) => ({
        itemId: Number(l.itemId),
        unitId: l.unitId ? Number(l.unitId) : undefined,
        qty: Number(l.qty),
        unitPrice: Number(l.unitPrice) || 0,
        discount: l.discType ? { type: l.discType as 'percent' | 'amount', value: Number(l.discValue) || 0 } : undefined,
      }));
    try {
      const res = await post<PurchaseOrder>('/purchase-orders', {
        supplierId: Number(supplierId),
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
        expectedDate: expectedDate || undefined,
        notes: notes.trim() || undefined,
        lines: cleaned,
      });
      onSaved(res.number);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء أمر الشراء');
      setBusy(false);
    }
  }

  return (
    <Modal title="أمر شراء جديد" onClose={onClose}>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Field label="المورد">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">اختر مورداً</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="المخزن">
          <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">الافتراضي</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="تاريخ متوقع">
          <TextInput type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
        </Field>
      </div>

      <div className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-700">البنود</span>
          <Button variant="secondary" onClick={() => setLines([...lines, { itemId: '', unitId: '', qty: '1', unitPrice: '', discType: '', discValue: '' }])}>
            + إضافة بند
          </Button>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-gray-200 p-2">
              <div className="col-span-3">
                <Field label="الصنف">
                  <Select value={l.itemId} onChange={(e) => updateLine(i, { itemId: e.target.value })}>
                    <option value="">—</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.code} — {it.nameAr}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="الوحدة">
                  <Select value={l.unitId} onChange={(e) => updateLine(i, { unitId: e.target.value })}>
                    {itemUnitOptions(l.itemId).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="الكمية">
                  <TextInput type="number" min="0.001" step="any" value={l.qty} onChange={(e) => updateLine(i, { qty: e.target.value })} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="السعر">
                  <TextInput type="number" min="0" step="any" value={l.unitPrice} onChange={(e) => updateLine(i, { unitPrice: e.target.value })} />
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
              <div className="col-span-1 flex justify-end">
                <Button variant="danger" onClick={() => setLines(lines.filter((_, j) => j !== i))} disabled={lines.length === 1}>
                  ×
                </Button>
              </div>
              {l.discType ? (
                <div className="col-span-2">
                  <Field label="قيمة الخصم">
                    <TextInput type="number" min="0" step="any" value={l.discValue} onChange={(e) => updateLine(i, { discValue: e.target.value })} />
                  </Field>
                </div>
              ) : null}
            </div>
          ))}
        </div>
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
        <Button onClick={submit} disabled={busy || !supplierId || lines.every((l) => !l.itemId)}>
          {busy ? 'جارِ الحفظ…' : 'حفظ الأمر'}
        </Button>
      </div>
    </Modal>
  );
}

function OrderDetailModal({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
  const [data, setData] = useState<PurchaseOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<PurchaseOrder>(`/purchase-orders/${order.id}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل التفاصيل');
      });
    return () => {
      cancelled = true;
    };
  }, [order.id]);

  const doc = data ?? order;
  const lines = data?.lines ?? [];
  const st = STATUS_LABEL[doc.status];

  return (
    <Modal title={`${doc.number} — ${doc.supplier.nameAr}`} onClose={onClose}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-gray-500">
        <Badge color={st.color}>{st.text}</Badge>
        <span>{formatDate(doc.date)}</span>
        {doc.expectedDate ? <span>متوقع: {formatDate(doc.expectedDate)}</span> : null}
        {doc.warehouse ? <span>المخزن: {doc.warehouse.nameAr}</span> : null}
      </div>
      {error ? <ErrorBox message={error} /> : null}
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full min-w-max">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <Th>الصنف</Th>
              <Th>الكمية</Th>
              <Th>السعر</Th>
              <Th>الصافي</Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-gray-100 last:border-0">
                <Td>
                  <div className="font-semibold">{l.item?.nameAr}</div>
                  <div className="text-xs text-gray-400">{l.item?.code}</div>
                </Td>
                <Td>
                  {formatMoney(l.qty)} {l.unit?.code}
                </Td>
                <Td>{formatMoney(l.unitPrice)}</Td>
                <Td className="font-bold">{formatMoney(l.netLine ?? '0')}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="text-gray-500">الإجمالي:</div>
        <div className="text-end font-semibold">{formatMoney(doc.subtotal)}</div>
        <div className="text-gray-500">الخصم:</div>
        <div className="text-end font-semibold">{formatMoney(doc.discountAmount)}</div>
        <div className="text-gray-500">الصافي:</div>
        <div className="text-end text-base font-black text-blue-700">{formatMoney(doc.net)}</div>
      </div>
      {doc.notes ? <div className="mt-3 text-xs text-gray-500">ملاحظات: {doc.notes}</div> : null}
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          إغلاق
        </Button>
      </div>
    </Modal>
  );
}

function ReceiveModal({ order, onClose, onSaved }: { order: PurchaseOrder; onClose: () => void; onSaved: (num: string) => void }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState(order.warehouse ? String(order.warehouse.id) : '');
  const [date, setDate] = useState(today());
  const [paid, setPaid] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [shipping, setShipping] = useState('0');
  const [taxPercent, setTaxPercent] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    get<{ warehouses: Warehouse[] }>('/warehouses')
      .then((w) => {
        if (!cancelled) setWarehouses(w.warehouses);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await post(`/purchase-orders/${order.id}/receive`, {
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
        date,
        paid: Number(paid) || 0,
        paymentMethod,
        shipping: Number(shipping) || 0,
        taxPercent: Number(taxPercent) || 0,
      });
      onSaved(order.number);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل استلام الأمر');
      setBusy(false);
    }
  }

  return (
    <Modal title={`استلام أمر الشراء ${order.number}`} onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="المخزن">
          <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">الافتراضي</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="التاريخ">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="المدفوع">
          <TextInput type="number" min="0" step="any" value={paid} onChange={(e) => setPaid(e.target.value)} />
        </Field>
        <Field label="طريقة الدفع">
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="CASH">نقدي</option>
            <option value="TRANSFER">تحويل</option>
            <option value="CHEQUE">شيك</option>
            <option value="WALLET">محفظة</option>
          </Select>
        </Field>
        <Field label="الشحن (landed)">
          <TextInput type="number" min="0" step="any" value={shipping} onChange={(e) => setShipping(e.target.value)} />
        </Field>
        <Field label="ضريبة %">
          <TextInput type="number" min="0" max="100" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
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
          {busy ? 'جارِ الاستلام…' : 'تأكيد الاستلام'}
        </Button>
      </div>
    </Modal>
  );
}
