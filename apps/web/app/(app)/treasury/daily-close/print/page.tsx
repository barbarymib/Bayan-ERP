'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { get, type DailyCloseRow } from '@/lib/api';
import { ErrorBox, formatDate, formatMoney } from '@/components/ui';
import {
  PrintDocHeader,
  PrintSheet,
  PrintSignatures,
  PrintToolbar,
  PrintTotalRow,
  useAutoPrint,
  usePrintSize,
} from '@/components/print-sheet';
import { useEffect } from 'react';

export default function DailyClosePrintPage() {
  const search = useSearchParams();
  const { size, setSize } = usePrintSize();
  const [rows, setRows] = useState<DailyCloseRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dateParam = search.get('date');
  const autoprint = search.get('autoprint') === '1';

  useEffect(() => {
    let cancelled = false;
    get<DailyCloseRow[]>('/treasury/daily-close')
      .then((all) => {
        if (cancelled) return;
        const wanted = dateParam ? String(dateParam).slice(0, 10) : null;
        const filtered = wanted ? all.filter((r) => r.date.slice(0, 10) === wanted) : all.slice(0, 1);
        setRows(filtered);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'تعذّر جلب الإقفالات');
      });
    return () => {
      cancelled = true;
    };
  }, [dateParam]);

  const doc = rows && rows.length > 0 ? rows[0] : null;
  useAutoPrint(autoprint, !!doc);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <ErrorBox message={error} />
      </div>
    );
  }
  if (!rows) {
    return <div className="p-8 text-center text-gray-400">جاري التحميل...</div>;
  }
  if (!doc) {
    return <div className="p-8 text-center text-gray-400">لا يوجد إقفال يومي في هذا التاريخ</div>;
  }

  return (
    <div className="bg-gray-200">
      <PrintToolbar title="طباعة إقفال يومي" size={size} onSize={setSize} onPrint={() => window.print()} />
      <PrintSheet size={size}>
        <PrintDocHeader title="إقفال يومي للخزينة" date={formatDate(doc.date)} />
        <div className="min-w-64 text-sm">
          <PrintTotalRow label="الرصيد الافتتاحي" value={formatMoney(doc.openingBalance)} />
          <PrintTotalRow label="المقبوضات (سندات القبض)" value={formatMoney(doc.receiptsTotal)} />
          <PrintTotalRow label="المدفوعات (سندات الصرف)" value={formatMoney(doc.paymentsTotal)} />
          <PrintTotalRow label="تسليمات العهد" value={formatMoney(doc.handoversTotal)} />
          <PrintTotalRow label="الرصيد الختامي" value={formatMoney(doc.closingBalance)} bold />
          <PrintTotalRow label="الرصيد المعدود" value={doc.countedBalance != null ? formatMoney(doc.countedBalance) : '—'} />
          <PrintTotalRow label="الفرق" value={doc.difference != null ? formatMoney(doc.difference) : '—'} bold />
        </div>
        {doc.notes ? <div className="mt-3 text-xs text-gray-600">ملاحظات: {doc.notes}</div> : null}
        <PrintSignatures />
      </PrintSheet>
    </div>
  );
}
