'use client';

import { useEffect, useState } from 'react';
import { can, get, post, type Approval } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  Button,
  ErrorBox,
  Field,
  Modal,
  Notice,
  PageHeader,
  Select,
  Td,
  TextInput,
  Th,
  formatDate,
} from '@/components/ui';

const typePermission: Record<string, string> = {
  ITEM_DISCOUNT: 'discount.approve',
  HEADER_DISCOUNT: 'discount.approve',
  BELOW_COST: 'discount.approve',
  BELOW_MIN_PRICE: 'discount.approve',
  RETURN: 'return.approve',
  CREDIT_LIMIT: 'credit.exception.approve',
};

const typeLabel: Record<string, string> = {
  ITEM_DISCOUNT: 'خصم بند',
  HEADER_DISCOUNT: 'خصم بيان',
  BELOW_COST: 'بيع أقل من التكلفة',
  BELOW_MIN_PRICE: 'بيع أقل من أدنى سعر',
  RETURN: 'مرتجع',
  CREDIT_LIMIT: 'استثناء تجاوز الحد الائتماني',
};

const typeColor: Record<string, string> = {
  ITEM_DISCOUNT: 'blue',
  HEADER_DISCOUNT: 'blue',
  BELOW_COST: 'red',
  BELOW_MIN_PRICE: 'red',
  RETURN: 'gray',
  CREDIT_LIMIT: 'amber',
};

const statusLabel: Record<string, string> = {
  PENDING: 'بانتظار',
  APPROVED: 'معتمد',
  REJECTED: 'مرفوض',
};

const statusColor: Record<string, string> = {
  PENDING: 'blue',
  APPROVED: 'green',
  REJECTED: 'red',
};

export default function ApprovalsPage() {
  const { user } = useAuth();
  const canApprove =
    can(user, 'discount.approve') || can(user, 'return.approve') || can(user, 'credit.exception.approve');

  const [rows, setRows] = useState<Approval[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [decideRow, setDecideRow] = useState<Approval | null>(null);

  useEffect(() => {
    if (!canApprove) return;
    let cancelled = false;
    get<{ items: Approval[] }>(`/approvals${status ? `?status=${status}` : ''}`)
      .then((d) => {
        if (!cancelled) {
          setRows(d.items);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل طلبات الموافقة');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, refresh, canApprove]);

  return (
    <div>
      <PageHeader title="الموافقات" />

      {!canApprove ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          ليست لديك صلاحية الموافقة على الخصومات أو المرتجعات.
        </div>
      ) : (
        <>
          {notice ? (
            <div className="mb-3">
              <Notice type="success">{notice}</Notice>
            </div>
          ) : null}

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Field label="الحالة">
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
                <option value="">بانتظار (الافتراضي)</option>
                <option value="PENDING">بانتظار</option>
                <option value="APPROVED">معتمد</option>
                <option value="REJECTED">مرفوض</option>
              </Select>
            </Field>
            <Button variant="secondary" onClick={() => setRefresh((x) => x + 1)}>
              تحديث
            </Button>
            <span className="text-sm text-gray-500">{rows.length} طلب</span>
          </div>

          {error ? <ErrorBox message={error} onRetry={() => setRefresh((x) => x + 1)} /> : null}

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-max border-collapse">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <Th>النوع</Th>
                  <Th>المستند</Th>
                  <Th>مقدم الطلب</Th>
                  <Th>التاريخ</Th>
                  <Th>الحالة</Th>
                  <Th>إجراء</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <Td className="py-6 text-center text-gray-400">جارِ التحميل…</Td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <Td className="py-6 text-center text-gray-400">لا توجد طلبات</Td>
                  </tr>
                ) : (
                  rows.map((a) => (
                    <tr key={a.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <Td>
                        <Badge color={typeColor[a.type]}>{typeLabel[a.type]}</Badge>
                      </Td>
                      <Td>
                        {a.document ? (
                          <div>
                            <span className="font-mono font-semibold">{a.document.number}</span>
                            <span className="text-xs text-gray-400"> ({a.document.label})</span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td>{a.requestedBy?.name ?? '—'}</Td>
                      <Td>{formatDate(a.createdAt)}</Td>
                      <Td>
                        <Badge color={statusColor[a.status]}>{statusLabel[a.status]}</Badge>
                      </Td>
                      <Td className="text-end">
                        {a.status === 'PENDING' && can(user, typePermission[a.type] ?? 'discount.approve') ? (
                          <Button variant="ghost" onClick={() => setDecideRow(a)}>
                            اعتماد / رفض
                          </Button>
                        ) : null}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {decideRow ? (
        <DecideModal
          approval={decideRow}
          onClose={() => setDecideRow(null)}
          onDone={() => {
            setDecideRow(null);
            setNotice(`تم البت في الطلب #${decideRow.id}`);
            setRefresh((x) => x + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function DecideModal({
  approval,
  onClose,
  onDone,
}: {
  approval: Approval;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approved: boolean) {
    setBusy(true);
    setError(null);
    try {
      await post(`/approvals/${approval.id}/decide`, {
        approved,
        note: note.trim() || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل البت في الطلب');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`${typeLabel[approval.type]} — ${approval.document?.number ?? `طلب #${approval.id}`}`}
      onClose={onClose}
    >
      <div className="mb-3 text-sm text-gray-600">
        مقدم الطلب: {approval.requestedBy?.name ?? '—'} • {formatDate(approval.createdAt)}
      </div>
      {approval.refJson ? (
        <div className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          <pre dir="ltr" className="whitespace-pre-wrap">
            {JSON.stringify(approval.refJson, null, 2)}
          </pre>
        </div>
      ) : null}
      <Field label="ملاحظة (اختياري)">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="سبب الموافقة أو الرفض" />
      </Field>
      {error ? (
        <div className="mb-3">
          <ErrorBox message={error} />
        </div>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          تراجع
        </Button>
        <Button
          variant="danger"
          onClick={() => void decide(false)}
          disabled={busy || !can(user, typePermission[approval.type] ?? 'discount.approve')}
        >
          رفض
        </Button>
        <Button onClick={() => void decide(true)} disabled={busy}>
          {busy ? 'جارِ الحفظ…' : 'اعتماد'}
        </Button>
      </div>
    </Modal>
  );
}