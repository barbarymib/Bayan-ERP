'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { get, type Quotation } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ErrorBox, formatDate, formatMoney } from '@/components/ui';
import { downloadQuotationPdf } from '@/lib/quotation-pdf';
import { formatArabicAmount } from '@/lib/tafqit';

export default function QuotationPrintPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const { user } = useAuth();
  const [q, setQ] = useState<Quotation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [size, setSize] = useState<'A4' | 'A5' | '80'>('A4');
  const autoprint = search.get('autoprint') === '1';

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    get<Quotation>(`/quotations/${params.id}`)
      .then((res) => {
        if (cancelled) return;
        setQ(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'تعذر جلب عرض السعر');
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  useEffect(() => {
    if (autoprint && q) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [autoprint, q]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <ErrorBox message={error} />
      </div>
    );
  }
  if (!q || !user) {
    return <div className="p-8 text-center text-gray-400">جاري التحميل...</div>;
  }

  const actions = (
    <div className="print:hidden sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white p-3">
      <span className="text-lg font-black text-black">طباعة عرض سعر</span>
      <div className="ms-auto flex items-center gap-2">
        <select
          value={size}
          onChange={(e) => setSize(e.target.value as 'A4' | 'A5' | '80')}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-black"
        >
          <option value="A4">A4</option>
          <option value="A5">A5</option>
          <option value="80">حراري 80 مم</option>
        </select>
        <button
          onClick={() => {
            setPdfBusy(true);
            downloadQuotationPdf(q)
              .catch(() => setError('فشل إنشاء ملف PDF'))
              .finally(() => setPdfBusy(false));
          }}
          disabled={pdfBusy}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pdfBusy ? 'جاري التصدير...' : 'تصدير PDF'}
        </button>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-700"
        >
          طباعة
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-gray-200">
      {actions}
      <div
        className={`print-sheet mx-auto my-4 bg-white ${size === 'A4' ? 'w-a4' : size === 'A5' ? 'w-a5' : 'w-80'}`}
        dir="rtl"
      >
        <PrintHeader q={q} />
        <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="font-bold text-gray-500">العميل:</div>
            <div className="font-semibold">
              {q.customer.nameAr} <span className="font-mono text-xs text-gray-400">{q.customer.code}</span>
            </div>
          </div>
          <div>
            <div className="font-bold text-gray-500">المخزن:</div>
            <div className="font-semibold">{q.warehouse?.nameAr ?? '—'}</div>
          </div>
        </div>
        <table className="w-full border-collapse text-right">
          <thead>
            <tr className="border-y-2 border-black text-sm font-black">
              <th className="py-2">#</th>
              <th>الصنف</th>
              <th>الوحدة</th>
              <th>الكمية</th>
              <th>السعر</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {(q.lines ?? []).map((l, i) => (
              <tr key={l.id} className={`border-b border-gray-300 text-sm ${size === '80' ? 'text-[11px]' : ''}`}>
                <td className="px-2 py-1">{i + 1}</td>
                <td>
                  <div className="font-semibold">{l.item.nameAr}</div>
                  <div className="text-[10px] text-gray-500">{l.item.code}</div>
                </td>
                <td>{l.unit.code}</td>
                <td>{formatMoney(l.qty)}</td>
                <td>{formatMoney(l.unitPrice)}</td>
                <td>{formatMoney(l.netLine)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex justify-between gap-4 text-sm">
          <div className="space-y-1">
            <div className="font-bold">{formatArabicAmount(Number(q.net))}</div>
            {q.notes ? <div className="max-w-[280px] text-xs text-gray-600">ملاحظات: {q.notes}</div> : null}
          </div>
          <div className="min-w-56 text-sm">
            <Row label="الإجمالي الفرعي" value={formatMoney(q.subtotal)} />
            <Row label="الخصم" value={formatMoney(q.discountAmount)} />
            <Row label="النقل" value={formatMoney(q.shipping)} />
            <Row label={`الضريبة ${q.taxPercent}%`} value={formatMoney(q.taxAmount)} />
            <Row label="الصافي" value={formatMoney(q.net)} bold />
          </div>
        </div>
        <div className="mt-6 flex items-end justify-between gap-4 border-t border-black pt-4 text-xs">
          <div>المستلم / التوقيع ....................</div>
          <div className="text-center">المحاسب / المدير ....................</div>
          <div>التوقيع ....................</div>
        </div>
      </div>
      <style jsx>{`
        .w-a4 {
          width: 210mm;
          min-height: 297mm;
          padding: 12mm;
          font-size: 12px;
        }
        .w-a5 {
          width: 148mm;
          min-height: 210mm;
          padding: 8mm;
          font-size: 11px;
        }
        .w-80 {
          width: 80mm;
          padding: 4mm;
          font-size: 10px;
        }
        @media print {
          body {
            background: white !important;
          }
          .w-a4 {
            width: 210mm;
            min-height: 0;
          }
          .w-a5 {
            width: 148mm;
            min-height: 0;
          }
          .w-80 {
            width: 80mm;
          }
          @page {
            margin: 0;
          }
        }
      `}</style>
      {size === 'A5' ? (
        <style>{`@page { size: A5 portrait; margin: 0; }`}</style>
      ) : size === '80' ? (
        <style>{`@page { size: 80mm auto; margin: 0; }`}</style>
      ) : null}
    </div>
  );
}

function PrintHeader({ q }: { q: Quotation }) {
  return (
    <div className="mb-3 flex items-start justify-between border-b-2 border-black pb-3">
      <div>
        <div className="text-xl font-black">نظام بيان</div>
        <div className="text-xs text-gray-600">شركة تجارة الحدايد والبويات</div>
        <div className="text-[10px] text-gray-400">هاتف: 0100 000 0000 - info@company.com</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-black">عرض سعر</div>
        <div>الرقم: {q.number}</div>
        <div>التاريخ: {formatDate(q.date)}</div>
      </div>
    </div>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${bold ? 'border-t-2 border-black font-black' : 'border-t border-gray-200 pt-0.5'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
