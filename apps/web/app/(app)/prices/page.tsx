'use client';

import { useEffect, useState } from 'react';
import {
  can,
  get,
  post,
  qs,
  type BulkResult,
  type Item,
  type ItemsPage,
  type PriceHistoryEntry,
  type PriceList,
  type PriceResolve,
  type SuppliersPage,
  type Unit,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  Button,
  ErrorBox,
  Field,
  Notice,
  PageHeader,
  Select,
  Td,
  TextInput,
  Th,
  formatDate,
  formatMoney,
} from '@/components/ui';

type Tab = 'resolve' | 'bulk' | 'history' | 'convert';

export default function PricesPage() {
  const { user } = useAuth();
  const manage = can(user, 'price.manage');

  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [tab, setTab] = useState<Tab>('resolve');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      get<{ priceLists: PriceList[] }>('/price-lists'),
      get<{ units: Unit[] }>('/units'),
      get<ItemsPage>(`/items${qs({ limit: 200 })}`),
    ])
      .then(([pl, u, it]) => {
        if (!cancelled) {
          setPriceLists(pl.priceLists);
          setUnits(u.units);
          setItems(it.items);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const tabs: { id: Tab; label: string; cond?: boolean }[] = [
    { id: 'resolve', label: 'استعلام / تحديد سعر' },
    { id: 'bulk', label: 'التسعير الجماعي اليومي', cond: manage },
    { id: 'history', label: 'سجل تغييرات الأسعار', cond: manage },
    { id: 'convert', label: 'آلة تحويل الوحدات' },
  ];

  return (
    <div>
      <PageHeader title="الأسعار والتسعير" />

      {notice ? (
        <div className="mb-3">
          <Notice type="success">{notice}</Notice>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1">
        {tabs
          .filter((t) => t.cond !== false)
          .map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      {tab === 'resolve' ? (
        <ResolvePane priceLists={priceLists} units={units} items={items} manage={manage} onDone={(msg) => setNotice(msg)} />
      ) : null}
      {tab === 'bulk' && manage ? <BulkPane priceLists={priceLists} units={units} items={items} onDone={(msg) => setNotice(msg)} /> : null}
      {tab === 'history' && manage ? <HistoryPane items={items} /> : null}
      {tab === 'convert' ? <ConvertPane items={items} /> : null}
    </div>
  );
}

function ResolvePane({
  priceLists,
  units,
  items,
  manage,
  onDone,
}: {
  priceLists: PriceList[];
  units: Unit[];
  items: Item[];
  manage: boolean;
  onDone: (msg: string) => void;
}) {
  const [itemCode, setItemCode] = useState('');
  const [priceListCode, setPriceListCode] = useState('RETAIL');
  const [unitCode, setUnitCode] = useState('');
  const [result, setResult] = useState<PriceResolve | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = items.find((i) => i.code === itemCode);

  async function resolve() {
    setError(null);
    try {
      const data = await get<PriceResolve>(`/prices${qs({ itemCode, priceListCode, unitCode })}`);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الاستعلام');
      setResult(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-base font-bold text-gray-900">استعلام عن السعر الحالي</h3>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <Field label="الصنف">
            <Select value={itemCode} onChange={(e) => setItemCode(e.target.value)}>
              <option value="">اختر صنفاً</option>
              {items.map((i) => (
                <option key={i.id} value={i.code}>
                  {i.code} — {i.nameAr}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="قائمة السعر">
            <Select value={priceListCode} onChange={(e) => setPriceListCode(e.target.value)}>
              {priceLists.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.nameAr}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الوحدة">
            <Select value={unitCode} onChange={(e) => setUnitCode(e.target.value)}>
              <option value="">الوحدة الافتراضية للصنف</option>
              {selectedItem
                ? [selectedItem.baseUnit, ...selectedItem.itemUnits.map((iu) => iu.unit)].map((u) => (
                    <option key={u.id} value={u.code}>
                      {u.nameAr ?? u.code}
                    </option>
                  ))
                : units.map((u) => (
                    <option key={u.id} value={u.code}>
                      {u.nameAr ?? u.code}
                    </option>
                  ))}
            </Select>
          </Field>
        </div>
        <Button onClick={resolve}>استعلام</Button>

        {result ? (
          <div className="mt-4 rounded-lg bg-gray-50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-gray-900">
                  {result.item.code} — {result.item.nameAr}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  قائمة {result.priceList.nameAr} • الوحدة {result.unit.code}
                </div>
              </div>
              {result.price !== null ? (
                <div className="text-2xl font-black text-blue-700">{formatMoney(result.price)} ج</div>
              ) : (
                <Badge color="red">لا يوجد سعر محدد</Badge>
              )}
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="mt-3">
            <ErrorBox message={error} />
          </div>
        ) : null}
      </div>

      {manage ? (
        <SetPricePane
          priceLists={priceLists}
          items={items}
          initialItemCode={itemCode}
          onDone={(msg) => {
            onDone(msg);
            setResult(null);
          }}
        />
      ) : null}
    </div>
  );
}

function SetPricePane({
  priceLists,
  items,
  initialItemCode,
  onDone,
}: {
  priceLists: PriceList[];
  items: Item[];
  initialItemCode: string;
  onDone: (msg: string) => void;
}) {
  const [itemCode, setItemCode] = useState(initialItemCode);
  const [priceListCode, setPriceListCode] = useState('RETAIL');
  const [unitCode, setUnitCode] = useState('');
  const [price, setPrice] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selectedItem = items.find((i) => i.code === itemCode);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await post('/prices', {
        itemCode,
        priceListCode,
        unitCode: unitCode || undefined,
        price: Number(price),
        validFrom: validFrom || undefined,
        validTo: validTo || undefined,
      });
      onDone('تم تعيين السعر');
      setPrice('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تعيين السعر');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-base font-bold text-gray-900">تعيين سعر صنف</h3>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Field label="الصنف">
          <Select value={itemCode} onChange={(e) => setItemCode(e.target.value)}>
            <option value="">اختر صنفاً</option>
            {items.map((i) => (
              <option key={i.id} value={i.code}>
                {i.code} — {i.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="قائمة السعر">
          <Select value={priceListCode} onChange={(e) => setPriceListCode(e.target.value)}>
            {priceLists.map((p) => (
              <option key={p.id} value={p.code}>
                {p.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الوحدة">
          <Select value={unitCode} onChange={(e) => setUnitCode(e.target.value)}>
            <option value="">الوحدة الافتراضية للصنف</option>
            {selectedItem
              ? [selectedItem.baseUnit, ...selectedItem.itemUnits.map((iu) => iu.unit)].map((u) => (
                  <option key={u.id} value={u.code}>
                    {u.nameAr ?? u.code}
                  </option>
                ))
              : null}
          </Select>
        </Field>
        <Field label="السعر (ج)">
          <TextInput value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" step="any" />
        </Field>
        <Field label="ساري من (اختياري)">
          <TextInput type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        </Field>
        <Field label="ساري حتى (اختياري)">
          <TextInput type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
        </Field>
      </div>
      <p className="mb-3 text-xs text-gray-500">
        اترك «ساري من» فارغاً ليبدأ السعر فوراً. تحديد تاريخ مستقبلي يجدول السعر دون المساس بالسعر الحالي.
      </p>
      {error ? (
        <div className="mb-3">
          <ErrorBox message={error} />
        </div>
      ) : null}
      <Button onClick={submit} disabled={busy || !itemCode || price === ''}>
        {busy ? 'جارِ الحفظ…' : 'حفظ السعر'}
      </Button>
    </div>
  );
}

function BulkPane({
  priceLists,
  units,
  items,
  onDone,
}: {
  priceLists: PriceList[];
  units: Unit[];
  items: Item[];
  onDone: (msg: string) => void;
}) {
  const [mode, setMode] = useState<'percent' | 'amount' | 'set'>('percent');
  const [priceListCode, setPriceListCode] = useState('RETAIL');
  const [unitCode, setUnitCode] = useState('');
  const [value, setValue] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [categories, setCategories] = useState<{ code: string; nameAr: string }[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [suppliers, setSuppliers] = useState<{ id: number; nameAr: string; code: string }[]>([]);
  const [manualCodes, setManualCodes] = useState('');
  const [setRows, setSetRows] = useState<{ itemCode: string; price: string }[]>([]);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bulkValidFrom, setBulkValidFrom] = useState('');
  const [bulkValidTo, setBulkValidTo] = useState('');

  useEffect(() => {
    get<{ categories: { code: string; nameAr: string }[] }>('/categories')
      .then((d) => setCategories(d.categories))
      .catch(() => undefined);
    get<SuppliersPage>('/suppliers?limit=200')
      .then((d) => setSuppliers(d.suppliers))
      .catch(() => undefined);
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        priceListCode,
        unitCode: unitCode || undefined,
      };
      if (mode === 'set') {
        body.set = setRows
          .filter((r) => r.itemCode)
          .map((r) => ({ itemCode: r.itemCode, price: Number(r.price) }));
      } else {
        body[mode] = Number(value);
      }
      if (supplierId) body.supplierId = Number(supplierId);
      else if (categoryCode) body.categoryCode = categoryCode;
      else if (manualCodes.trim()) body.itemCodes = manualCodes.split(',').map((s) => s.trim()).filter(Boolean);
      if (bulkValidFrom) body.validFrom = bulkValidFrom;
      if (bulkValidTo) body.validTo = bulkValidTo;
      const data = await post<BulkResult>('/prices/bulk', body);
      setResult(data);
      onDone(`تم تسعير ${data.applied} صنف`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التسعير الجماعي');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-base font-bold text-gray-900">تسعير يومي جماعي</h3>
        <div className="mb-3 flex flex-wrap gap-2">
          {(
            [
              ['percent', 'نسبة مئوية'],
              ['amount', 'قيمة ثابتة'],
              ['set', 'تسعير مباشر (set)'],
            ] as [typeof mode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                mode === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <Field label="قائمة السعر">
            <Select value={priceListCode} onChange={(e) => setPriceListCode(e.target.value)}>
              {priceLists.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.nameAr}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الوحدة (اختياري)">
            <Select value={unitCode} onChange={(e) => setUnitCode(e.target.value)}>
              <option value="">الوحدة الأساسية لكل صنف</option>
              {units.map((u) => (
                <option key={u.id} value={u.code}>
                  {u.nameAr ?? u.code}
                </option>
              ))}
            </Select>
          </Field>
          {mode !== 'set' ? (
            <Field label={mode === 'percent' ? 'نسبة التغيير % (+3 = زيادة 3%)' : 'قيمة التغيير (+150)'}>
              <TextInput value={value} onChange={(e) => setValue(e.target.value)} type="number" step="any" />
            </Field>
          ) : null}
          <Field label="ساري من (اختياري)">
            <TextInput type="date" value={bulkValidFrom} onChange={(e) => setBulkValidFrom(e.target.value)} />
          </Field>
          <Field label="ساري حتى (اختياري)">
            <TextInput type="date" value={bulkValidTo} onChange={(e) => setBulkValidTo(e.target.value)} />
          </Field>
        </div>

        {mode !== 'set' ? (
          <div className="mb-3 grid grid-cols-2 gap-3">
            <Field label="نطاق: شركة/مورد">
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— اختر —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nameAr}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="نطاق: تصنيف">
              <Select value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)}>
                <option value="">كل الأصناف</option>
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.nameAr}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="أو: أكواد أصناف (مفصولة بفاصلة)">
              <TextInput value={manualCodes} onChange={(e) => setManualCodes(e.target.value)} placeholder="IR-16-10, IR-12-10" />
            </Field>
          </div>
        ) : (
          <div className="mb-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">الأصناف والأسعار</span>
              {items.length > setRows.length ? (
                <Button
                  variant="secondary"
                  onClick={() => setSetRows([...setRows, { itemCode: '', price: '' }])}
                >
                  + إضافة صف
                </Button>
              ) : null}
            </div>
            {setRows.map((row, i) => (
              <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <Field label="الصنف">
                  <Select
                    value={row.itemCode}
                    onChange={(e) => {
                      const next = [...setRows];
                      next[i] = { ...row, itemCode: e.target.value };
                      setSetRows(next);
                    }}
                  >
                    <option value="">—</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.code}>
                        {it.code} — {it.nameAr}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="السعر">
                  <TextInput
                    value={row.price}
                    onChange={(e) => {
                      const next = [...setRows];
                      next[i] = { ...row, price: e.target.value };
                      setSetRows(next);
                    }}
                    type="number"
                    min="0"
                  />
                </Field>
                <Button variant="danger" onClick={() => setSetRows(setRows.filter((_, j) => j !== i))}>
                  حذف
                </Button>
              </div>
            ))}
          </div>
        )}

        {error ? (
          <div className="mb-3">
            <ErrorBox message={error} />
          </div>
        ) : null}
        <Button onClick={submit} disabled={busy} className="w-full">
          {busy ? 'جارِ التنفيذ…' : 'تنفيذ التسعير'}
        </Button>
      </div>

      {result ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-base font-bold text-gray-900">
            النتيجة — تم تسعير {result.applied} صنف
          </h3>
          {result.skipped.length > 0 ? (
            <div className="mb-3">
              <Badge color="gray">
                تم تخطي {result.skipped.length}: {JSON.stringify(result.skipped)}
              </Badge>
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <Th>الصنف</Th>
                  <Th>الوحدة</Th>
                  <Th>قبل</Th>
                  <Th>بعد</Th>
                </tr>
              </thead>
              <tbody>
                {result.details.map((d) => (
                  <tr key={`${d.itemCode}-${d.unitCode}`} className="border-b border-gray-100 last:border-0">
                    <Td>{d.itemCode} — {d.itemName}</Td>
                    <Td>{d.unitCode}</Td>
                    <Td>{d.oldPrice !== null ? formatMoney(d.oldPrice) : '—'}</Td>
                    <Td className="font-bold text-blue-700">{formatMoney(d.newPrice)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HistoryPane({ items }: { items: Item[] }) {
  const [itemCode, setItemCode] = useState('');
  const [rows, setRows] = useState<PriceHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const data = await get<{ item: unknown; history: PriceHistoryEntry[] }>(
        `/prices/history${qs({ itemCode, limit: 50 })}`,
      );
      setRows(data.history);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحميل السجل');
      setRows([]);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-base font-bold text-gray-900">سجل تغييرات أسعار صنف</h3>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Field label="الصنف">
          <Select value={itemCode} onChange={(e) => setItemCode(e.target.value)} className="w-72">
            <option value="">اختر صنفاً</option>
            {items.map((i) => (
              <option key={i.id} value={i.code}>
                {i.code} — {i.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Button onClick={load} disabled={!itemCode}>
          عرض
        </Button>
      </div>
      {error ? <ErrorBox message={error} /> : null}
      {rows.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-400">لا يوجد سجل حتى الآن</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <Th>التاريخ</Th>
                <Th>الوحدة</Th>
                <Th>القائمة</Th>
                <Th>من</Th>
                <Th>إلى</Th>
                <Th>بواسطة</Th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0">
                  <Td>{formatDate(r.changedAt)}</Td>
                  <Td>{r.unit.nameAr ?? r.unit.code}</Td>
                  <Td>{r.priceList.nameAr}</Td>
                  <Td>{r.oldPrice !== null ? formatMoney(r.oldPrice) : '—'}</Td>
                  <Td className="font-bold text-blue-700">{formatMoney(r.newPrice)}</Td>
                  <Td>{r.changedBy.name}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConvertPane({ items }: { items: Item[] }) {
  const [itemCode, setItemCode] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [qty, setQty] = useState('1');
  const [result, setResult] = useState<{
    baseUnit: string;
    from: { code: string; factorToBase: number };
    to: { code: string; factorToBase: number };
    qty: number;
    qtyBase: number;
    converted: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = items.find((i) => i.code === itemCode);
  const unitOpts = selectedItem
    ? [{ code: selectedItem.baseUnit.code, name: selectedItem.baseUnit.nameAr ?? selectedItem.baseUnit.code }, ...selectedItem.itemUnits.map((iu) => ({ code: iu.unit.code, name: iu.unit.nameAr ?? iu.unit.code }))]
    : [];

  async function go() {
    setError(null);
    setResult(null);
    try {
      const item = items.find((i) => i.code === itemCode);
      if (!item) return;
      const data = await get<typeof result>(`/items/${item.id}/convert${qs({ from, to, qty })}`);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التحويل');
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-base font-bold text-gray-900">آلة تحويل الوحدات (قبول تحويل وحدات صحيح)</h3>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Field label="الصنف">
          <Select
            value={itemCode}
            onChange={(e) => {
              setItemCode(e.target.value);
              const item = items.find((i) => i.code === e.target.value);
              if (item) {
                const opts = [item.baseUnit, ...item.itemUnits.map((iu) => iu.unit)];
                setFrom(item.baseUnit.code);
                setTo(opts[1]?.code ?? item.baseUnit.code);
              }
            }}
            className="w-72"
          >
            <option value="">اختر صنفاً</option>
            {items.map((i) => (
              <option key={i.id} value={i.code}>
                {i.code} — {i.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="من">
          <Select value={from} onChange={(e) => setFrom(e.target.value)}>
            {unitOpts.map((u) => (
              <option key={u.code} value={u.code}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="إلى">
          <Select value={to} onChange={(e) => setTo(e.target.value)}>
            {unitOpts.map((u) => (
              <option key={u.code} value={u.code}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الكمية">
          <TextInput value={qty} onChange={(e) => setQty(e.target.value)} type="number" min="0" step="any" className="w-24" />
        </Field>
        <Button onClick={go} disabled={!itemCode || !from || !to}>
          تحويل
        </Button>
      </div>
      {error ? (
        <div className="mb-3">
          <ErrorBox message={error} />
        </div>
      ) : null}
      {result ? (
        <div className="rounded-lg bg-gray-50 p-4">
          <div className="text-sm text-gray-500">
            {result.qty.toLocaleString('ar-EG')} {result.from.code} = {result.converted.toLocaleString('ar-EG')} {result.to.code}
          </div>
          <div className="mt-1 text-xs text-gray-400">
            الأساس: {result.baseUnit} • الكمية بالأساس: {result.qtyBase.toLocaleString('ar-EG')}
          </div>
          <div className="mt-2 text-2xl font-black text-blue-700">
            {result.converted.toLocaleString('ar-EG')} {result.to.code}
          </div>
        </div>
      ) : null}
    </div>
  );
}