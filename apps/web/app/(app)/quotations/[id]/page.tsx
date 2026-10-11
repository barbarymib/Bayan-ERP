'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { can, get, post, type Quotation, type QuotationStatus } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  Button,
  ErrorBox,
  formatMoney,
  Notice,
  PageHeader,
  Td,
  Th,
} from '@/components/ui';

const STATUS_LABEL: Record<QuotationStatus, string> = {
  DRAFT: 'مسودة',
  SENT: 'مُرسل',
  ACCEPTED: 'مقبول',
  REJECTED: 'مرفوض',
  CONVERTED: 'محوّل لبيان',
  EXPIRED: 'منتهي',
};

const STATUS_COLOR: Record<QuotationStatus, string> = {
  DRAFT: 'gray',
  SENT: 'blue',
  ACCEPTED: 'green',
  REJECTED: 'red',
  CONVERTED: 'blue',
  EXPIRED: 'red',
};

export default function QuotationDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const canEdit = can(user, 'statement.create');
  const canApprove = can(user, 'statement.approve');

  const [q, setQ] = useState<Quotation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    get<Quotation>(`/quotations/${params.id}`)
      .then(setQ)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل تحميل العرض'));
  }

  useEffect(() => {
    if (params.id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function action(verb: 'send' | 'accept' | 'reject' | 'convert') {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await post<{ statement?: { number: string } }>(`/quotations/${params.id}/${verb}`, {});
      if (verb === 'convert' && res.statement) {
        setNotice(`تم التحويل إلى بيان الأسعار ${res.statement.number}`);
      } else {
        setNotice('تم تنفيذ الإجراء بنجاح');
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تنفيذ الإجراء');
    } finally {
      setBusy(false);
    }
  }

  if (error && !q) {
    return (
      <div>
        <ErrorBox message={error} onRetry={load} />
      </div>
    );
  }
  if (!q) {
    return <div className="text-gray-400">جارِ التحميل…</div>;
  }

  const st = q.effectiveStatus;
  const convertible = st !== 'CONVERTED' && st !== 'REJECTED' && st !== 'EXPIRED';

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={`عرض سعر ${q.number}`}
        action={
          <Link
            href="/quotations"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            رجوع للقائمة
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge color={STATUS_COLOR[st]}>{STATUS_LABEL[st]}</Badge>
        {canEdit && st === 'DRAFT' ? (
          <Button disabled={busy} onClick={() => void action('send')}>
            إرسال
          </Button>
        ) : null}
        {canApprove && (st === 'DRAFT' || st === 'SENT') ? (
          <>
            <Button disabled={busy} onClick={() => void action('accept')}>
              قبول
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void action('reject')}>
              رفض
            </Button>
          </>
        ) : null}
        {canEdit && convertible ? (
          <Button disabled={busy} onClick={() => void action('convert')}>
            تحويل إلى بيان أسعار
          </Button>
        ) : null}
        {q.convertedStatementId ? (
          <Link
            href={`/statements/${q.convertedStatementId}`}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            عرض البيان المرتبط
          </Link>
        ) : null}
      </div>

      {notice ? (
        <div className="mb-3">
          <Notice type="success">{notice}</Notice>
        </div>
      ) : null}
      {error ? <div className="mb-3"><ErrorBox message={error} /></div> : null}

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm md:grid-cols-4">
        <div>
          <div className="text-gray-400">العميل</div>
          <div className="font-semibold">
            {q.customer.nameAr} <span className="font-mono text-xs text-gray-400">{q.customer.code}</span>
          </div>
        </div>
        <div>
          <div className="text-gray-400">التاريخ</div>
          <div className="font-semibold">{new Date(q.date).toLocaleDateString('ar-EG')}</div>
        </div>
        <div>
          <div className="text-gray-400">صالح حتى</div>
          <div className="font-semibold">
            {q.validUntil ? new Date(q.validUntil).toLocaleDateString('ar-EG') : '—'}
          </div>
        </div>
        <div>
          <div className="text-gray-400">المخزن</div>
          <div className="font-semibold">{q.warehouse?.nameAr ?? 'الافتراضي'}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الصنف</Th>
              <Th>الوحدة</Th>
              <Th>الكمية</Th>
              <Th>السعر</Th>
              <Th>الإجمالي</Th>
            </tr>
          </thead>
          <tbody>
            {(q.lines ?? []).length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400" colSpan={5}>
                  لا توجد بنود
                </Td>
              </tr>
            ) : (
              (q.lines ?? []).map((l) => (
                <tr key={l.id} className="border-b border-gray-100 last:border-0">
                  <Td className="font-semibold">
                    {l.item.nameAr} <span className="font-mono text-xs text-gray-400">{l.item.code}</span>
                  </Td>
                  <Td>{l.unit.code}</Td>
                  <Td dir="ltr">{l.qty}</Td>
                  <Td dir="ltr">{formatMoney(l.unitPrice)}</Td>
                  <Td dir="ltr" className="font-semibold">
                    {formatMoney(l.netLine)}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 ml-auto w-full max-w-xs space-y-1 rounded-xl border border-gray-200 bg-white p-4 text-sm">
        <Row label="الإجمالي" value={formatMoney(q.subtotal)} />
        <Row label="الخصم" value={formatMoney(q.discountAmount)} />
        <Row label="الشحن" value={formatMoney(q.shipping)} />
        <Row label={`الضريبة ${q.taxPercent}%`} value={formatMoney(q.taxAmount)} />
        <div className="border-t border-gray-200 pt-2 font-bold text-gray-900">
          <Row label="الصافي" value={formatMoney(q.net)} />
        </div>
      </div>

      {q.notes ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
          {q.notes}
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}
