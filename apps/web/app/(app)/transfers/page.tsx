'use client';

import { useEffect, useState } from 'react';
import {
  can,
  get,
  post,
  qs,
  type Item,
  type ItemsPage,
  type StockTransfer,
  type TransfersPage,
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
} from '@/components/ui';

export default function TransfersPage() {
  const { user } = useAuth();
  const canView = can(user, 'transfer.view');
  const canCreate = can(user, 'transfer.execute');

  const [rows, setRows] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewRow, setViewRow] = useState<StockTransfer | null>(null);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    get<TransfersPage>(`/transfers${qs({ limit: 50 })}`)
      .then((d) => {
        if (!cancelled) {
          setRows(d.items);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل التحويلات');
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
        <PageHeader title="التحويلات المخزنية" />
        <ErrorBox message="ليست لديك صلاحية عرض التحويلات" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="التحويلات المخزنية"
        action={canCreate ? <Button onClick={() => setCreateOpen(true)}>+ تحويل جديد</Button> : undefined}
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
              <Th>من</Th>
              <Th>إلى</Th>
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
                <Td className="py-6 text-center text-gray-400">لا توجد تحويلات</Td>
              </tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-mono font-semibold">{t.number}</Td>
                  <Td>{formatDate(t.date)}</Td>
                  <Td>{t.fromWarehouse.nameAr}</Td>
                  <Td>{t.toWarehouse.nameAr}</Td>
                  <Td>{t._count.lines}</Td>
                  <Td>
                    <Badge color={t.status === 'COMPLETED' ? 'green' : t.status === 'CANCELLED' ? 'red' : 'gray'}>
                      {t.status}
                    </Badge>
                  </Td>
                  <Td>
                    <Button variant="ghost" onClick={() => setViewRow(t)}>
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
        <CreateTransferModal
          onClose={() => setCreateOpen(false)}
          onSaved={(num) => {
            setCreateOpen(false);
            setNotice(`تم إنشاء التحويل ${num}`);
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}
      {viewRow ? <TransferDetailModal transfer={viewRow} onClose={() => setViewRow(null)} /> : null}
    </div>
  );
}

type LineRow = { itemId: string; batchId: string; qtyBase: string; cost: string };

function CreateTransferModal({ onClose, onSaved }: { onClose: () => void; onSaved: (num: string) => void }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineRow[]>([{ itemId: '', batchId: '', qtyBase: '1', cost: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([get<{ warehouses: Warehouse[] }>('/warehouses'), get<ItemsPage>(`/items${qs({ limit: 500 })}`)])
      .then(([w, it]) => {
        if (!cancelled) {
          setWarehouses(w.warehouses);
          setItems(it.items);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function updateLine(i: number, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const cleaned = lines
      .filter((l) => l.itemId && Number(l.qtyBase) > 0)
      .map((l) => ({
        itemId: Number(l.itemId),
        batchId: l.batchId.trim() || undefined,
        qtyBase: Number(l.qtyBase),
        cost: l.cost ? Number(l.cost) : undefined,
      }));
    try {
      const res = await post<StockTransfer>('/transfers', {
        fromWarehouseId: Number(fromId),
        toWarehouseId: Number(toId),
        notes: notes.trim() || undefined,
        lines: cleaned,
      });
      onSaved(res.number);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء التحويل');
      setBusy(false);
    }
  }

  return (
    <Modal title="تحويل مخزني جديد" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="المخزن المصدر">
          <Select value={fromId} onChange={(e) => setFromId(e.target.value)}>
            <option value="">اختر مخزناً</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="المخزن الوجهة">
          <Select value={toId} onChange={(e) => setToId(e.target.value)}>
            <option value="">اختر مخزناً</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.nameAr}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-700">البنود</span>
          <Button variant="secondary" onClick={() => setLines([...lines, { itemId: '', batchId: '', qtyBase: '1', cost: '' }])}>
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
                <Field label="التشغيلة">
                  <TextInput value={l.batchId} onChange={(e) => updateLine(i, { batchId: e.target.value })} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="الكمية (أساسي)">
                  <TextInput type="number" min="0.001" step="any" value={l.qtyBase} onChange={(e) => updateLine(i, { qtyBase: e.target.value })} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="التكلفة">
                  <TextInput type="number" min="0" step="any" value={l.cost} onChange={(e) => updateLine(i, { cost: e.target.value })} />
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
        <Button onClick={submit} disabled={busy || !fromId || !toId || fromId === toId || lines.every((l) => !l.itemId)}>
          {busy ? 'جارِ الحفظ…' : 'تنفيذ التحويل'}
        </Button>
      </div>
    </Modal>
  );
}

function TransferDetailModal({ transfer, onClose }: { transfer: StockTransfer; onClose: () => void }) {
  const [data, setData] = useState<StockTransfer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<StockTransfer>(`/transfers/${transfer.id}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل التفاصيل');
      });
    return () => {
      cancelled = true;
    };
  }, [transfer.id]);

  const doc = data ?? transfer;
  const lines = data?.lines ?? [];

  return (
    <Modal title={`${doc.number} — ${doc.fromWarehouse.nameAr} ← ${doc.toWarehouse.nameAr}`} onClose={onClose}>
      <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
        <Badge color={doc.status === 'COMPLETED' ? 'green' : 'gray'}>{doc.status}</Badge>
        <span>{formatDate(doc.date)}</span>
      </div>
      {error ? <ErrorBox message={error} /> : null}
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full min-w-max">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <Th>الصنف</Th>
              <Th>التشغيلة</Th>
              <Th>الكمية</Th>
              <Th>التكلفة</Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-gray-100 last:border-0">
                <Td>
                  <div className="font-semibold">{l.item?.nameAr}</div>
                  <div className="text-xs text-gray-400">{l.item?.code}</div>
                </Td>
                <Td>{l.batchId || '—'}</Td>
                <Td>{formatMoney(l.qtyBase)}</Td>
                <Td>{l.cost === null ? '—' : formatMoney(l.cost)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          إغلاق
        </Button>
      </div>
    </Modal>
  );
}
