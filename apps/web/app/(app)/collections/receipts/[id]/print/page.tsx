'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { type ReceiptDoc } from '@/lib/api';
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

const methodLabel: Record<string, string> = {
  CASH: 'نقدي',
  TRANSFER: 'تحويل',
  CHEQUE: 'شيك',
  VODAFONE_CASH: 'فودافون كاش',
  INSTAPAY: 'إنستاباي',
  WALLET: 'محفظة',
};

export default function ReceiptPrintPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const { size, setSize } = usePrintSize();
  const { doc, error } = usePrintDoc<ReceiptDoc>(params.id ? `/receipts/${params.id}` : null);
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
      <PrintToolbar title="طباعة سند قبض" size={size} onSize={setSize} onPrint={() => window.print()} />
      <PrintSheet size={size}>
        <PrintDocHeader title="سند قبض" number={doc.number} date={formatDate(doc.receivedAt)} dateLabel="التاريخ" />
        <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="font-bold text-gray-500">العميل:</div>
            <div className="font-semibold">
              {doc.customer.nameAr} <span className="font-mono text-xs text-gray-400">{doc.customer.code}</span>
            </div>
          </div>
          <div>
            <div className="font-bold text-gray-500">طريقة الدفع:</div>
            <div className="font-semibold">{methodLabel[doc.method] ?? doc.method}</div>
          </div>
          <div>
            <div className="font-bold text-gray-500">القيمة:</div>
            <div className="font-black text-lg">{formatMoney(doc.amount)}</div>
          </div>
        </div>

        {doc.cheque ? (
          <div className="mb-3 border border-gray-300 p-2 text-sm">
            <span className="font-bold">شيك: </span>
            #{doc.cheque.number} — {doc.cheque.bankName} — استحقاق {formatDate(doc.cheque.dueDate)}
          </div>
        ) : null}

        <table className="w-full border-collapse text-right">
          <thead>
            <tr className="border-y-2 border-black text-sm font-black">
              <th className="py-2">#</th>
              <th>البيان المرتبط</th>
              <th>قيمة الكشف</th>
              <th>المخصص</th>
            </tr>
          </thead>
          <tbody>
            {doc.allocations.length === 0 ? (
              <tr className="border-b border-gray-300 text-sm">
                <td className="px-2 py-1">1</td>
                <td colSpan={3}>على الحساب (بدون تخصيص على كشوف)</td>
              </tr>
            ) : (
              doc.allocations.map((a, i) => (
                <tr key={a.id} className={`border-b border-gray-300 text-sm ${size === '80' ? 'text-[11px]' : ''}`}>
                  <td className="px-2 py-1">{i + 1}</td>
                  <td>كشف #{a.statement?.number ?? a.statementId}</td>
                  <td>{a.statement ? formatMoney(a.statement.net) : '—'}</td>
                  <td className="font-semibold">{formatMoney(a.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="mt-2 flex justify-between gap-4 text-sm">
          <div className="space-y-1">
            {doc.notes ? <div className="max-w-[280px] text-xs text-gray-600">ملاحظات: {doc.notes}</div> : null}
          </div>
          <div className="min-w-56 text-sm">
            <PrintTotalRow label="إجمالي المخصص" value={formatMoney(doc.allocations.reduce((s, a) => s + Number(a.amount), 0))} />
            <PrintTotalRow label="قيمة السند" value={formatMoney(doc.amount)} bold />
          </div>
        </div>
        <PrintSignatures />
      </PrintSheet>
    </div>
  );
}
