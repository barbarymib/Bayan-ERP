'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { can, get, type PriceStatement, type StatementStatus } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  formatMoney,
  PageHeader,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@/components/ui';

const STATUS_LABEL: Record<StatementStatus, string> = {
  DRAFT: 'بانتظار الموافقة',
  PENDING_REVIEW: 'قيد المراجعة',
  APPROVED: 'معتمد',
  ARCHIVED: 'مؤرشف',
  CANCELLED: 'ملغي',
};

const STATUS_COLOR: Record<StatementStatus, string> = {
  DRAFT: 'blue',
  PENDING_REVIEW: 'blue',
  APPROVED: 'green',
  ARCHIVED: 'gray',
  CANCELLED: 'red',
};

export default function StatementDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const canPrint = can(user, 'statement.view');

  const [s, setS] = useState<PriceStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    get<PriceStatement>(`/price-statements/${params.id}`)
      .then((data) => {
        if (!cancelled) setS(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل بيان الأسعار');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        جارِ تحميل تفاصيل البيان…
      </div>
    );
  }

  if (error || !s) {
    return (
      <div className="space-y-4">
        <Link href="/statements" className="text-sm font-semibold text-blue-600 hover:underline">
          ← العودة لقائمة البيانات
        </Link>
        <ErrorBox message={error ?? 'البيان غير موجود'} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/statements"
              className="text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
            >
              ← بيانات الأسعار
            </Link>
            <span className="text-gray-300">/</span>
            <span className="font-mono text-xs font-bold text-gray-900">{s.number}</span>
          </div>
          <PageHeader
            title={`بيان أسعار: ${s.number}`}
            badge={<Badge color={STATUS_COLOR[s.status]}>{STATUS_LABEL[s.status]}</Badge>}
          />
        </div>

        <div className="flex items-center gap-2">
          {canPrint ? (
            <Link
              href={`/statements/${s.id}/print`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
            >
              🖨️ طباعة الفاتورة
            </Link>
          ) : null}
          <Link
            href="/statements"
            className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            إغلاق
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="text-xs font-bold text-gray-400 uppercase">بيانات العميل</div>
          <div className="mt-2 text-base font-black text-gray-900">{s.customer?.nameAr}</div>
          <div className="mt-1 font-mono text-xs text-gray-500">كود: {s.customer?.code}</div>
          {s.customer?.phone ? (
            <div className="mt-1 text-xs text-gray-600">الهاتف: {s.customer.phone}</div>
          ) : null}
        </Card>

        <Card>
          <div className="text-xs font-bold text-gray-400 uppercase">معلومات الفاتورة</div>
          <div className="mt-2 text-xs text-gray-700 space-y-1">
            <div>
              التاريخ: <strong className="font-mono">{new Date(s.date).toLocaleDateString('ar-EG')}</strong>
            </div>
            <div>
              طريقة الدفع: <strong>{s.paymentTerm === 'CASH' ? 'نقدي (كاش)' : 'آجل (ائتمان)'}</strong>
            </div>
            {s.warehouse ? (
              <div>
                المستودع: <strong>{s.warehouse.nameAr}</strong>
              </div>
            ) : null}
            {s.notes ? (
              <div className="text-gray-500 italic">ملاحظات: {s.notes}</div>
            ) : null}
          </div>
        </Card>

        <Card className="bg-slate-50 border-blue-200">
          <div className="text-xs font-bold text-blue-700 uppercase">ملخص المبالغ</div>
          <div className="mt-2 text-2xl font-black text-blue-950 font-mono">
            {formatMoney(s.net)} <span className="text-xs font-normal">ج.م</span>
          </div>
          <div className="mt-2 space-y-0.5 text-xs text-gray-600 border-t border-gray-200 pt-2">
            <div className="flex justify-between">
              <span>الإجمالي قبل الخصم:</span>
              <span className="font-mono">{formatMoney(s.subtotal)}</span>
            </div>
            {Number(s.discountAmount) > 0 ? (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>إجمالي الخصومات:</span>
                <span className="font-mono">-{formatMoney(s.discountAmount)}</span>
              </div>
            ) : null}
            {Number(s.taxAmount) > 0 ? (
              <div className="flex justify-between text-gray-700">
                <span>الضريبة ({s.taxPercent}%):</span>
                <span className="font-mono">+{formatMoney(s.taxAmount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-blue-900 font-bold pt-1 border-t border-blue-100">
              <span>المدفوع:</span>
              <span className="font-mono">{formatMoney(s.paid)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Lines Table */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-900">بنود الفاتورة ({s.lines?.length ?? 0})</h3>
        <Table>
          <Thead>
            <Th>#</Th>
            <Th>الصنف</Th>
            <Th>الوحدة</Th>
            <Th>الكمية</Th>
            <Th>سعر الوحدة</Th>
            <Th>الخصم</Th>
            <Th>الصافي</Th>
          </Thead>
          <Tbody>
            {s.lines?.map((line, idx) => (
              <Tr key={line.id ?? idx}>
                <Td className="font-mono text-gray-400">{idx + 1}</Td>
                <Td>
                  <div className="font-bold text-gray-900">{line.item?.nameAr}</div>
                  <div className="font-mono text-xs text-gray-400">{line.item?.code}</div>
                </Td>
                <Td>{line.unit?.nameAr ?? line.unit?.code}</Td>
                <Td className="font-mono font-semibold">{line.qty}</Td>
                <Td className="font-mono">{formatMoney(line.unitPrice)}</Td>
                <Td className="font-mono text-emerald-600">
                  {Number(line.lineDiscountAmount) > 0 ? formatMoney(line.lineDiscountAmount) : '—'}
                </Td>
                <Td className="font-mono font-black text-gray-900">{formatMoney(line.netLine)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}
