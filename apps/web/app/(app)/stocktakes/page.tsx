'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  can,
  get,
  post,
  put,
  qs,
  type BrandRow,
  type BrandsPage,
  type Category,
  type CategoriesPage,
  type Item,
  type ItemsPage,
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
  toArabicNumerals,
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
                    <div className="flex flex-wrap gap-1">
                      <Button variant="ghost" onClick={() => setSelected(r.id)}>
                        فتح
                      </Button>
                      <Link
                        href={`/stocktakes/${r.id}/print`}
                        className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        طباعة
                      </Link>
                    </div>
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [scopeMode, setScopeMode] = useState<'full' | 'category' | 'brand' | 'item'>('full');
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [brandIds, setBrandIds] = useState<number[]>([]);
  const [itemIds, setItemIds] = useState<number[]>([]);
  const [itemQuery, setItemQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      get<{ warehouses: Warehouse[] }>('/warehouses'),
      get<CategoriesPage>(`/categories${qs({})}`),
      get<BrandsPage>(`/brands${qs({})}`),
      get<ItemsPage>(`/items${qs({ limit: 500 })}`),
    ])
      .then(([w, c, b, it]) => {
        if (!cancelled) {
          setWarehouses(w.warehouses.filter((x) => x.active));
          setCategories(c.categories);
          setBrands(b.brands);
          setAllItems(it.items);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleCategory(id: number) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleBrand(id: number) {
    setBrandIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleItem(id: number) {
    setItemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const q = itemQuery.trim().toLowerCase();
  const filteredItems = q
    ? allItems.filter((it) => it.code.toLowerCase().includes(q) || it.nameAr.includes(itemQuery.trim()))
    : allItems;

  const selectedCount =
    scopeMode === 'category' ? categoryIds.length : scopeMode === 'brand' ? brandIds.length : scopeMode === 'item' ? itemIds.length : 0;

  async function submit() {
    setError(null);
    if (scopeMode !== 'full' && selectedCount === 0) {
      setError('اختر عنصراً واحداً على الأقل للنطاق الجزئي');
      return;
    }
    const scope =
      scopeMode === 'category'
        ? { categoryIds }
        : scopeMode === 'brand'
          ? { brandIds }
          : scopeMode === 'item'
            ? { itemIds }
            : undefined;
    setBusy(true);
    try {
      const res = await post<StocktakeSession>('/stocktakes', {
        warehouseId: Number(warehouseId),
        ...(scope ? { scope } : {}),
      });
      onDone(`تم فتح جلسة جرد ${res.number} (${res.lines?.length ?? 0} بند)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل فتح الجلسة');
      setBusy(false);
    }
  }

  const checkbox = 'h-4 w-4 rounded border-gray-300 text-blue-600';

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
        <Field label="نطاق الجرد">
          <Select value={scopeMode} onChange={(e) => setScopeMode(e.target.value as 'full' | 'category' | 'brand' | 'item')}>
            <option value="full">جرد كلي (كل أصناف المخزن)</option>
            <option value="category">حسب التصنيف</option>
            <option value="brand">حسب الماركة</option>
            <option value="item">أصناف محددة (مجموعة أصناف)</option>
          </Select>
        </Field>

        {scopeMode === 'category' ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
            <div className="mb-1 text-xs text-gray-500">التصنيفات ({categoryIds.length} محدد)</div>
            <div className="max-h-48 overflow-y-auto">
              {categories.length === 0 ? (
                <div className="py-2 text-center text-xs text-gray-400">لا توجد تصنيفات</div>
              ) : (
                categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 px-1 py-1 text-sm">
                    <input type="checkbox" className={checkbox} checked={categoryIds.includes(c.id)} onChange={() => toggleCategory(c.id)} />
                    <span>
                      {c.nameAr} <span className="text-xs text-gray-400">{c.code}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        ) : null}

        {scopeMode === 'brand' ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
            <div className="mb-1 text-xs text-gray-500">الماركات ({brandIds.length} محدد)</div>
            <div className="max-h-48 overflow-y-auto">
              {brands.length === 0 ? (
                <div className="py-2 text-center text-xs text-gray-400">لا توجد ماركات</div>
              ) : (
                brands.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 px-1 py-1 text-sm">
                    <input type="checkbox" className={checkbox} checked={brandIds.includes(b.id)} onChange={() => toggleBrand(b.id)} />
                    <span>
                      {b.nameAr} <span className="text-xs text-gray-400">{b.code}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        ) : null}

        {scopeMode === 'item' ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
            <div className="mb-1 text-xs text-gray-500">الأصناف ({itemIds.length} محدد)</div>
            <TextInput
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              placeholder="ابحث بالكود أو الاسم…"
              className="mb-2 w-full"
            />
            <div className="max-h-48 overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="py-2 text-center text-xs text-gray-400">لا نتائج</div>
              ) : (
                filteredItems.map((it) => (
                  <label key={it.id} className="flex items-center gap-2 px-1 py-1 text-sm">
                    <input type="checkbox" className={checkbox} checked={itemIds.includes(it.id)} onChange={() => toggleItem(it.id)} />
                    <span>
                      {it.nameAr} <span className="font-mono text-xs text-gray-400">{it.code}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        ) : null}
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
  const [counter, setCounter] = useState('');
  const [confirmBig, setConfirmBig] = useState(false);
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
          return { itemId: Number(itemId), batchId, qty: Number(val), ...(counter.trim() ? { counter: counter.trim() } : {}) };
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
      const body = action === 'approve' ? { confirm: confirmBig } : {};
      const res = await post<{ recountWarning?: string | null }>(`/stocktakes/${id}/${action}`, body);
      setRefresh((x) => x + 1);
      onDone(`${labels[action]}${res?.recountWarning ? ` — ${res.recountWarning}` : ''}`);
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

          {editable ? (
            <div className="mb-4 max-w-xs">
              <Field label="العداد (اختياري — يدعم أكثر من عداد)">
                <TextInput value={counter} onChange={(e) => setCounter(e.target.value)} placeholder="مثال: عداد أ / فريق 1" className="w-full" />
              </Field>
            </div>
          ) : null}

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

          {summary && summary.bigDiffLines > 0 ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <span className="font-bold">{summary.bigDiffLines}</span> بند بفرق يتجاوز حد إعادة العد (قيمة الفروقات{' '}
              {formatMoney(summary.bigDiffValue)} ج) — يُستحسن المراجعة/إعادة العد قبل الاعتماد.
              {s.recount ? (
                <span className="mr-1"> الوضع: {s.recount.mode === 'BLOCK' ? 'منع (BLOCK)' : 'تحذير (WARN)'}.</span>
              ) : null}
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
                  <Th>العداد</Th>
                  <Th>أدخل بواسطة</Th>
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
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-400">{l.item.code}</span>
                          {l.bigDiff ? <Badge color="red">فرق كبير</Badge> : null}
                        </div>
                      </Td>
                      <Td dir="ltr">
                        {formatMoney(l.systemQtyBase)}
                        {l.systemQtyComposite ? (
                          <div className="text-[11px] font-normal text-gray-500" dir="rtl">
                            {toArabicNumerals(l.systemQtyComposite)}
                          </div>
                        ) : null}
                      </Td>
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
                          <>
                            {formatMoney(l.countedQtyBase)}
                            {l.countedQtyComposite ? (
                              <div className="text-[11px] font-normal text-gray-500" dir="rtl">
                                {toArabicNumerals(l.countedQtyComposite)}
                              </div>
                            ) : null}
                          </>
                        )}
                      </Td>
                      <Td dir="ltr" className={l.diffQty > 0 ? 'font-bold text-emerald-600' : l.diffQty < 0 ? 'font-bold text-red-600' : ''}>
                        {formatMoney(l.diffQty)}
                      </Td>
                      <Td>{l.lastCost != null ? formatMoney(l.lastCost) : '—'}</Td>
                      <Td dir="ltr">{l.diffValue ? formatMoney(l.diffValue) : '—'}</Td>
                      <Td>{l.recountCount}</Td>
                      <Td>{l.counter ?? '—'}</Td>
                      <Td>{l.countedBy?.name ?? '—'}</Td>
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
                  <div className="flex flex-wrap items-center gap-2">
                    {summary && summary.bigDiffLines > 0 ? (
                      <label className="flex items-center gap-1 text-sm text-amber-800">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={confirmBig}
                          onChange={(e) => setConfirmBig(e.target.checked)}
                        />
                        أؤكد الاعتماد رغم الفروقات الكبيرة
                      </label>
                    ) : null}
                    <Button onClick={() => void act('approve')} disabled={busy}>
                      اعتماد وتسوية
                    </Button>
                  </div>
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