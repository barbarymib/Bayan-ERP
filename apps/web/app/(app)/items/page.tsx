'use client';

import { useEffect, useState } from 'react';
import { useDebounce } from '@/lib/hooks';
import {
  API_URL,
  can,
  get,
  post,
  put,
  patch,
  del,
  qs,
  type Batch,
  type BatchesPage,
  type Brand,
  type Category,
  type Item,
  type ItemImage,
  type ItemsPage,
  type Unit,
} from '@/lib/api';
import { fileToDataUrl } from '@/lib/image';
import { ItemLabelModal } from '@/components/item-label-modal';
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
  barcode: string;
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
  barcode: '',
});

export default function ItemsPage() {
  const { user } = useAuth();
  const manage = can(user, 'item.manage');

  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q, 300);
  const [categoryCode, setCategoryCode] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [parentOptions, setParentOptions] = useState<Item[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      get<{ units: Unit[] }>('/units'),
      get<{ categories: Category[]; total: number }>('/categories'),
      get<{ brands: Brand[]; total: number }>('/brands'),
      get<ItemsPage>('/items?limit=100&active=true'),
    ])
      .then(([u, c, b, i]) => {
        if (!cancelled) {
          setUnits(u.units);
          setCategories(c.categories);
          setBrands(b.brands);
          setParentOptions(i.items);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    get<ItemsPage>(`/items${qs({ q: debouncedQ, categoryCode, page, limit: 20 })}`)
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
  }, [debouncedQ, categoryCode, page, refresh]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [batchItem, setBatchItem] = useState<Item | null>(null);
  const [labelItem, setLabelItem] = useState<Item | null>(null);
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
              <Th>الماركة / المنشأ</Th>
              <Th>الوحدة</Th>
              <Th>وحدات التحويل</Th>
              <Th>حد أدنى</Th>
              <Th>حد البيع</Th>
              <Th>آخر شراء</Th>
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
                    <div className="flex items-center gap-2">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${API_URL}/items/${item.id}/image`}
                          alt={item.nameAr}
                          className="h-8 w-8 rounded object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                      <div>
                        <div className="font-semibold">{item.nameAr}</div>
                        {item.nameEn ? <div className="text-xs text-gray-400">{item.nameEn}</div> : null}
                        {item.parent ? (
                          <div className="text-xs text-blue-500">تنويع من {item.parent.nameAr}</div>
                        ) : item._count && item._count.variants > 0 ? (
                          <div className="text-xs text-blue-500">الأساسي · {item._count.variants} تنويع</div>
                        ) : null}
                      </div>
                    </div>
                  </Td>
                  <Td>{item.category?.nameAr ?? '—'}</Td>
                  <Td>
                    <div>{item.brand?.nameAr ?? '—'}</div>
                    {item.origin ? <div className="text-xs text-gray-400">{item.origin}</div> : null}
                  </Td>
                  <Td>{item.baseUnit.nameAr ?? item.baseUnit.code}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {(item.itemUnits ?? []).map((iu) => (
                        <span key={iu.id} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                          {iu.unit.code}: {Number(iu.factorToBase).toLocaleString('ar-EG')}
                        </span>
                      ))}
                      {(item.itemUnits ?? []).length === 0 ? <span className="text-xs text-gray-400">—</span> : null}
                    </div>
                  </Td>
                  <Td>{formatMoney(item.minStock)}</Td>
                  <Td>{item.minSalePrice != null ? formatMoney(item.minSalePrice) : '—'}</Td>
                  <Td>
                    {item.lastPurchaseCost != null ? (
                      <div>
                        <div>{formatMoney(item.lastPurchaseCost)}</div>
                        {item.lastPurchaseAt ? (
                          <div className="text-xs text-gray-400">
                            {new Date(item.lastPurchaseAt).toLocaleDateString('ar-EG')}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>{item.active ? <Badge color="green">نشط</Badge> : <Badge color="red">موقوف</Badge>}</Td>
                  <Td>
                    <div className="flex gap-1">
                      <Button variant="ghost" onClick={() => setLabelItem(item)}>
                        ملصق
                      </Button>
                      {manage ? (
                        <>
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
                        </>
                      ) : null}
                    </div>
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
          brands={brands}
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
          units={units}
          categories={categories}
          brands={brands}
          parentOptions={parentOptions}
          onClose={() => setEditItem(null)}
          onSaved={() => {
            setEditItem(null);
            setNotice('تم تحديث الصنف');
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}

      {batchItem ? <BatchesModal item={batchItem} canManage={manage} onClose={() => setBatchItem(null)} /> : null}

      {labelItem ? (
        <ItemLabelModal
          kind="item"
          code={labelItem.code}
          nameAr={labelItem.nameAr}
          subtitle={labelItem.category?.nameAr ?? undefined}
          onClose={() => setLabelItem(null)}
        />
      ) : null}
    </div>
  );
}

function UnitRowsEditor({
  rows,
  setRows,
  units,
  baseUnitCode,
}: {
  rows: UnitRow[];
  setRows: (rows: UnitRow[]) => void;
  units: Unit[];
  baseUnitCode?: string;
}) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-gray-700">وحدات التحويل</span>
        <Button variant="secondary" onClick={() => setRows([...rows, emptyUnitRow()])}>
          + إضافة وحدة
        </Button>
      </div>
      {rows.length === 0 ? <div className="text-xs text-gray-400">لا توجد وحدات بديلة</div> : null}
      {rows.map((row, i) => (
        <div key={i} className="mb-2 rounded-lg border border-gray-100 bg-gray-50 p-2">
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
            <Field label="الوحدة">
              <Select
                value={row.unitCode}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...row, unitCode: e.target.value };
                  setRows(next);
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
                  const next = [...rows];
                  next[i] = { ...row, factorToBase: e.target.value };
                  setRows(next);
                }}
                type="number"
                min="0.000001"
                step="any"
              />
            </Field>
            <Field label="باركود الوحدة">
              <TextInput
                value={row.barcode}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...row, barcode: e.target.value };
                  setRows(next);
                }}
              />
            </Field>
            <Button variant="danger" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              حذف
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={row.isSale}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...row, isSale: e.target.checked };
                  setRows(next);
                }}
              />
              وحدة بيع
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={row.isPurchase}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...row, isPurchase: e.target.checked };
                  setRows(next);
                }}
              />
              وحدة شراء
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={row.allowDecimal}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...row, allowDecimal: e.target.checked };
                  setRows(next);
                }}
              />
              تقبل كسوراً
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}

function AttrRowsEditor({ rows, setRows }: { rows: AttrRow[]; setRows: (rows: AttrRow[]) => void }) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-gray-700">الخصائص</span>
        <Button variant="secondary" onClick={() => setRows([...rows, { key: '', value: '' }])}>
          + إضافة خاصية
        </Button>
      </div>
      {rows.length === 0 ? <div className="text-xs text-gray-400">لا توجد خصائص</div> : null}
      {rows.map((row, i) => (
        <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <Field label="الخاصية">
            <TextInput
              value={row.key}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, key: e.target.value };
                setRows(next);
              }}
              placeholder="القطر / الدرجة / النوع"
            />
          </Field>
          <Field label="القيمة">
            <TextInput
              value={row.value}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, value: e.target.value };
                setRows(next);
              }}
              placeholder="12 / 52 / لاكيه"
            />
          </Field>
          <Button variant="danger" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
            حذف
          </Button>
        </div>
      ))}
    </div>
  );
}

function CreateItemModal({
  units,
  categories,
  brands,
  onClose,
  onCreated,
}: {
  units: Unit[];
  categories: Category[];
  brands: Brand[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [baseUnitCode, setBaseUnitCode] = useState('');
  const [brandCode, setBrandCode] = useState('');
  const [origin, setOrigin] = useState('');
  const [minStock, setMinStock] = useState('0');
  const [minSalePrice, setMinSalePrice] = useState('');
  const [barcode, setBarcode] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [trackBatch, setTrackBatch] = useState(false);
  const [unitRows, setUnitRows] = useState<UnitRow[]>([]);
  const [attrs, setAttrs] = useState<AttrRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const created = await post<Item>('/items', {
        code: code.trim(),
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim() || undefined,
        categoryCode: categoryCode.trim(),
        baseUnitCode: baseUnitCode.trim(),
        brandCode: brandCode.trim() || undefined,
        origin: origin.trim() || undefined,
        minStock: Number(minStock) || 0,
        minSalePrice: minSalePrice.trim() === '' ? undefined : Number(minSalePrice),
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
            barcode: r.barcode.trim() || undefined,
          })),
        attributes: attrs.filter((a) => a.key.trim()).map((a) => ({ key: a.key.trim(), value: a.value.trim() })),
      });
      if (imageUrl) await post(`/items/${created.id}/image`, { dataUrl: imageUrl });
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
        <Field label="الماركة">
          <Select value={brandCode} onChange={(e) => setBrandCode(e.target.value)}>
            <option value="">—</option>
            {brands.map((b) => (
              <option key={b.id} value={b.code}>
                {b.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="المنشأ">
          <TextInput value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="مصر / تركيا…" />
        </Field>
        <Field label="حد أدنى للمخزون">
          <TextInput value={minStock} onChange={(e) => setMinStock(e.target.value)} type="number" min="0" step="any" />
        </Field>
        <Field label="حد أدنى لسعر البيع">
          <TextInput
            value={minSalePrice}
            onChange={(e) => setMinSalePrice(e.target.value)}
            type="number"
            min="0"
            step="any"
          />
        </Field>
        <Field label="باركود">
          <TextInput value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        </Field>
        <Field label="صورة الصنف">
          <div className="flex items-center gap-2">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="h-10 w-10 rounded border object-cover" />
            ) : null}
            <input
              type="file"
              accept="image/*"
              className="text-sm text-gray-600 file:me-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setImageUrl(await fileToDataUrl(file));
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'تعذّر قراءة الصورة');
                }
              }}
            />
            {imageUrl ? (
              <Button variant="ghost" onClick={() => setImageUrl('')}>
                إزالة
              </Button>
            ) : null}
          </div>
        </Field>
      </div>
      <label className="mb-2 flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={trackBatch} onChange={(e) => setTrackBatch(e.target.checked)} />
        يتتبع رقم الدفعة (تشغيلة + صلاحية)
      </label>

      <UnitRowsEditor rows={unitRows} setRows={setUnitRows} units={units} baseUnitCode={baseUnitCode} />
      <AttrRowsEditor rows={attrs} setRows={setAttrs} />

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
  units,
  categories,
  brands,
  parentOptions,
  onClose,
  onSaved,
}: {
  item: Item;
  units: Unit[];
  categories: Category[];
  brands: Brand[];
  parentOptions: Item[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nameAr, setNameAr] = useState(item.nameAr);
  const [nameEn, setNameEn] = useState(item.nameEn ?? '');
  const [categoryCode, setCategoryCode] = useState(item.category?.code ?? '');
  const [brandCode, setBrandCode] = useState(item.brand?.code ?? '');
  const [origin, setOrigin] = useState(item.origin ?? '');
  const [minStock, setMinStock] = useState(item.minStock);
  const [minSalePrice, setMinSalePrice] = useState(item.minSalePrice ?? '');
  const [barcode, setBarcode] = useState(item.barcode ?? '');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [hasImage, setHasImage] = useState(!!item.imageUrl);
  const [gallery, setGallery] = useState<ItemImage[]>(item.images ?? []);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [trackBatch, setTrackBatch] = useState(item.trackBatch);
  const [active, setActive] = useState(item.active);
  const [parentItemId, setParentItemId] = useState(item.parentItemId ? String(item.parentItemId) : '');
  const [unitRows, setUnitRows] = useState<UnitRow[]>(
    (item.itemUnits ?? []).map((iu) => ({
      unitCode: iu.unit.code,
      factorToBase: String(iu.factorToBase),
      isSale: iu.isSale,
      isPurchase: iu.isPurchase,
      allowDecimal: iu.allowDecimal,
      barcode: iu.barcode ?? '',
    })),
  );
  const [attrs, setAttrs] = useState<AttrRow[]>(
    (item.attributes ?? []).map((a) => ({ key: a.key, value: a.value })),
  );
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
        brandCode: brandCode.trim() || undefined,
        origin: origin.trim() || undefined,
        minStock: Number(minStock) || 0,
        minSalePrice: minSalePrice.trim() === '' ? undefined : Number(minSalePrice),
        barcode: barcode.trim() || undefined,
        trackBatch,
        active,
        parentItemId: parentItemId ? Number(parentItemId) : undefined,
        itemUnits: unitRows
          .filter((r) => r.unitCode)
          .map((r) => ({
            unitCode: r.unitCode,
            factorToBase: Number(r.factorToBase),
            isSale: r.isSale,
            isPurchase: r.isPurchase,
            allowDecimal: r.allowDecimal,
            barcode: r.barcode.trim() || undefined,
          })),
        attributes: attrs.filter((a) => a.key.trim()).map((a) => ({ key: a.key.trim(), value: a.value.trim() })),
      });
      if (imageDataUrl) await post(`/items/${item.id}/image`, { dataUrl: imageDataUrl });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحديث الصنف');
      setBusy(false);
    }
  }

  async function addGalleryImage(file: File) {
    setGalleryBusy(true);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const updated = await post<Item>(`/items/${item.id}/images`, { dataUrl });
      setGallery(updated.images ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر رفع الصورة');
    } finally {
      setGalleryBusy(false);
    }
  }

  async function removeGalleryImage(img: ItemImage) {
    setGalleryBusy(true);
    setError(null);
    try {
      const updated = await del(`/items/${item.id}/images/${img.id}`).then(() =>
        get<Item>(`/items/${item.id}`),
      );
      setGallery(updated.images ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حذف الصورة');
    } finally {
      setGalleryBusy(false);
    }
  }

  async function coverGalleryImage(img: ItemImage) {
    setGalleryBusy(true);
    setError(null);
    try {
      const updated = await put<Item>(`/items/${item.id}/images/${img.id}/cover`, {});
      setGallery(updated.images ?? []);
      setHasImage(true);
      setImageDataUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تعيين الصورة الرئيسية');
    } finally {
      setGalleryBusy(false);
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
        <Field label="الماركة">
          <Select value={brandCode} onChange={(e) => setBrandCode(e.target.value)}>
            <option value="">—</option>
            {brands.map((b) => (
              <option key={b.id} value={b.code}>
                {b.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="المنشأ">
          <TextInput value={origin} onChange={(e) => setOrigin(e.target.value)} />
        </Field>
        <Field label="الصنف الأساسي (تنويعة)">
          <Select value={parentItemId} onChange={(e) => setParentItemId(e.target.value)}>
            <option value="">— ليس تنويعة —</option>
            {parentOptions
              .filter((o) => o.id !== item.id)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code} — {o.nameAr}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="حد أدنى للمخزون">
          <TextInput value={minStock} onChange={(e) => setMinStock(e.target.value)} type="number" min="0" step="any" />
        </Field>
        <Field label="حد أدنى لسعر البيع">
          <TextInput
            value={minSalePrice}
            onChange={(e) => setMinSalePrice(e.target.value)}
            type="number"
            min="0"
            step="any"
          />
        </Field>
        <Field label="باركود">
          <TextInput value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        </Field>
        <Field label="صورة الصنف">
          <div className="flex items-center gap-2">
            {imageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageDataUrl} alt="" className="h-10 w-10 rounded border object-cover" />
            ) : hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${API_URL}/items/${item.id}/image`}
                alt=""
                className="h-10 w-10 rounded border object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            <input
              type="file"
              accept="image/*"
              className="text-sm text-gray-600 file:me-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setImageDataUrl(await fileToDataUrl(file));
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'تعذّر قراءة الصورة');
                }
              }}
            />
            {hasImage || imageDataUrl ? (
              <Button
                variant="ghost"
                onClick={async () => {
                  setImageDataUrl('');
                  if (!hasImage) return;
                  try {
                    await del(`/items/${item.id}/image`);
                    setHasImage(false);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'تعذّر إزالة الصورة');
                  }
                }}
              >
                إزالة
              </Button>
            ) : null}
          </div>
        </Field>
      </div>
      <div className="mb-4 rounded-lg border border-gray-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">معرض الصور</h3>
          <label className="text-sm text-gray-600 file:me-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1">
            <input
              type="file"
              accept="image/*"
              disabled={galleryBusy}
              className="text-sm text-gray-600"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void addGalleryImage(file);
              }}
            />
          </label>
        </div>
        {gallery.length ? (
          <div className="flex flex-wrap gap-3">
            {gallery.map((img) => (
              <div key={img.id} className="w-28">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${API_URL}/items/${item.id}/images/${img.id}`}
                  alt=""
                  className="h-20 w-28 rounded border object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="mt-1 flex justify-center gap-1">
                  <Button variant="ghost" disabled={galleryBusy} onClick={() => void coverGalleryImage(img)}>
                    رئيسية
                  </Button>
                  <Button variant="ghost" disabled={galleryBusy} onClick={() => void removeGalleryImage(img)}>
                    حذف
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">لا توجد صور إضافية — الصورة الرئيسية أعلاه.</p>
        )}
      </div>
      <div className="mb-2 flex flex-wrap gap-4 text-sm text-gray-700">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={trackBatch} onChange={(e) => setTrackBatch(e.target.checked)} />
          يتتبع رقم الدفعة
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          نشط
        </label>
      </div>

      <UnitRowsEditor rows={unitRows} setRows={setUnitRows} units={units} baseUnitCode={item.baseUnit.code} />
      <AttrRowsEditor rows={attrs} setRows={setAttrs} />

      {error ? (
        <div className="mb-3 mt-3">
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
                        <TextInput
                          type="date"
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
                        <Button variant="ghost" onClick={() => remove(b)} className="!text-red-600">
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
