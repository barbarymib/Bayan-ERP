'use client';

import { useEffect, useState } from 'react';
import {
  can,
  del,
  get,
  patch,
  post,
  qs,
  type Customer,
  type CustomerGroup,
  type CustomerGroupsPage,
  type PriceList,
  type SpecialPriceRow,
  type SpecialPricesPage,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  Button,
  ErrorBox,
  Field,
  formatMoney,
  Modal,
  Notice,
  PageHeader,
  Select,
  Td,
  TextInput,
  Th,
} from '@/components/ui';

type Scope = 'CUSTOMER' | 'GROUP' | 'PRICE_LIST' | 'GLOBAL';

const SCOPE_LABEL: Record<Scope, string> = {
  CUSTOMER: 'عميل',
  GROUP: 'مجموعة عملاء',
  PRICE_LIST: 'قائمة أسعار',
  GLOBAL: 'عام',
};

function scopeOf(row: SpecialPriceRow): Scope {
  if (row.customer) return 'CUSTOMER';
  if (row.customerGroup) return 'GROUP';
  if (row.priceList) return 'PRICE_LIST';
  return 'GLOBAL';
}

export default function SpecialPricesPage() {
  const { user } = useAuth();
  const manage = can(user, 'price.manage');
  const manageGroups = can(user, 'customer.manage');

  const [rows, setRows] = useState<SpecialPriceRow[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [state, setState] = useState('ACTIVE');
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      get<SpecialPricesPage>(`/special-prices${qs({ state })}`),
      get<CustomerGroupsPage>('/customer-groups?limit=100'),
    ])
      .then(([sp, cg]) => {
        if (!cancelled) {
          setRows(sp.items);
          setGroups(cg.groups);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل التحميل');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [state, refresh]);

  async function toggle(row: SpecialPriceRow) {
    try {
      await patch(`/special-prices/${row.id}`, { active: !row.active });
      setNotice('تم تحديث الحالة');
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التحديث');
    }
  }

  async function remove(row: SpecialPriceRow) {
    if (!confirm(`حذف السعر الخاص ${row.item.code}؟`)) return;
    try {
      await del(`/special-prices/${row.id}`);
      setNotice('تم الحذف');
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحذف');
    }
  }

  return (
    <div>
      <PageHeader
        title="الأسعار الخاصة وجموعات العملاء"
        action={
          manage ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setGroupOpen(true)}>
                + مجموعة عملاء
              </Button>
              <Button onClick={() => setCreateOpen(true)}>+ سعر خاص</Button>
            </div>
          ) : undefined
        }
      />

      {notice ? (
        <div className="mb-3">
          <Notice type="success">{notice}</Notice>
        </div>
      ) : null}
      {error ? <div className="mb-3"><ErrorBox message={error} /></div> : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={state} onChange={(e) => setState(e.target.value)} className="w-40">
          <option value="ACTIVE">نشط فقط</option>
          <option value="INACTIVE">موقوف فقط</option>
          <option value="ALL">الكل</option>
        </Select>
        <Button variant="secondary" onClick={() => setRefresh((s) => s + 1)}>
          تحديث
        </Button>
        <div className="text-xs text-gray-500">
          الأولوية: عميل &gt; مجموعة &gt; قائمة أسعار &gt; عام
        </div>
      </div>

      <div className="mb-6 overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الصنف</Th>
              <Th>الوحدة</Th>
              <Th>النطاق</Th>
              <Th>القيمة</Th>
              <Th>السعر</Th>
              <Th>من</Th>
              <Th>إلى</Th>
              <Th>الحالة</Th>
              {manage ? <Th>إجراءات</Th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400" colSpan={manage ? 9 : 8}>
                  جارِ التحميل…
                </Td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400" colSpan={manage ? 9 : 8}>
                  لا توجد أسعار خاصة
                </Td>
              </tr>
            ) : (
              rows.map((r) => {
                const scope = scopeOf(r);
                const value =
                  r.customer?.code ?? r.customerGroup?.code ?? r.priceList?.code ?? '—';
                return (
                  <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <Td className="font-semibold">
                      {r.item.nameAr}{' '}
                      <span className="font-mono text-xs text-gray-400">{r.item.code}</span>
                    </Td>
                    <Td>{r.unit.code}</Td>
                    <Td>
                      <Badge color="blue">{SCOPE_LABEL[scope]}</Badge>
                    </Td>
                    <Td className="font-mono">{value}</Td>
                    <Td className="font-semibold">{formatMoney(r.price)}</Td>
                    <Td>{r.validFrom ? new Date(r.validFrom).toLocaleDateString('ar-EG') : '—'}</Td>
                    <Td>{r.validTo ? new Date(r.validTo).toLocaleDateString('ar-EG') : 'مفتوح'}</Td>
                    <Td>
                      {r.active ? <Badge color="green">نشط</Badge> : <Badge color="red">موقوف</Badge>}
                    </Td>
                    {manage ? (
                      <Td>
                        <div className="flex gap-1">
                          <Button variant="secondary" onClick={() => void toggle(r)}>
                            {r.active ? 'إيقاف' : 'تفعيل'}
                          </Button>
                          <Button variant="secondary" onClick={() => void remove(r)}>
                            حذف
                          </Button>
                        </div>
                      </Td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">جموعات العملاء</h2>
        {manageGroups ? (
          <Button variant="secondary" onClick={() => setGroupOpen(true)}>
            + مجموعة
          </Button>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الكود</Th>
              <Th>الاسم</Th>
              <Th>عدد العملاء</Th>
              <Th>الحالة</Th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400" colSpan={4}>
                  لا توجد مجموعات
                </Td>
              </tr>
            ) : (
              groups.map((g) => (
                <tr key={g.id} className="border-b border-gray-100 last:border-0">
                  <Td className="font-mono font-semibold">{g.code}</Td>
                  <Td className="font-semibold">{g.nameAr}</Td>
                  <Td>{g._count?.customers ?? 0}</Td>
                  <Td>
                    {g.active ? <Badge color="green">نشط</Badge> : <Badge color="red">موقوف</Badge>}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {createOpen ? (
        <SpecialPriceModal
          groups={groups}
          onClose={() => setCreateOpen(false)}
          onSaved={(msg) => {
            setCreateOpen(false);
            setNotice(msg);
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}
      {groupOpen ? (
        <GroupModal
          onClose={() => setGroupOpen(false)}
          onSaved={(msg) => {
            setGroupOpen(false);
            setNotice(msg);
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function GroupModal({ onClose, onSaved }: { onClose: () => void; onSaved: (msg: string) => void }) {
  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await post('/customer-groups', { code: code.trim(), nameAr: nameAr.trim() });
      onSaved('تم إنشاء المجموعة');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحفظ');
      setBusy(false);
    }
  }

  return (
    <Modal title="مجموعة عملاء جديدة" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="الكود">
          <TextInput value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" required />
        </Field>
        <Field label="الاسم">
          <TextInput value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
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
        <Button onClick={() => void submit()} disabled={busy}>
          {busy ? 'جارِ الحفظ…' : 'حفظ'}
        </Button>
      </div>
    </Modal>
  );
}

function SpecialPriceModal({
  groups,
  onClose,
  onSaved,
}: {
  groups: CustomerGroup[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [itemCode, setItemCode] = useState('');
  const [items, setItems] = useState<{ id: number; code: string; nameAr: string }[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [scope, setScope] = useState<Scope>('CUSTOMER');
  const [target, setTarget] = useState('');
  const [price, setPrice] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([
      get<{ items: { id: number; code: string; nameAr: string }[] }>('/items?limit=500').then((d) =>
        setItems(d.items),
      ),
      get<{ customers: Customer[] }>('/customers?limit=200').then((d) => setCustomers(d.customers)),
      get<{ priceLists: PriceList[] }>('/price-lists').then((d) => setPriceLists(d.priceLists)),
    ]).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'فشل تحميل البيانات');
    });
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await post('/special-prices', {
        itemCode,
        price: Number(price),
        customerCode: scope === 'CUSTOMER' ? target : undefined,
        customerGroupCode: scope === 'GROUP' ? target : undefined,
        priceListCode: scope === 'PRICE_LIST' ? target : undefined,
        validFrom: validFrom || undefined,
        validTo: validTo || undefined,
      });
      onSaved('تم حفظ السعر الخاص');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحفظ');
      setBusy(false);
    }
  }

  return (
    <Modal title="سعر خاص جديد" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="الصنف">
          <Select value={itemCode} onChange={(e) => setItemCode(e.target.value)} required>
            <option value="">— اختر —</option>
            {items.map((it) => (
              <option key={it.id} value={it.code}>
                {it.code} — {it.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="السعر">
          <TextInput
            type="number"
            min={0}
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            dir="ltr"
            required
          />
        </Field>
        <Field label="نطاق السعر">
          <Select value={scope} onChange={(e) => { setScope(e.target.value as Scope); setTarget(''); }}>
            <option value="CUSTOMER">عميل محدد</option>
            <option value="GROUP">مجموعة عملاء</option>
            <option value="PRICE_LIST">قائمة أسعار</option>
            <option value="GLOBAL">عام (لكل العملاء)</option>
          </Select>
        </Field>
        <Field label="القيمة">
          {scope === 'GLOBAL' ? (
            <TextInput value="—" disabled dir="ltr" />
          ) : (
            <Select value={target} onChange={(e) => setTarget(e.target.value)} required>
              <option value="">— اختر —</option>
              {scope === 'CUSTOMER'
                ? customers.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.code} — {c.nameAr}
                    </option>
                  ))
                : scope === 'GROUP'
                  ? groups.map((g) => (
                      <option key={g.id} value={g.code}>
                        {g.code} — {g.nameAr}
                      </option>
                    ))
                  : priceLists.map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.code} — {p.nameAr}
                      </option>
                    ))}
            </Select>
          )}
        </Field>
        <Field label="من تاريخ">
          <TextInput type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        </Field>
        <Field label="إلى تاريخ" hint="اتركه فارغاً = مفتوح">
          <TextInput type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
        </Field>
      </div>
      <div className="mb-3 text-xs text-gray-400">
        يُستخدم وحدة الصنف الأساسية. يتفوّق السعر الخاص على سعر قائمة الأسعار.
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
        <Button onClick={() => void submit()} disabled={busy}>
          {busy ? 'جارِ الحفظ…' : 'حفظ'}
        </Button>
      </div>
    </Modal>
  );
}
