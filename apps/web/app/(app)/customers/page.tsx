'use client';

import { useEffect, useState } from 'react';
import { can, get, post, patch, qs, type Customer, type CustomersPage, type PriceList } from '@/lib/api';
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

export default function CustomersPage() {
  const { user } = useAuth();
  const manage = can(user, 'customer.manage');
  const canRate = can(user, 'customer.rating');

  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<Customer | null>(null);
  const [rateRow, setRateRow] = useState<Customer | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    get<{ priceLists: PriceList[] }>('/price-lists')
      .then((d) => setPriceLists(d.priceLists))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    get<CustomersPage>(`/customers${qs({ q, page, limit: 20 })}`)
      .then((data) => {
        if (!cancelled) {
          setRows(data.customers);
          setTotal(data.total);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل العملاء');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, page, refresh]);

  return (
    <div>
      <PageHeader title="العملاء (مع حدود الائتمان)" action={manage ? <Button onClick={() => setCreateOpen(true)}>+ عميل جديد</Button> : undefined} />

      {notice ? (
        <div className="mb-3">
          <Notice type="success">{notice}</Notice>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TextInput
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="بحث بالاسم أو الهاتف…"
          className="w-64"
        />
        <Button variant="secondary" onClick={() => setRefresh((s) => s + 1)}>
          تحديث
        </Button>
        <span className="text-sm text-gray-500">{total} عميل</span>
      </div>

      {error ? <ErrorBox message={error} onRetry={() => setRefresh((s) => s + 1)} /> : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الكود</Th>
              <Th>الاسم</Th>
              <Th>رقم الهاتف</Th>
              <Th>التصنيف</Th>
              <Th>قائمة السعر</Th>
              <Th>حد الائتمان</Th>
              <Th>أيام الائتمان</Th>
              <Th>تقييم السداد</Th>
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
                <Td className="py-6 text-center text-gray-400">لا يوجد عملاء</Td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-mono font-semibold">{c.code}</Td>
                  <Td>
                    <div className="font-semibold">{c.nameAr}</div>
                    {c.activity ? <div className="text-xs text-gray-400">{c.activity}</div> : null}
                  </Td>
                  <Td dir="ltr">{c.phone ?? '—'}</Td>
                  <Td>{c.classification}</Td>
                  <Td>{c.priceList?.nameAr ?? '—'}</Td>
                  <Td>{formatMoney(c.creditLimit)}</Td>
                  <Td>{c.creditDays ?? '—'}</Td>
                  <Td>
                    {c.paymentRating == null ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <span title={c.paymentNotes ?? undefined}>
                        <Badge color={c.paymentRating >= 70 ? 'green' : c.paymentRating >= 40 ? 'amber' : 'red'}>
                          {c.paymentRating}
                        </Badge>
                        {c.paymentNotes ? <span className="ms-1 text-xs text-gray-400">{c.paymentNotes}</span> : null}
                      </span>
                    )}
                  </Td>
                  <Td>{c.active ? <Badge color="green">نشط</Badge> : <Badge color="red">موقوف</Badge>}</Td>
                  <Td>
                    <div className="flex gap-1">
                      {canRate ? (
                        <Button variant="ghost" onClick={() => setRateRow(c)}>
                          تقييم
                        </Button>
                      ) : null}
                      {manage ? (
                        <Button variant="ghost" onClick={() => setEditRow(c)}>
                          تعديل
                        </Button>
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
        <CustomerModal
          priceLists={priceLists}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            setNotice('تم إنشاء العميل');
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}

      {editRow ? (
        <CustomerModal
          customer={editRow}
          priceLists={priceLists}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null);
            setNotice('تم تحديث بيانات العميل');
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}

      {rateRow ? (
        <RatingModal
          customer={rateRow}
          onClose={() => setRateRow(null)}
          onSaved={() => {
            setRateRow(null);
            setNotice('تم حفظ تقييم السداد');
            setRefresh((s) => s + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function RatingModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [paymentRating, setPaymentRating] = useState(customer.paymentRating == null ? '' : String(customer.paymentRating));
  const [paymentNotes, setPaymentNotes] = useState(customer.paymentNotes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const body: { paymentRating?: number; paymentNotes?: string } = {};
    if (paymentRating !== '') body.paymentRating = Number(paymentRating);
    body.paymentNotes = paymentNotes.trim() || undefined;
    try {
      await patch(`/customers/${customer.id}/rating`, body);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ التقييم');
      setBusy(false);
    }
  }

  return (
    <Modal title={`تقييم سداد ${customer.code}`} onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="تقييم السداد (0-100)">
          <TextInput
            value={paymentRating}
            onChange={(e) => setPaymentRating(e.target.value)}
            type="number"
            min="0"
            max="100"
          />
        </Field>
        <div className="col-span-2">
          <Field label="ملاحظات السداد">
            <TextInput value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
          </Field>
        </div>
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
          {busy ? 'جارٍ الحفظ…' : 'حفظ التقييم'}
        </Button>
      </div>
    </Modal>
  );
}

function CustomerModal({
  customer,
  priceLists,
  onClose,
  onSaved,
}: {
  customer?: Customer;
  priceLists: PriceList[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nameAr, setNameAr] = useState(customer?.nameAr ?? '');
  const [nameEn, setNameEn] = useState(customer?.nameEn ?? '');
  const [activity, setActivity] = useState(customer?.activity ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [taxNumber, setTaxNumber] = useState(customer?.taxNumber ?? '');
  const [priceListCode, setPriceListCode] = useState(customer?.priceList?.code ?? 'RETAIL');
  const [creditLimit, setCreditLimit] = useState(customer?.creditLimit ?? '0');
  const [creditDays, setCreditDays] = useState(customer?.creditDays ? String(customer.creditDays) : '30');
  const [classification, setClassification] = useState(customer?.classification ?? 'C');
  const [repCode, setRepCode] = useState(customer?.rep?.repCode ?? '');
  const [active, setActive] = useState(customer?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const body = {
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || undefined,
      activity: activity.trim() || undefined,
      phone: phone.trim() || undefined,
      taxNumber: taxNumber.trim() || undefined,
      priceListCode,
      creditLimit: Number(creditLimit) || 0,
      creditDays: Number(creditDays) || 0,
      classification,
      repCode: repCode.trim() || undefined,
      ...(customer ? { active } : {}),
    };
    try {
      if (customer) await patch(`/customers/${customer.id}`, body);
      else await post('/customers', body);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ العميل');
      setBusy(false);
    }
  }

  return (
    <Modal title={customer ? `تعديل ${customer.code}` : 'عميل جديد'} onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="الاسم العربي">
          <TextInput value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
        </Field>
        <Field label="الاسم الإنجليزي">
          <TextInput value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </Field>
        <Field label="النشاط">
          <TextInput value={activity} onChange={(e) => setActivity(e.target.value)} />
        </Field>
        <Field label="الهاتف">
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
        </Field>
        <Field label="الرقم الضريبي">
          <TextInput value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} dir="ltr" />
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
        <Field label="حد الائتمان (ج)">
          <TextInput value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} type="number" min="0" />
        </Field>
        <Field label="أيام الائتمان">
          <TextInput value={creditDays} onChange={(e) => setCreditDays(e.target.value)} type="number" min="0" />
        </Field>
        <Field label="التصنيف">
          <Select value={classification} onChange={(e) => setClassification(e.target.value)}>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </Select>
        </Field>
        <Field label="كود المندوب">
          <TextInput value={repCode} onChange={(e) => setRepCode(e.target.value)} placeholder="M01" />
        </Field>
        {customer ? (
          <Field label="الحالة">
            <Select value={active ? '1' : '0'} onChange={(e) => setActive(e.target.value === '1')}>
              <option value="1">نشط</option>
              <option value="0">موقوف</option>
            </Select>
          </Field>
        ) : null}
      </div>
      {!customer ? <div className="mb-3 text-xs text-gray-400">يُولَّد كود العميل تلقائياً (C0001, …).</div> : null}
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
          {busy ? 'جارِ الحفظ…' : 'حفظ'}
        </Button>
      </div>
    </Modal>
  );
}