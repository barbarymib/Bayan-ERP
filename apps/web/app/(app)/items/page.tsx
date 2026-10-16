'use client';

import { useEffect, useState } from 'react';
import {
  can,
  get,
  post,
  patch,
  del,
  qs,
  type Batch,
  type BatchesPage,
  type Category,
  type Item,
  type ItemsPage,
  type Unit,
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
  Th,
  formatMoney,
} from '@/components/ui';

interface UnitRow {
  unitCode: string;
  factorToBase: string;
  isSale: boolean;
  isPurchase: boolean;
  allowDecimal: boolean;
}

interface AttrRow {
  key: string;
  value: string;
}

const emptyUnitRow = (): UnitRow => ({
  unitCode: '',
  factorToBase: '',
  isSale: true,
  isPurchase: true,
  allowDecimal: true,
});

export default function ItemsPage() {
  const { user } = useAuth();
  const manage = can(user, 'item.manage');

  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([get<{ units: Unit[] }>('/units'), get<{ categories: Category[]; total: number }>('/categories')])
      .then(([u, c]) => {
        if (!cancelled) {
          setUnits(u.units);
          setCategories(c.categories);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    get<ItemsPage>(`/items${qs({ q, categoryCode, page, limit: 20 })}`)
      .then((data) => {
        if (!cancelled) {
          setItems(data.items);
          setTotal(data.total);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل الأصناف');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, categoryCode, page, refresh]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [batchItem, setBatchItem] = useState<Item | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div>
      <PageHeader title="الأصناف" action={manage ? <Button onClick={() => setCreateOpen(true)}>+ صنف جديد</Button> : undefined} />

      {notice ? <div className="mb-3"><Notice type="success">{notice}</Notice></div> : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TextInput
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="بحث بالكود أو الاسم…"
          className="w-64"
        />
        <Select
          value={categoryCode}
          onChange={(e) => {
            setCategoryCode(e.target.value);
            setPage(1);
          }}
          className="w-48"
        >
          <option value="">كل التصنيفات</option>
          {categories.map((c) => (
            <option key={c.id} value={c.code}>
              {c.nameAr}
            </option>
          ))}
        </Select>
        <Button variant="secondary" onClick={() => setRefresh((s) => s + 1)}>
          تحديث
        </Button>
        <span className="text-sm text-gray-500">{total} صنف</span>
      </div>

      {error ? <ErrorBox message={error} onRetry={() => setRefresh((s) => s + 1)} /> : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الكود</Th>
              <Th>الاسم</Th>
              <Th>التصنيف</Th>
              <Th>الوحدة</Th>
              <Th>وحدات التحويل</Th>
              <Th>حد أدنى</Th>
              <Th>الحالة</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400">لا توجد أصناف</Td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-mono font-semibold">{item.code}</Td>
                  <Td>
                    <div className="font-semibold">{item.nameAr}</div>
                    {item.nameEn ? <div className="text-xs text-gray-400">{item.nameEn}</div> : null}
                  </Td>
                  <Td>{item.category?.nameAr ?? '—'}</Td>
                  <Td>{item.baseUnit.nameAr ?? item.baseUnit.code}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {item.itemUnits.map((iu) => (
                        <span key={iu.id} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                          {iu.unit.code}: {Number(iu.factorToBase).toLocaleString('ar-EG')}
                        </span>
                      ))}
                      {item.itemUnits.length === 0 ? <span className="text-xs text-gray-400">—</span> : null}
                    </div>
                  </Td>
                  <Td>{formatMoney(item.minStock)}</Td>
                  <Td>{item.active ? <Badge color="green">نشط</Badge> : <Badge color="red">موقوف</Badge>}</Td>
                  <Td>
                    {manage ? (
                      <div className="flex gap-1">
                        <Button variant="ghost" onClick={() => setEditItem(item)}>
                          تعديل
                        </Button>
                        {item.trackBatch ? (
                          <Button variant="ghost" onClick={() => setBatchItem(item)}>
                            الدفعات
                          </Button>
                        ) : null}
                        {item.active ? (
                          <Button
                            variant="ghost"
                            onClick={async () => {
                              await del(`/items/${item.id}`);
                              setNotice(`تم إيقاف ${item.code}`);
                              setRefresh((s) => s + 1);
                            }}
                            className="!text-red-600"
                          >
                            إيقاف
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 20 ? (
        <div className="mt-3 flex justify-center gap-2">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            السابق
          </Button>
          <span className="self-center text-sm text-gray-500">صفحة {page}</span>
          <Button variant="secondary" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>
            التالي
          </Button>
        </div>
      ) : null}

      {createOpen ? (
        <CreateItemModal
          units={units}
          categories={categories}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            setNotice('تم إنشاء الصنف');
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}

      {editItem ? (
        <EditItemModal
          item={editItem}
          categories={categories}
          onClose={() => setEditItem(null)}
          onSaved={() => {
            setEditItem(null);
            setNotice('تم تحديث الصنف');
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}

      {batchItem ? <BatchesModal item={batchItem} canManage={manage} onClose={() => setBatchItem(null)} /> : null}
    </div>
  );
}

function CreateItemModal({
  units,
  categories,
  onClose,
  onCreated,
}: {
  units: Unit[];
  categories: Category[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [baseUnitCode, setBaseUnitCode] = useState('');
  const [minStock, setMinStock] = useState('0');
  const [barcode, setBarcode] = useState('');
  const [trackBatch, setTrackBatch] = useState(false);
  const [unitRows, setUnitRows] = useState<UnitRow[]>([]);
  const [attrs, setAttrs] = useState<AttrRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await post('/items', {
        code: code.trim(),
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim() || undefined,
        categoryCode: categoryCode.trim(),
        baseUnitCode: baseUnitCode.trim(),
        minStock: Number(minStock) || 0,
        barcode: barcode.trim() || undefined,
        trackBatch,
        itemUnits: unitRows
          .filter((r) => r.unitCode)
          .map((r) => ({
            unitCode: r.unitCode,
            factorToBase: Number(r.factorToBase),
            isSale: r.isSale,
            isPurchase: r.isPurchase,
            allowDecimal: r.allowDecimal,
          })),
        attributes: attrs.filter((a) => a.key.trim()).map((a) => ({ key: a.key.trim(), value: a.value.trim() })),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء الصنف');
      setBusy(false);
    }
  }

  const grid = 'grid grid-cols-2 gap-3';

  return (
    <Modal title="صنف جديد" onClose={onClose}>
      <div className={`${grid} mb-4`}>
        <Field label="الكود">
          <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="IR-12-10" required />
        </Field>
        <Field label="الاسم العربي">
          <TextInput value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
        </Field>
        <Field label="الاسم الإنجليزي">
          <TextInput value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </Field>
        <Field label="التصنيف">
          <Select value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)} required>
            <option value="">اختر تصنيفاً</option>
            {categories.map((c) => (
              <option key={c.id} value={c.code}>
                {c.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الوحدة الأساسية">
          <Select value={baseUnitCode} onChange={(e) => setBaseUnitCode(e.target.value)} required>
            <option value="">اختر وحدة</option>
            {units.map((u) => (
              <option key={u.id} value={u.code}>
                {u.nameAr ?? u.code} ({u.code})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="حد أدنى للمخزون">
          <TextInput value={minStock} onChange={(e) => setMinStock(e.target.value)} type="number" min="0" step="any" />
        </Field>
        <Field label="باركود">
          <TextInput value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        </Field>
      </div>
      <label className="mb-4 flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={trackBatch} onChange={(e) => setTrackBatch(e.target.checked)} />
        يتتبع رقم الدفعة (batch)
      </label>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-gray-700">وحدات التحويل</span>
        <Button variant="secondary" onClick={() => setUnitRows([...unitRows, emptyUnitRow()])}>
          + إضافة وحدة
        </Button>
      </div>
      {unitRows.map((row, i) => (
        <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <Field label="الوحدة">
            <Select
              value={row.unitCode}
              onChange={(e) => {
                const next = [...unitRows];
                next[i] = { ...row, unitCode: e.target.value };
                setUnitRows(next);
              }}
            >
              <option value="">—</option>
              {units.map((u) => (
                <option key={u.id} value={u.code} disabled={u.code === baseUnitCode}>
                  {u.nameAr ?? u.code}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="العامل إلى الأساس (×)">
            <TextInput
              value={row.factorToBase}
              onChange={(e) => {
                const next = [...unitRows];
                next[i] = { ...row, factorToBase: e.target.value };
                setUnitRows(next);
              }}
              type="number"
              min="0.000001"
              step="any"
            />
          </Field>
          <Button variant="danger" onClick={() => setUnitRows(unitRows.filter((_, j) => j !== i))}>
            حذف
          </Button>
        </div>
      ))}

      <div className="mb-2 mt-4 flex items-center justify-between">
        <span className="text-sm font-bold text-gray-700">الخصائص</span>
        <Button variant="secondary" onClick={() => setAttrs([...attrs, { key: '', value: '' }])}>
          + إضافة خاصية
        </Button>
      </div>
      {attrs.map((row, i) => (
        <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <Field label="الخاصية">
            <TextInput
              value={row.key}
              onChange={(e) => {
                const next = [...attrs];
                next[i] = { ...row, key: e.target.value };
                setAttrs(next);
              }}
              placeholder="درجة / لحام / لين"
            />
          </Field>
          <Field label="القيمة">
            <TextInput
              value={row.value}
              onChange={(e) => {
                const next = [...attrs];
                next[i] = { ...row, value: e.target.value };
                setAttrs(next);
              }}
              placeholder="3 لين"
            />
          </Field>
          <Button variant="danger" onClick={() => setAttrs(attrs.filter((_, j) => j !== i))}>
            حذف
          </Button>
        </div>
      ))}

      {error ? (
        <div className="mt-3">
          <Notice type="error">{error}</Notice>
        </div>
      ) : null}
      <div className="mt-5 flex justify-end gap-2">
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

function EditItemModal({
  item,
  categories,
  onClose,
  onSaved,
}: {
  item: Item;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nameAr, setNameAr] = useState(item.nameAr);
  const [nameEn, setNameEn] = useState(item.nameEn ?? '');
  const [categoryCode, setCategoryCode] = useState(item.category?.code ?? '');
  const [minStock, setMinStock] = useState(item.minStock);
  const [barcode, setBarcode] = useState(item.barcode ?? '');
  const [trackBatch, setTrackBatch] = useState(item.trackBatch);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await patch(`/items/${item.id}`, {
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim() || undefined,
        categoryCode: categoryCode.trim() || undefined,
        minStock: Number(minStock) || 0,
        barcode: barcode.trim() || undefined,
        trackBatch,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحديث الصنف');
      setBusy(false);
    }
  }

  return (
    <Modal title={`تعديل ${item.code}`} onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="الاسم العربي">
          <TextInput value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
        </Field>
        <Field label="الاسم الإنجليزي">
          <TextInput value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </Field>
        <Field label="التصنيف">
          <Select value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)}>
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.code}>
                {c.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="حد أدنى للمخزون">
          <TextInput value={minStock} onChange={(e) => setMinStock(e.target.value)} type="number" min="0" step="any" />
        </Field>
        <Field label="باركود">
          <TextInput value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        </Field>
      </div>
      <label className="mb-4 flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={trackBatch} onChange={(e) => setTrackBatch(e.target.checked)} />
        يتتبع رقم الدفعة
      </label>
      {error ? (
        <div className="mb-3">
          <Notice type="error">{error}</Notice>
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

function BatchesModal({ item, canManage, onClose }: { item: Item; canManage: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [expiry, setExpiry] = useState('');
  const [productionDate, setProductionDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    get<BatchesPage>(`/batches${qs({ itemId: item.id, includeInactive: true })}`)
      .then((d) => {
        if (!cancelled) {
          setRows(d.batches);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل الدفعات');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, refresh]);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await post('/batches', {
        itemId: item.id,
        code: code.trim(),
        expiry: expiry || undefined,
        productionDate: productionDate || undefined,
      });
      setCode('');
      setExpiry('');
      setProductionDate('');
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ الدفعة');
    } finally {
      setBusy(false);
    }
  }

  async function updateExpiry(b: Batch, next: string) {
    setError(null);
    try {
      await patch(`/batches/${b.id}`, { expiry: next || null });
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحديث الصلاحية');
    }
  }

  async function remove(b: Batch) {
    setError(null);
    try {
      await del(`/batches/${b.id}`);
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حذف الدفعة');
    }
  }

  function status(b: Batch): { color: string; label: string } {
    if (!b.expiry) return { color: 'gray', label: 'بلا صلاحية' };
    const exp = new Date(b.expiry);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
    if (days < 0) return { color: 'red', label: 'منتهية' };
    if (days <= 30) return { color: 'blue', label: `تنتهي خلال ${days} يوم` };
    return { color: 'green', label: 'سارية' };
  }

  return (
    <Modal title={`دفعات ${item.code} — ${item.nameAr}`} onClose={onClose}>
      {canManage ? (
        <div className="mb-4 grid grid-cols-4 items-end gap-2">
          <Field label="كود الدفعة">
            <TextInput value={code} onChange={(e) => setCode(e.target.value)} required />
          </Field>
          <Field label="تاريخ الإنتاج">
            <TextInput value={productionDate} onChange={(e) => setProductionDate(e.target.value)} type="date" />
          </Field>
          <Field label="تاريخ الصلاحية">
            <TextInput value={expiry} onChange={(e) => setExpiry(e.target.value)} type="date" />
          </Field>
          <Button onClick={add} disabled={busy || !code.trim()}>
            {busy ? '…' : '+ إضافة'}
          </Button>
        </div>
      ) : null}

      {error ? (
        <div className="mb-3">
          <Notice type="error">{error}</Notice>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <Th>الكود</Th>
              <Th>الإنتاج</Th>
              <Th>الصلاحية</Th>
              <Th>الحالة</Th>
              {canManage ? <Th></Th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-4 text-center text-gray-400">جارِ التحميل…</Td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <Td className="py-4 text-center text-gray-400">لا توجد دفعات</Td>
              </tr>
            ) : (
              rows.map((b) => {
                const st = status(b);
                return (
                  <tr key={b.id} className="border-b border-gray-100 last:border-0">
                    <Td className="font-mono font-semibold">{b.code || '—'}</Td>
                    <Td>{b.productionDate ? b.productionDate.slice(0, 10) : '—'}</Td>
                    <Td>
                      {canManage ? (
                        <input
                          type="date"
                          className="rounded border border-gray-200 px-2 py-1 text-sm"
                          value={b.expiry ? b.expiry.slice(0, 10) : ''}
                          onChange={(e) => updateExpiry(b, e.target.value)}
                        />
                      ) : b.expiry ? (
                        b.expiry.slice(0, 10)
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>
                      <Badge color={st.color}>{st.label}</Badge>
                    </Td>
                    {canManage ? (
                      <Td>
                        <Button variant="danger" onClick={() => remove(b)}>
                          حذف
                        </Button>
                      </Td>
                    ) : null}
                  </tr>
                );
              })
            )}
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

