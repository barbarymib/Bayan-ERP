'use client';

import { useEffect, useState } from 'react';
import {
  can,
  get,
  post,
  put,
  qs,
  type StocktakeSession,
  type StocktakesPage,
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
  Textarea,
  TextInput,
  Th,
  formatDate,
  formatMoney,
} from '@/components/ui';

const statusLabel: Record<string, string> = {
  OPEN: 'مفتوحة',
  COUNTING: 'قيد العد',
  REVIEW: 'مراجعة',
  APPROVED: 'معتمدة',
  CLOSED: 'مغلقة',
};

const statusColor: Record<string, string> = {
  OPEN: 'blue',
  COUNTING: 'gray',
  REVIEW: 'blue',
  APPROVED: 'green',
  CLOSED: 'gray',
};

export default function StocktakesPage() {
  const { user } = useAuth();
  const canView = can(user, 'stocktake.view');
  const canExecute = can(user, 'stocktake.execute');
  const canApprove = can(user, 'stocktake.approve');

  return (
    <div>
      <PageHeader title="جلسات الجرد" />
      {canView ? (
        <ListPane canExecute={canExecute} canApprove={canApprove} />
      ) : (
        <ErrorBox message="لا تملك صلاحية عرض الجرد" />
      )}
    </div>
  );
}

function ListPane({ canExecute, canApprove }: { canExecute: boolean; canApprove: boolean }) {
  const [rows, setRows] = useState<StocktakeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<StocktakesPage>(`/stocktakes${qs({ limit: 50 })}`)
      .then((d) => {
        if (!cancelled) {
          setRows(d.items);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل جلسات الجرد');
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
      {notice ? (
        <div className="mb-3">
          <Notice type="success">{notice}</Notice>
        </div>
      ) : null}
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}
      <div className="mb-3 flex items-center gap-2">
        <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
          تحديث
        </Button>
        {canExecute ? <Button onClick={() => setOpen(true)}>+ جلسة جرد</Button> : null}
        <span className="text-sm text-gray-500">{rows.length} جلسة</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الرقم</Th>
              <Th>الحالة</Th>
              <Th>المخزن</Th>
              <Th>المفتوح بواسطة</Th>
              <Th>تاريخ الفتح</Th>
              <Th>البنود</Th>
              <Th>فرق الكمية</Th>
              <Th>قيمة الفرق</Th>
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
                <Td className="py-6 text-center text-gray-400">لا توجد جلسات جرد</Td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-mono font-semibold">{r.number}</Td>
                  <Td>
                    <Badge color={statusColor[r.status]}>{statusLabel[r.status]}</Badge>
                  </Td>
                  <Td>{r.warehouse.nameAr}</Td>
                  <Td>{r.openedBy.name}</Td>
                  <Td>{formatDate(r.openedAt)}</Td>
                  <Td>{r._count?.lines ?? '—'}</Td>
                  <Td dir="ltr">{r.summary ? formatMoney(r.summary.totalDiffQty) : '—'}</Td>
                  <Td>{r.summary ? formatMoney(r.summary.totalDiffValue) : '—'}</Td>
                  <Td>
                    <Button variant="ghost" onClick={() => setSelected(r.id)}>
                      فتح
                    </Button>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open ? (
        <OpenModal
          onClose={() => setOpen(false)}
          onDone={(m) => {
            setOpen(false);
            setNotice(m);
            setRefresh((x) => x + 1);
          }}
        />
      ) : null}

      {selected ? (
        <DetailModal
          id={selected}
          canExecute={canExecute}
          canApprove={canApprove}
          onClose={() => setSelected(null)}
          onDone={(m) => {
            setNotice(m);
            setRefresh((x) => x + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function OpenModal({ onClose, onDone }: { onClose: () => void; onDone: (m: string) => void }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    get<{ warehouses: Warehouse[] }>('/warehouses')
      .then((d) => {
        if (!cancelled) setWarehouses(d.warehouses.filter((w) => w.active));
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
      const res = await post<StocktakeSession>('/stocktakes', { warehouseId: Number(warehouseId) });
      onDone(`تم فتح جلسة جرد ${res.number} (${res.lines?.length ?? 0} بند)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل فتح الجلسة');
      setBusy(false);
    }
  }

  return (
    <Modal title="جلسة جرد جديدة" onClose={onClose}>
      <div className="mb-4 grid grid-cols-1 gap-3">
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
        <Button onClick={submit} disabled={busy || !warehouseId}>
          {busy ? 'جارِ الفتح…' : 'فتح الجلسة'}
        </Button>
      </div>
    </Modal>
  );
}

function DetailModal({
  id,
  canExecute,
  canApprove,
  onClose,
  onDone,
}: {
  id: number;
  canExecute: boolean;
  canApprove: boolean;
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const [data, setData] = useState<StocktakeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [aborting, setAborting] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    get<StocktakeSession>(`/stocktakes/${id}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
          const next: Record<string, string> = {};
          for (const l of d.lines ?? []) {
            if (l.countedQtyBase != null) next[`${l.itemId}:${l.batchId}`] = String(l.countedQtyBase);
          }
          setDrafts(next);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل الجلسة');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, refresh]);

  async function saveCounts() {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      const counts = Object.entries(drafts)
        .map(([key, val]) => {
          const [itemId, batchId] = key.split(':');
          return { itemId: Number(itemId), batchId, qty: Number(val) };
        })
        .filter((c) => c.itemId && !Number.isNaN(c.qty));
      await put(`/stocktakes/${id}/counts`, { counts });
      setRefresh((x) => x + 1);
      onDone('تم حفظ العدّات');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ العدّات');
    } finally {
      setBusy(false);
    }
  }

  async function act(action: 'review' | 'back-to-counting' | 'approve') {
    setBusy(true);
    setError(null);
    try {
      const labels: Record<string, string> = {
        review: 'تمت المراجعة',
        'back-to-counting': 'عُدنا للعد',
        approve: 'تم اعتماد الجلسة وتطبيق تسوية الفروقات',
      };
      await post(`/stocktakes/${id}/${action}`, {});
      setRefresh((x) => x + 1);
      onDone(labels[action]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تنفيذ العملية');
    } finally {
      setBusy(false);
    }
  }

  async function confirmAbort() {
    if (!reason.trim()) {
      setError('سبب الإلغاء إلزامي');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await post(`/stocktakes/${id}/abort`, { reason: reason.trim() });
      setAborting(false);
      setRefresh((x) => x + 1);
      onDone('تم إلغاء الجلسة');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إلغاء الجلسة');
    } finally {
      setBusy(false);
    }
  }

  const editable = canExecute && (data?.status === 'OPEN' || data?.status === 'COUNTING');
  const summary = data?.summary;
  const s = data;

  return (
    <Modal title={s ? `${s.number} — جلسة جرد` : 'جلسة جرد'} onClose={onClose}>
      {loading ? (
        <div className="py-6 text-center text-gray-400">جارِ التحميل…</div>
      ) : error && !data ? (
        <ErrorBox message={error} />
      ) : s ? (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <Badge color={statusColor[s.status]}>{statusLabel[s.status]}</Badge>
            <span className="text-sm text-gray-500">
              {s.warehouse.nameAr} — فتح بواسطة {s.openedBy.name} في {formatDate(s.openedAt)}
            </span>
            {s.approvedBy ? (
              <span className="text-sm text-gray-500">اعتمد بواسطة {s.approvedBy.name}</span>
            ) : null}
          </div>

          {summary ? (
            <div className="mb-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-sm text-gray-500">بنود</div>
                <div className="mt-1 text-xl font-black text-gray-900">{summary.lines}</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-sm text-gray-500">فرق الكمية</div>
                <div className="mt-1 text-xl font-black text-blue-700">{formatMoney(summary.totalDiffQty)}</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-sm text-gray-500">قيمة الفرق (ج)</div>
                <div className="mt-1 text-xl font-black text-red-600">{formatMoney(summary.totalDiffValue)}</div>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-max border-collapse">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <Th>الصنف</Th>
                  <Th>رصيد النظام</Th>
                  <Th>العد</Th>
                  <Th>الفرق</Th>
                  <Th>آخر سعر شراء</Th>
                  <Th>قيمة الفرق</Th>
                  <Th>مرات العد</Th>
                </tr>
              </thead>
              <tbody>
                {(s.lines ?? []).map((l) => {
                  const key = `${l.itemId}:${l.batchId}`;
                  const draft = drafts[key] ?? '';
                  return (
                    <tr key={l.id} className="border-b border-gray-100 last:border-0">
                      <Td>
                        <div className="font-semibold">{l.item.nameAr}</div>
                        <div className="text-xs font-mono text-gray-400">{l.item.code}</div>
                      </Td>
                      <Td dir="ltr">{formatMoney(l.systemQtyBase)}</Td>
                      <Td>
                        {editable ? (
                          <TextInput
                            value={draft}
                            onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })}
                            type="number"
                            step="any"
                            min="0"
                            className="w-28"
                          />
                        ) : (
                          formatMoney(l.countedQtyBase)
                        )}
                      </Td>
                      <Td dir="ltr" className={l.diffQty > 0 ? 'font-bold text-emerald-600' : l.diffQty < 0 ? 'font-bold text-red-600' : ''}>
                        {formatMoney(l.diffQty)}
                      </Td>
                      <Td>{l.lastCost != null ? formatMoney(l.lastCost) : '—'}</Td>
                      <Td dir="ltr">{l.diffValue ? formatMoney(l.diffValue) : '—'}</Td>
                      <Td>{l.recountCount}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {s.notes ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              سبب الإلغاء: {s.notes}
            </div>
          ) : null}

          {error ? (
            <div className="mt-3">
              <ErrorBox message={error} />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {editable ? (
              <Button onClick={saveCounts} disabled={busy}>
                {busy ? 'جارِ الحفظ…' : 'حفظ العدّات'}
              </Button>
            ) : null}
            {canExecute && (s.status === 'OPEN' || s.status === 'COUNTING') ? (
              <Button variant="secondary" onClick={() => void act('review')} disabled={busy}>
                مراجعة
              </Button>
            ) : null}
            {canExecute && s.status === 'REVIEW' ? (
              <>
                <Button variant="secondary" onClick={() => void act('back-to-counting')} disabled={busy}>
                  العودة للعد
                </Button>
                {canApprove ? (
                  <Button onClick={() => void act('approve')} disabled={busy}>
                    اعتماد وتسوية
                  </Button>
                ) : null}
              </>
            ) : null}
            {canApprove && (s.status === 'OPEN' || s.status === 'COUNTING' || s.status === 'REVIEW') ? (
              <Button variant="danger" onClick={() => setAborting(true)} disabled={busy}>
                إلغاء الجلسة
              </Button>
            ) : null}
          </div>

          {aborting ? (
            <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <Field label="سبب الإلغاء">
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
              </Field>
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setAborting(false)}>
                  تراجع
                </Button>
                <Button variant="danger" onClick={() => void confirmAbort()} disabled={busy}>
                  تأكيد الإلغاء
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}