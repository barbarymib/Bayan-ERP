'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { type SupplierReturnDoc } from '@/lib/api';
import { ErrorBox, formatDate, formatMoney } from '@/components/ui';
import {
  PrintDocHeader,
  PrintSheet,
  PrintSignatures,
  PrintToolbar,
  PrintTotalRow,
  useAutoPrint,
  usePrintDoc,
  usePrintSize,
} from '@/components/print-sheet';

export default function SupplierReturnPrintPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const { size, setSize } = usePrintSize();
  const { doc, error } = usePrintDoc<SupplierReturnDoc>(params.id ? `/supplier-returns/${params.id}` : null);
  const autoprint = search.get('autoprint') === '1';
  useAutoPrint(autoprint, !!doc);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <ErrorBox message={error} />
      </div>
    );
  }
  if (!doc) {
    return <div className="p-8 text-center text-gray-400">جاري التحميل...</div>;
  }

  return (
    <div className="bg-gray-200">
      <PrintToolbar title="طباعة إرجاع مشتريات" size={size} onSize={setSize} onPrint={() => window.print()} />
      <PrintSheet size={size}>
        <PrintDocHeader title="إرجاع مشتريات" number={doc.number} date={formatDate(doc.date)} />
        <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="font-bold text-gray-500">المورد:</div>
            <div className="font-semibold">
              {doc.supplier.nameAr} <span className="font-mono text-xs text-gray-400">{doc.supplier.code}</span>
            </div>
          </div>
          <div>
            <div className="font-bold text-gray-500">المخزن:</div>
            <div className="font-semibold">{doc.warehouse?.nameAr ?? '—'}</div>
          </div>
          <div>
            <div className="font-bold text-gray-500">السبب:</div>
            <div className="font-semibold">{doc.reason ?? '—'}</div>
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
            {(doc.lines ?? []).map((l, i) => (
              <tr key={l.id ?? i} className={`border-b border-gray-300 text-sm ${size === '80' ? 'text-[11px]' : ''}`}>
                <td className="px-2 py-1">{i + 1}</td>
                <td>
                  <div className="font-semibold">{l.item?.nameAr ?? '—'}</div>
                  <div className="text-[10px] text-gray-500">{l.item?.code}</div>
                </td>
                <td>{l.unit?.code ?? '—'}</td>
                <td>{formatMoney(l.qty)}</td>
                <td>{formatMoney(l.unitPrice)}</td>
                <td>{l.lineTotal != null ? formatMoney(l.lineTotal) : formatMoney(Number(l.qty) * Number(l.unitPrice))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex justify-between gap-4 text-sm">
          <div className="space-y-1">
            {doc.notes ? <div className="max-w-[280px] text-xs text-gray-600">ملاحظات: {doc.notes}</div> : null}
          </div>
          <div className="min-w-56 text-sm">
            <PrintTotalRow label="الإجمالي" value={formatMoney(doc.total)} bold />
          </div>
        </div>
        <PrintSignatures />
      </PrintSheet>
    </div>
  );
}
