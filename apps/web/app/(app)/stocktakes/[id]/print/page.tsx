'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { type StocktakeSession } from '@/lib/api';
import { ErrorBox, formatDate, formatMoney, toArabicNumerals } from '@/components/ui';
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

export default function StocktakePrintPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const { size, setSize } = usePrintSize();
  const { doc, error } = usePrintDoc<StocktakeSession>(params.id ? `/stocktakes/${params.id}` : null);
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

  const s = doc.summary;

  return (
    <div className="bg-gray-200">
      <PrintToolbar title="طباعة جرد مخزني" size={size} onSize={setSize} onPrint={() => window.print()} />
      <PrintSheet size={size}>
        <PrintDocHeader
          title="جرد مخزني"
          number={doc.number}
          date={formatDate(doc.openedAt)}
          dateLabel="تاريخ الفتح"
          extra={<div className="text-xs text-gray-600">{PRINT_STATUS[doc.status] ?? doc.status}</div>}
        />
        <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="font-bold text-gray-500">المخزن:</div>
            <div className="font-semibold">
              {doc.warehouse.nameAr} <span className="font-mono text-xs text-gray-400">{doc.warehouse.code}</span>
            </div>
          </div>
          <div>
            <div className="font-bold text-gray-500">أمين الجرد:</div>
            <div className="font-semibold">{doc.openedBy.name}</div>
          </div>
          <div>
            <div className="font-bold text-gray-500">المعتمد:</div>
            <div className="font-semibold">{doc.approvedBy?.name ?? '—'}</div>
          </div>
        </div>
        <table className="w-full border-collapse text-right">
          <thead>
            <tr className="border-y-2 border-black text-sm font-black">
              <th className="py-2">#</th>
              <th>الصنف</th>
              <th>الدفترية</th>
              <th>المعدودة</th>
              <th>الفرق</th>
              <th>قيمة الفرق</th>
              <th>العدّاد</th>
            </tr>
          </thead>
          <tbody>
            {(doc.lines ?? []).map((l, i) => (
              <tr key={l.id} className={`border-b border-gray-300 text-sm ${size === '80' ? 'text-[11px]' : ''}`}>
                <td className="px-2 py-1">{i + 1}</td>
                <td>
                  <div className="font-semibold">{l.item.nameAr}</div>
                  <div className="text-[10px] text-gray-500">{l.item.code}</div>
                </td>
                <td>
                  {formatMoney(l.systemQtyBase)}
                  {l.systemQtyComposite ? (
                    <div className="text-[10px] text-gray-600">{toArabicNumerals(l.systemQtyComposite)}</div>
                  ) : null}
                </td>
                <td>
                  {l.countedQtyBase != null ? formatMoney(l.countedQtyBase) : 'لم يُعد'}
                  {l.countedQtyComposite ? (
                    <div className="text-[10px] text-gray-600">{toArabicNumerals(l.countedQtyComposite)}</div>
                  ) : null}
                </td>
                <td className={l.diffQty > 0 ? 'text-red-700' : l.diffQty < 0 ? 'text-blue-700' : ''}>
                  {l.diffQty > 0 ? `+${formatMoney(l.diffQty)}` : formatMoney(l.diffQty)}
                </td>
                <td>{formatMoney(l.diffValue)}</td>
                <td>{l.countedBy?.name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex justify-between gap-4 text-sm">
          <div className="space-y-1">
            {doc.notes ? <div className="max-w-[280px] text-xs text-gray-600">ملاحظات: {doc.notes}</div> : null}
          </div>
          {s ? (
            <div className="min-w-56 text-sm">
              <PrintTotalRow label="أصناف فائضة" value={`${s.surplusLines} — ${formatMoney(s.surplusValue)}`} />
              <PrintTotalRow label="أصناف منقوصة" value={`${s.deficitLines} — ${formatMoney(s.deficitValue)}`} />
              <PrintTotalRow label="صافي قيمة الفرق" value={formatMoney(s.totalDiffValue)} bold />
            </div>
          ) : null}
        </div>
        <PrintSignatures />
      </PrintSheet>
    </div>
  );
}
