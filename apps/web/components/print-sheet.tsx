'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { get, type CompanySettings } from '@/lib/api';

export type PrintSize = 'A4' | 'A5' | '80';

/** حجم ورقة الطباعة (حالة مشتركة بسيطة). */
export function usePrintSize() {
  const [size, setSize] = useState<PrintSize>('A4');
  return { size, setSize };
}

/** يجلب المستند للطباعة: null إذا كان path فارغاً. */
export function usePrintDoc<T>(path: string | null) {
  const [doc, setDoc] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    get<T>(path)
      .then((d) => {
        if (!cancelled) setDoc(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'تعذّر جلب المستند');
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return { doc, error };
}

/** طباعة تلقائية عند `?autoprint=1` بعد جهوزية المستند. */
export function useAutoPrint(enabled: boolean, ready: boolean) {
  useEffect(() => {
    if (enabled && ready) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [enabled, ready]);
}

/** يجلب بيانات الشركة لترويسة الطباعة. */
export function useCompanyHeader() {
  const [company, setCompany] = useState<CompanySettings['company'] | null>(null);
  useEffect(() => {
    get<CompanySettings>('/company')
      .then((d) => setCompany(d.company))
      .catch(() => undefined);
  }, []);
  return company;
}

/** شريط أدوات الطباعة (حجم الورقة + طباعة) — يختفي عند الطباعة. */
export function PrintToolbar({
  title,
  size,
  onSize,
  onPrint,
  extra,
}: {
  title: string;
  size: PrintSize;
  onSize: (size: PrintSize) => void;
  onPrint: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="print:hidden sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white p-3">
      <span className="text-lg font-black text-black">{title}</span>
      <div className="ms-auto flex items-center gap-2">
        {extra}
        <select
          value={size}
          onChange={(e) => onSize(e.target.value as PrintSize)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-black"
        >
          <option value="A4">A4</option>
          <option value="A5">A5</option>
          <option value="80">حراري 80 مم</option>
        </select>
        <button
          onClick={onPrint}
          className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-700"
        >
          طباعة
        </button>
      </div>
    </div>
  );
}

/**
 * ورقة الطباعة: ملصق بمقاس A4/A5/80مم + CSS الطباعة.
 * تُستدعى داخل حاوية بخلفية رمادية مع PrintToolbar فوقها.
 */
export function PrintSheet({ size, children }: { size: PrintSize; children: ReactNode }) {
  const cls = size === 'A4' ? 'bp-a4' : size === 'A5' ? 'bp-a5' : 'bp-80';
  return (
    <>
      <div className={`bp-sheet mx-auto my-4 bg-white ${cls}`} dir="rtl">
        {children}
      </div>
      <style>{`
        .bp-sheet { box-shadow: 0 1px 4px rgba(0,0,0,.15); }
        .bp-a4 { width: 210mm; min-height: 297mm; padding: 12mm; font-size: 12px; }
        .bp-a5 { width: 148mm; min-height: 210mm; padding: 8mm; font-size: 11px; }
        .bp-80 { width: 80mm; padding: 4mm; font-size: 10px; }
        @media print {
          body { background: white !important; }
          .bp-sheet { box-shadow: none; margin: 0; }
          .bp-a4 { width: 210mm; min-height: 0; }
          .bp-a5 { width: 148mm; min-height: 0; }
          .bp-80 { width: 80mm; }
          @page { margin: 0; }
        }
      `}</style>
      {size === 'A5' ? (
        <style>{`@page { size: A5 portrait; margin: 0; }`}</style>
      ) : size === '80' ? (
        <style>{`@page { size: 80mm auto; margin: 0; }`}</style>
      ) : null}
    </>
  );
}

/** ترويسة المستند: بيانات الشركة + عنوان المستند ورقمه وتاريخه. */
export function PrintDocHeader({
  title,
  number,
  date,
  dateLabel = 'التاريخ',
  extra,
}: {
  title: string;
  number?: string;
  date?: string;
  dateLabel?: string;
  extra?: ReactNode;
}) {
  const company = useCompanyHeader();
  return (
    <div className="mb-3 flex items-start justify-between border-b-2 border-black pb-3">
      <div>
        <div className="text-xl font-black">{company?.nameAr ?? '—'}</div>
        <div className="text-xs text-gray-600">إدارة المبيعات والمشتريات</div>
        {company?.phone || company?.email ? (
          <div className="text-[10px] text-gray-400">
            {company.phone ? `هاتف: ${company.phone}` : null}
            {company.phone && company.email ? ' — ' : null}
            {company.email ?? null}
          </div>
        ) : null}
      </div>
      <div className="text-center">
        <div className="text-2xl font-black">{title}</div>
        {number ? <div>الرقم: {number}</div> : null}
        {date ? <div>{dateLabel}: {date}</div> : null}
        {extra}
      </div>
    </div>
  );
}

/** سطر مجموع في كتلة الإجماليات. */
export function PrintTotalRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-3 ${
        bold ? 'border-t-2 border-black font-black' : 'border-t border-gray-200 pt-0.5'
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** تذييل التوقيعات الموحد. */
export function PrintSignatures() {
  return (
    <div className="mt-6 flex items-end justify-between gap-4 border-t border-black pt-4 text-xs">
      <div>المستلم / التوقيع ....................</div>
      <div className="text-center">المحاسب / المدير ....................</div>
      <div>التوقيع ....................</div>
    </div>
  );
}

/** تسميات الحالة الموحدة للمستندات. */
export const PRINT_STATUS: Record<string, string> = {
  DRAFT: 'مسودة',
  OPEN: 'مفتوح',
  COUNTING: 'جارٍ العد',
  REVIEW: 'مراجعة',
  APPROVED: 'معتمد',
  RECEIVED: 'مستلم',
  CLOSED: 'مغلق',
  CANCELLED: 'ملغي',
};
