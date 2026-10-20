'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  get,
  type CompanySettings,
  type CustomerStatement,
  type PriceStatement,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ErrorBox, formatDate, formatDateHijri, formatMoney } from '@/components/ui';
import { downloadStatementPdf, statementPdfBlob, type PrintCompany } from '@/lib/statement-pdf';
import { downloadBlob, shareFileOrWhatsApp, type WhatsAppLink } from '@/lib/share';
import { formatArabicAmount } from '@/lib/tafqit';

export default function StatementPrintPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const { user } = useAuth();
  const [statement, setStatement] = useState<PriceStatement | null>(null);
  const [outstanding, setOutstanding] = useState<number | null>(null);
  const [company, setCompany] = useState<PrintCompany>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [waUrl, setWaUrl] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [size, setSize] = useState<'A4' | 'A5' | '80'>('A4');
  const autoprint = search.get('autoprint') === '1';

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    get<PriceStatement>(`/price-statements/${params.id}`)
      .then((st) => {
        if (cancelled) return;
        setStatement(st);
        get<CustomerStatement>(`/collections/customers/${st.customer.id}/statement`)
          .then((kashf) => {
            if (!cancelled) setOutstanding(kashf.totalOutstanding);
          })
          .catch(() => {
            if (!cancelled) setOutstanding(null);
          });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل البيان');
      });
    // R4-C4: هوية الشركة الحقيقية بدل النصوص المثبتة في الترويسة.
    get<CompanySettings>('/company')
      .then((c) => {
        if (!cancelled) setCompany(c.company);
      })
      .catch(() => {
        if (!cancelled) setCompany(null);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  useEffect(() => {
    if (autoprint && statement) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [autoprint, statement]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <ErrorBox message={error} />
      </div>
    );
  }
  if (!statement || !user) {
    return <div className="p-8 text-center text-gray-400">جارِ التحميل…</div>;
  }

  const before = outstanding != null ? outstanding - Number(statement.net) : null;

  const shareWhatsApp = async () => {
    setShareBusy(true);
    setWaUrl(null);
    setShareNotice(null);
    try {
      const link = await get<WhatsAppLink>(`/whatsapp/statement/${statement.customer.id}`);
      const blob = await statementPdfBlob(statement, outstanding, company);
      const file = new File([blob], `${statement.number}.pdf`, { type: 'application/pdf' });
      const outcome = await shareFileOrWhatsApp({ text: link.text, url: link.url, file });
      if (outcome === 'shared') return;
      if (outcome === 'no-phone') {
        setShareNotice('لا يوجد رقم هاتف مسجّل لهذا العميل — تم تنزيل PDF، أرسله يدوياً');
        downloadBlob(file);
        return;
      }
      downloadBlob(file);
      setWaUrl(link.url);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setShareNotice(err instanceof Error ? err.message : 'تعذّرت المشاركة');
    } finally {
      setShareBusy(false);
    }
  };

  const actions = (
    <div className="print:hidden sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white p-3">
      <span className="text-lg font-black text-black">معاينة الطباعة</span>
      <div className="ms-auto flex items-center gap-2">
        <select
          value={size}
          onChange={(e) => setSize(e.target.value as 'A4' | 'A5' | '80')}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-black"
        >
          <option value="A4">A4</option>
          <option value="A5">A5</option>
          <option value="80">إيصال 80 مم</option>
        </select>
        <button
          onClick={() => {
            setPdfBusy(true);
            downloadStatementPdf(statement, outstanding, company)
              .catch(() => setError('تعذّر إنشاء ملف PDF'))
              .finally(() => setPdfBusy(false));
          }}
          disabled={pdfBusy}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pdfBusy ? 'جارٍ الإنشاء…' : 'تصدير PDF'}
        </button>
        <button
          onClick={() => void shareWhatsApp()}
          disabled={shareBusy}
          className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {shareBusy ? 'جارٍ الإنشاء…' : 'مشاركة واتساب'}
        </button>
        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-green-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-800"
          >
            فتح واتساب ← (تم تنزيل PDF، أرفقه بالرسالة)
          </a>
        ) : null}
        {shareNotice ? (
          <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">{shareNotice}</span>
        ) : null}
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
        <PrintHeader statement={statement} company={company} />
        <table className="w-full border-collapse text-right">
          <thead>
            <tr className="border-y-2 border-black text-sm font-black">
              <th className="py-2">#</th>
              <th>الصنف</th>
              <th>الوحدة</th>
              <th>الكمية</th>
              <th>السعر</th>
              <th>الخصم</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {statement.lines.map((l, i) => (
              <tr key={l.id} className={`border-b border-gray-300 text-sm ${size === '80' ? 'text-[11px]' : ''}`}>
                <td className="px-2 py-1">{i + 1}</td>
                <td>
                  <div className="font-semibold">{l.item.nameAr}</div>
                  <div className="text-[10px] text-gray-500">{l.item.code}</div>
                  {l.weightNote ? (
                    <div className="text-[10px] text-amber-700">وزن فعلي: {l.weightNote}</div>
                  ) : null}
                </td>
                <td>{l.unit.code}</td>
                <td>{formatMoney(l.qty)}</td>
                <td>{formatMoney(l.unitPrice)}</td>
                <td>{formatMoney(l.lineDiscountAmount)}</td>
                <td>{formatMoney(l.netLine)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex justify-between gap-4 text-sm">
          <div className="space-y-1">
            <div className="font-bold">{formatArabicAmount(Number(statement.net))}</div>
            {before != null ? (
              <div className="text-xs text-gray-600">
                الرصيد قبل البيان: {formatMoney(before)} — بعد: {formatMoney(before + Number(statement.net))}
              </div>
            ) : null}
            {statement.notes ? <div className="max-w-[280px] text-xs text-gray-600">ملاحظات: {statement.notes}</div> : null}
          </div>
          <div className="min-w-56 text-sm">
            <Row label="الإجمالي الفرعي" value={formatMoney(statement.subtotal)} />
            <Row label="خصم البيان" value={formatMoney(statement.discountAmount)} />
            <Row label="النقل" value={formatMoney(statement.shipping)} />
            <Row label="الضريبة" value={formatMoney(statement.taxAmount)} />
            <Row label="الصافي" value={formatMoney(statement.net)} bold />
            <Row label="المدفوع" value={formatMoney(statement.paid)} />
            <Row label="المتبقي" value={formatMoney(Number(statement.net) - Number(statement.paid))} bold />
          </div>
        </div>
        <div className="mt-6 flex items-end justify-between gap-4 border-t border-black pt-4 text-xs">
          <div>المستلم / التوقيع ....................</div>
          <div className="text-center">
            {statement.status === 'APPROVED' ? (
              <div className="mb-1 font-black text-green-700">معتمد ✓</div>
            ) : null}
            <div>المحاسب / المدير ....................</div>
          </div>
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

function PrintHeader({ statement, company }: { statement: PriceStatement; company: PrintCompany }) {
  return (
    <div className="mb-3 flex items-start justify-between border-b-2 border-black pb-3">
      <div>
        {company?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logoUrl}
            alt={company.nameAr}
            className="mb-1 h-14 w-14 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : null}
        <div className="text-xl font-black">نظام بيان</div>
        <div className="text-xs text-gray-600">{company?.nameAr ?? 'بيان'}</div>
        <div className="text-[10px] text-gray-400">
          {[company?.phone ? `هاتف: ${company.phone}` : null, company?.email ?? null].filter(Boolean).join(' — ')}
        </div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-black">بيان أسعار</div>
        <div>الرقم: {statement.number}</div>
        <div>التاريخ: {formatDate(statement.date)}</div>
        {/* R4-B11: التاريخ الهجري بجانب الميلادي (§9). */}
        <div className="text-[10px] text-gray-500">هجري: {formatDateHijri(statement.date)}</div>
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