'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { type StockTransfer } from '@/lib/api';
import { ErrorBox, formatDate, formatMoney } from '@/components/ui';
import {
  PRINT_STATUS,
  PrintDocHeader,
  PrintSheet,
  PrintSignatures,
  PrintToolbar,
  PrintTotalRow,
  useAutoPrint,
  usePrintDoc,
  usePrintSize,
} from '@/components/print-sheet';

export default function TransferPrintPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const { size, setSize } = usePrintSize();
  const { doc, error } = usePrintDoc<StockTransfer>(params.id ? `/transfers/${params.id}` : null);
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

  const totalCost = (doc.lines ?? []).reduce((s, l) => s + (l.cost ? Number(l.qtyBase) * Number(l.cost) : 0), 0);
  const hasCost = (doc.lines ?? []).some((l) => l.cost != null);

  return (
    <div className="bg-gray-200">
      <PrintToolbar title="طباعة تحويل مخزني" size={size} onSize={setSize} onPrint={() => window.print()} />
      <PrintSheet size={size}>
        <PrintDocHeader
          title="تحويل مخزني"
          number={doc.number}
          date={formatDate(doc.date)}
          extra={<div className="text-xs text-gray-600">{PRINT_STATUS[doc.status] ?? doc.status}</div>}
        />
        <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="font-bold text-gray-500">من مخزن:</div>
            <div className="font-semibold">
              {doc.fromWarehouse.nameAr} <span className="font-mono text-xs text-gray-400">{doc.fromWarehouse.code}</span>
            </div>
          </div>
          <div>
            <div className="font-bold text-gray-500">إلى مخزن:</div>
            <div className="font-semibold">
              {doc.toWarehouse.nameAr} <span className="font-mono text-xs text-gray-400">{doc.toWarehouse.code}</span>
            </div>
          </div>
        </div>
        <table className="w-full border-collapse text-right">
          <thead>
            <tr className="border-y-2 border-black text-sm font-black">
              <th className="py-2">#</th>
              <th>الصنف</th>
              <th>الوحدة</th>
              <th>الكمية</th>
              {hasCost ? <th>التكلفة</th> : null}
              {hasCost ? <th>القيمة</th> : null}
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
                <td>{l.item?.baseUnit?.code ?? '—'}</td>
                <td>{formatMoney(l.qtyBase)}</td>
                {hasCost ? <td>{l.cost != null ? formatMoney(l.cost) : '—'}</td> : null}
                {hasCost ? <td>{l.cost != null ? formatMoney(Number(l.qtyBase) * Number(l.cost)) : '—'}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex justify-between gap-4 text-sm">
          <div className="space-y-1">
            {doc.notes ? <div className="max-w-[280px] text-xs text-gray-600">ملاحظات: {doc.notes}</div> : null}
          </div>
          {hasCost ? (
            <div className="min-w-56 text-sm">
              <PrintTotalRow label="إجمالي التكلفة" value={formatMoney(totalCost)} bold />
            </div>
          ) : null}
        </div>
        <PrintSignatures />
      </PrintSheet>
    </div>
  );
}
