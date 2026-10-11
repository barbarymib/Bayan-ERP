'use client';

import { useEffect, useState } from 'react';
import {
  can,
  get,
  post,
  qs,
  type Item,
  type ItemsPage,
  type Supplier,
  type SupplierReturnDoc,
  type SupplierReturnsPage,
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

export default function SupplierReturnsPage() {
  const { user } = useAuth();
  const canView = can(user, 'supplier_return.view');
  const canCreate = can(user, 'supplier_return.create');

  const [rows, setRows] = useState<SupplierReturnDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewRow, setViewRow] = useState<SupplierReturnDoc | null>(null);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    get<SupplierReturnsPage>(`/supplier-returns${qs({ limit: 50 })}`)
      .then((d) => {
        if (!cancelled) {
          setRows(d.items);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل مرتجعات المشتريات');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, canView]);

  if (!canView) {
    return (
      <div>
        <PageHeader title="مرتجعات المشتريات" />
        <ErrorBox message="ليست لديك صلاحية عرض مرتجعات المشتريات" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="مرتجعات المشتريات"
        action={canCreate ? <Button onClick={() => setCreateOpen(true)}>+ مرتجع مشتريات</Button> : undefined}
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
              <Th>المخزن</Th>
              <Th>الإجمالي</Th>
              <Th>البنود</Th>
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
                <Td className="py-6 text-center text-gray-400">لا توجد مرتجعات مشتريات</Td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-mono font-semibold">{r.number}</Td>
                  <Td>{formatDate(r.date)}</Td>
                  <Td className="font-semibold">{r.supplier.nameAr}</Td>
                  <Td>{r.warehouse.nameAr}</Td>
                  <Td className="font-bold text-red-700">{formatMoney(r.total)}</Td>
                  <Td>{r._count.lines}</Td>
                  <Td>
                    <Button variant="ghost" onClick={() => setViewRow(r)}>
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
        <CreateReturnModal
          onClose={() => setCreateOpen(false)}
          onSaved={(num) => {
            setCreateOpen(false);
            setNotice(`تم إنشاء المرتجع ${num}`);
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}
      {viewRow ? <ReturnDetailModal ret={viewRow} onClose={() => setViewRow(null)} /> : null}
    </div>
  );
}

type LineRow = { itemId: string; unitId: string; qty: string; unitPrice: string };

function CreateReturnModal({ onClose, onSaved }: { onClose: () => void; onSaved: (num: string) => void }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [date, setDate] = useState(today());
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineRow[]>([{ itemId: '', unitId: '', qty: '1', unitPrice: '' }]);
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
      }));
    try {
      const res = await post<SupplierReturnDoc>('/supplier-returns', {
        supplierId: Number(supplierId),
        warehouseId: Number(warehouseId),
        date,
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
        lines: cleaned,
      });
      onSaved(res.number);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء المرتجع');
      setBusy(false);
    }
  }

  return (
    <Modal title="مرتجع مشتريات جديد" onClose={onClose}>
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
            <option value="">اختر مخزناً</option>
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
        <Field label="السبب">
          <TextInput value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>

      <div className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-700">البنود</span>
          <Button variant="secondary" onClick={() => setLines([...lines, { itemId: '', unitId: '', qty: '1', unitPrice: '' }])}>
            + إضافة بند
          </Button>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-gray-200 p-2">
              <div className="col-span-5">
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
              <div className="col-span-1 flex justify-end">
                <Button variant="danger" onClick={() => setLines(lines.filter((_, j) => j !== i))} disabled={lines.length === 1}>
                  ×
                </Button>
              </div>
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
        <Button onClick={submit} disabled={busy || !supplierId || !warehouseId || lines.every((l) => !l.itemId)}>
          {busy ? 'جارِ الحفظ…' : 'حفظ المرتجع'}
        </Button>
      </div>
    </Modal>
  );
}

function ReturnDetailModal({ ret, onClose }: { ret: SupplierReturnDoc; onClose: () => void }) {
  const [data, setData] = useState<SupplierReturnDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<SupplierReturnDoc>(`/supplier-returns/${ret.id}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل التفاصيل');
      });
    return () => {
      cancelled = true;
    };
  }, [ret.id]);

  const doc = data ?? ret;
  const lines = data?.lines ?? [];

  return (
    <Modal title={`${doc.number} — ${doc.supplier.nameAr}`} onClose={onClose}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-gray-500">
        <Badge color="red">مرتجع</Badge>
        <span>{formatDate(doc.date)}</span>
        <span>المخزن: {doc.warehouse.nameAr}</span>
        {doc.reason ? <span>السبب: {doc.reason}</span> : null}
      </div>
      {error ? <ErrorBox message={error} /> : null}
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full min-w-max">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <Th>الصنف</Th>
              <Th>الكمية</Th>
              <Th>السعر</Th>
              <Th>الإجمالي</Th>
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
                <Td className="font-bold">{formatMoney(l.lineTotal ?? '0')}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-end text-base font-black text-red-700">{formatMoney(doc.total)}</div>
      {doc.notes ? <div className="mt-2 text-xs text-gray-500">ملاحظات: {doc.notes}</div> : null}
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          إغلاق
        </Button>
      </div>
    </Modal>
  );
}
