'use client';

import { useEffect, useState } from 'react';
import {
  can,
  get,
  post,
  qs,
  type Item,
  type ItemsPage,
  type PurchaseLine,
  type PurchaseStatementDoc,
  type PurchasesPage,
  type Supplier,
  type SuppliersPage,
  type Warehouse,
} from '@/lib/api';
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

function unitOptions(item: Item | undefined) {
  if (!item) return [] as { code: string; nameAr: string | null }[];
  const opts = [item.baseUnit, ...item.itemUnits.map((iu) => iu.unit)];
  return opts.filter((u, i, arr) => arr.findIndex((x) => x.code === u.code) === i);
}

export default function PurchasesPage() {
  const { user } = useAuth();
  const canCreate = can(user, 'statement.create');

  const [rows, setRows] = useState<PurchaseStatementDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewRow, setViewRow] = useState<PurchaseStatementDoc | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<PurchasesPage>(`/purchases${qs({ limit: 50 })}`)
      .then((d) => {
        if (!cancelled) {
          setRows(d.items);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل بيانات التوريد');
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
      <PageHeader
        title="بيانات التوريد"
        action={canCreate ? <Button onClick={() => setCreateOpen(true)}>+ بيان توريد جديد</Button> : undefined}
      />

      {notice ? (
        <div className="mb-3">
          <Notice type="success">{notice}</Notice>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setRefresh((s) => s + 1)}>
          تحديث
        </Button>
        <span className="text-sm text-gray-500">{rows.length} بيان توريد</span>
      </div>

      {error ? <ErrorBox message={error} onRetry={() => setRefresh((s) => s + 1)} /> : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الرقم</Th>
              <Th>التاريخ</Th>
              <Th>المورد</Th>
              <Th>الصافي</Th>
              <Th>المدفوع</Th>
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
                <Td className="py-6 text-center text-gray-400">لا توجد بيانات توريد</Td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-mono font-semibold">{p.number}</Td>
                  <Td>{formatDate(p.date)}</Td>
                  <Td>
                    <div className="font-semibold">{p.supplier.nameAr}</div>
                    <div className="text-xs text-gray-400">{p.supplier.code}</div>
                  </Td>
                  <Td className="font-bold">{formatMoney(p.net)}</Td>
                  <Td>{Number(p.paid) > 0 ? formatMoney(p.paid) : '—'}</Td>
                  <Td>
                    <Badge color="green">معتمد</Badge>
                  </Td>
                  <Td>
                    <Button variant="ghost" onClick={() => setViewRow(p)}>
                      عرض
                    </Button>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {createOpen ? (
        <CreatePurchaseModal
          onClose={() => setCreateOpen(false)}
          onSaved={(msg) => {
            setCreateOpen(false);
            setNotice(msg);
            setRefresh((x) => x + 1);
          }}
        />
      ) : null}

      {viewRow ? <PurchaseDetailModal p={viewRow} onClose={() => setViewRow(null)} /> : null}
    </div>
  );
}

function CreatePurchaseModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [discType, setDiscType] = useState('');
  const [discValue, setDiscValue] = useState('');
  const [shipping, setShipping] = useState('0');
  const [taxPercent, setTaxPercent] = useState('0');
  const [paid, setPaid] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<PurchaseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      get<SuppliersPage>(`/suppliers${qs({ limit: 200 })}`),
      get<{ warehouses: Warehouse[] }>('/warehouses'),
      get<ItemsPage>(`/items${qs({ limit: 200 })}`),
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

  function addLine() {
    setLines([
      ...lines,
      { itemCode: '', unitCode: '', qty: '1', unitPrice: '', discType: '', discValue: '', batchId: '', expiry: '' },
    ]);
  }

  function updateLine(i: number, patch: Partial<PurchaseRow>) {
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
        const batchId = item?.trackBatch ? l.batchId.trim() : '';
        return {
          itemCode: l.itemCode,
          unitCode: l.unitCode || undefined,
          qty: Number(l.qty),
          unitPrice: Number(l.unitPrice) || 0,
          discount: l.discType ? { type: l.discType as 'percent' | 'amount', value: Number(l.discValue) || 0 } : undefined,
          batchId: batchId || undefined,
          expiry: batchId && l.expiry ? l.expiry : undefined,
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
    try {
      const res = await post<PurchaseStatementDoc>('/purchases', {
        supplierId: Number(supplierId),
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
        date,
        lines: cleaned,
        discount: discType ? { type: discType as 'percent' | 'amount', value: Number(discValue) || 0 } : undefined,
        shipping: Number(shipping) || 0,
        taxPercent: Number(taxPercent) || 0,
        paid: Number(paid) || 0,
        paymentMethod: (paymentMethod as 'CASH' | 'TRANSFER' | 'CHEQUE' | 'WALLET') || 'CASH',
        notes: notes.trim() || undefined,
      });
      onSaved(`تم إنشاء بيان توريد ${res.number}${Number(res.paid) > 0 ? ` وسند صرف ${res.paid}` : ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء بيان التوريد');
      setBusy(false);
    }
  }

  return (
    <Modal title="بيان توريد جديد" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
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
            <option value="">المخزن الافتراضي</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="التاريخ">
          <TextInput value={date} onChange={(e) => setDate(e.target.value)} type="date" />
        </Field>
        <Field label="نوع خصم البيان">
          <Select value={discType} onChange={(e) => setDiscType(e.target.value)}>
            <option value="">بدون</option>
            <option value="percent">نسبة %</option>
            <option value="amount">قيمة ثابتة</option>
          </Select>
        </Field>
        {discType ? (
          <Field label="قيمة الخصم">
            <TextInput value={discValue} onChange={(e) => setDiscValue(e.target.value)} type="number" min="0" step="any" />
          </Field>
        ) : null}
        <Field label="الشحن (ج)">
          <TextInput value={shipping} onChange={(e) => setShipping(e.target.value)} type="number" min="0" step="any" />
        </Field>
        <Field label="ضريبة %">
          <TextInput value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} type="number" min="0" max="100" />
        </Field>
        <Field label="المدفوع (ج)">
          <TextInput value={paid} onChange={(e) => setPaid(e.target.value)} type="number" min="0" step="any" />
        </Field>
        <Field label="طريقة الدفع">
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="CASH">نقدي</option>
            <option value="TRANSFER">تحويل</option>
            <option value="CHEQUE">شيك</option>
            <option value="WALLET">محفظة</option>
          </Select>
        </Field>
      </div>

      <div className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-700">البنود</span>
          <Button variant="secondary" onClick={addLine}>
            + إضافة بند
          </Button>
        </div>
        {lines.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-sm text-gray-400">
            أضف بنود التوريد
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
                        <TextInput value={l.unitPrice} onChange={(e) => updateLine(i, { unitPrice: e.target.value })} type="number" min="0" step="any" />
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
                        <Field label="القيمة">
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
                  {item?.trackBatch ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Field label="كود الدفعة (batch)">
                        <TextInput
                          value={l.batchId}
                          onChange={(e) => updateLine(i, { batchId: e.target.value })}
                          placeholder="اختياري — اتركه فارغاً لدفعة بلا كود"
                        />
                      </Field>
                      <Field label="تاريخ انتهاء الصلاحية">
                        <TextInput value={l.expiry} onChange={(e) => updateLine(i, { expiry: e.target.value })} type="date" />
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
        <Button onClick={submit} disabled={busy || !supplierId || checkedLines(lines) === 0}>
          {busy ? 'جارِ الحفظ…' : 'حفظ بيان التوريد'}
        </Button>
      </div>
    </Modal>
  );
}

function checkedLines(lines: PurchaseRow[]): number {
  return lines.filter((l) => l.itemCode && Number(l.qty) > 0).length;
}

function PurchaseDetailModal({ p, onClose }: { p: PurchaseStatementDoc; onClose: () => void }) {
  const [data, setData] = useState<PurchaseStatementDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<PurchaseStatementDoc>(`/purchases/${p.id}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل التفاصيل');
      });
    return () => {
      cancelled = true;
    };
  }, [p.id]);

  const doc = data ?? p;
  const lines: PurchaseLine[] = data?.lines ?? [];

  return (
    <Modal title={`${doc.number} — ${doc.supplier.nameAr}`} onClose={onClose}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge color="green">معتمد</Badge>
        <span className="text-gray-500">{formatDate(doc.date)}</span>
        <span className="text-gray-500">المخزن: {doc.warehouse.nameAr}</span>
      </div>

      {error ? (
        <div className="mb-3">
          <ErrorBox message={error} />
        </div>
      ) : null}

      {lines.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <Th>الصنف</Th>
                <Th>الوحدة</Th>
                <Th>الكمية</Th>
                <Th>السعر</Th>
                <Th>الخصم</Th>
                <Th>الصافي</Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-b border-gray-100 last:border-0">
                  <Td>
                    <div className="font-semibold">{l.item.nameAr}</div>
                    <div className="text-xs text-gray-400">{l.item.code}</div>
                    {l.batchId ? <div className="text-xs text-gray-400">دفعة: {l.batchId}</div> : null}
                  </Td>
                  <Td>{l.unit.nameAr ?? l.unit.code}</Td>
                  <Td>{formatMoney(l.qty)} {l.unit.code}</Td>
                  <Td>{formatMoney(l.unitPrice)}</Td>
                  <Td>{l.lineDiscountAmount !== '0' ? formatMoney(l.lineDiscountAmount) : '—'}</Td>
                  <Td className="font-bold">{formatMoney(l.netLine)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="text-gray-500">الإجمالي:</div>
        <div className="text-end font-semibold">{formatMoney(doc.subtotal)}</div>
        <div className="text-gray-500">خصم البيان:</div>
        <div className="text-end font-semibold">{formatMoney(doc.discountAmount)}</div>
        <div className="text-gray-500">الشحن:</div>
        <div className="text-end font-semibold">{formatMoney(doc.shipping)}</div>
        <div className="text-gray-500">الصافي:</div>
        <div className="text-end text-base font-black text-blue-700">{formatMoney(doc.net)}</div>
        {Number(doc.paid) > 0 ? (
          <>
            <div className="text-gray-500">المدفوع:</div>
            <div className="text-end font-semibold">{formatMoney(doc.paid)}</div>
          </>
        ) : null}
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

type PurchaseRow = {
  itemCode: string;
  unitCode: string;
  qty: string;
  unitPrice: string;
  discType: string;
  discValue: string;
  batchId: string;
  expiry: string;
};

function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}