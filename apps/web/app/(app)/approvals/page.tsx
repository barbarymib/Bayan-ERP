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
  formatMoney,
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
                        ) : (
                          <Button variant="ghost" onClick={() => setDecideRow(a)}>
                            عرض التفاصيل
                          </Button>
                        )}
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

  const isPending = approval.status === 'PENDING';
  const hasApprovePerm = can(user, typePermission[approval.type] ?? 'discount.approve');

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
      {/* Header Info Banner */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-xs text-gray-700">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-500">مقدم الطلب:</span>
          <span className="font-bold text-gray-900">{approval.requestedBy?.name ?? '—'}</span>
          {approval.requestedBy?.repCode ? (
            <span className="rounded bg-gray-200/60 px-1.5 py-0.5 font-mono text-[11px] text-gray-600">
              {approval.requestedBy.repCode}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-gray-500">
          <span>التاريخ: {formatDate(approval.createdAt)}</span>
          <Badge color={statusColor[approval.status]}>{statusLabel[approval.status]}</Badge>
        </div>
      </div>

      {/* Decision Status if already finalized */}
      {!isPending && (
        <div
          className={`mb-4 rounded-xl border p-3 text-xs ${
            approval.status === 'APPROVED'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            <span>{approval.status === 'APPROVED' ? '✓ تم اعتماد هذا الطلب' : '✕ تم رفض هذا الطلب'}</span>
            {approval.decidedBy?.name && (
              <span className="text-xs font-normal">بواسطة: {approval.decidedBy.name}</span>
            )}
            {approval.decidedAt && (
              <span className="text-xs font-normal text-gray-500">({formatDate(approval.decidedAt)})</span>
            )}
          </div>
          {approval.note && (
            <div className="mt-1.5 rounded-lg bg-white/70 p-2 text-xs font-medium text-gray-800">
              ملاحظة البت: {approval.note}
            </div>
          )}
        </div>
      )}

      {/* Detailed Structured Information based on approval type */}
      <ApprovalDetailsView approval={approval} />

      {/* Decision Input if still pending */}
      {isPending && hasApprovePerm && (
        <div className="mt-4">
          <Field label="ملاحظة أو سبب القرار (اختياري)">
            <TextInput
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="اكتب ملاحظة توضح سبب الموافقة أو الرفض..."
            />
          </Field>
        </div>
      )}

      {error ? (
        <div className="mt-3">
          <ErrorBox message={error} />
        </div>
      ) : null}

      <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-3">
        {isPending && hasApprovePerm ? (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              تراجع
            </Button>
            <Button
              variant="danger"
              onClick={() => void decide(false)}
              disabled={busy}
            >
              {busy ? 'جارِ الحفظ…' : 'رفض الطلب'}
            </Button>
            <Button onClick={() => void decide(true)} disabled={busy}>
              {busy ? 'جارِ الحفظ…' : 'اعتماد الطلب'}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            إغلاق
          </Button>
        )}
      </div>
    </Modal>
  );
}

interface ViolationLine {
  itemCode: string;
  itemName?: string;
  unitPrice: number;
  threshold: number;
}

function ApprovalDetailsView({ approval }: { approval: Approval }) {
  const ref = (approval.refJson ?? {}) as Record<string, any>;
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});

  // Client-side fallback to lookup item names if missing
  useEffect(() => {
    const codesToFetch: string[] = [];
    if (Array.isArray(ref.lines)) {
      for (const line of ref.lines) {
        if (line?.itemCode && (!line.itemName || line.itemName === line.itemCode)) {
          codesToFetch.push(String(line.itemCode));
        }
      }
    }
    if (ref.itemCode && (!ref.itemName || ref.itemName === ref.itemCode)) {
      codesToFetch.push(String(ref.itemCode));
    }

    if (codesToFetch.length === 0) return;

    let cancelled = false;
    Promise.all(
      Array.from(new Set(codesToFetch)).map(async (code) => {
        try {
          const res = await get<{ items: Array<{ code: string; nameAr: string }> }>(
            `/items?q=${encodeURIComponent(code)}&limit=1`,
          );
          const matched = res.items?.find((x) => x.code.toLowerCase() === code.toLowerCase()) ?? res.items?.[0];
          return { code, name: matched?.nameAr };
        } catch {
          return { code, name: undefined };
        }
      }),
    ).then((results) => {
      if (!cancelled) {
        const map: Record<string, string> = {};
        for (const r of results) {
          if (r.name) map[r.code] = r.name;
        }
        setResolvedNames(map);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [approval]);

  if (!approval.refJson) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 text-center text-xs text-gray-500">
        لا توجد تفاصيل إضافية مسجلة لهذا الطلب.
      </div>
    );
  }

  // 1. بيع أقل من التكلفة (BELOW_COST)
  if (approval.type === 'BELOW_COST') {
    const lines = (Array.isArray(ref.lines) ? ref.lines : []) as ViolationLine[];
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-950">
          <div className="flex items-center gap-2 font-bold text-sm text-red-800">
            <span className="text-base">⚠️</span>
            <span>تنبيه: يتضمن هذا الطلب بيع أصناف بسعر أقل من سعر التكلفة</span>
          </div>
          <p className="mt-1 text-xs text-red-700 leading-relaxed">
            الموافقة تعني اعتماد بيع الأصناف الموضحة أدناه بخسارة مباشرة عن تكلفة الشراء الأخيرة.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-full border-collapse text-right text-xs">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3.5 py-2.5 font-bold">الصنف</th>
                <th className="px-3 py-2.5 font-bold">سعر البيع المطلوب</th>
                <th className="px-3 py-2.5 font-bold">سعر التكلفة</th>
                <th className="px-3 py-2.5 font-bold">فرق الخسارة / الوحدة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-400">
                    لم تُسجل بنود تفصيلية
                  </td>
                </tr>
              ) : (
                lines.map((line, idx) => {
                  const unitPrice = Number(line.unitPrice) || 0;
                  const cost = Number(line.threshold) || 0;
                  const loss = cost - unitPrice;
                  const lossPct = cost > 0 ? (loss / cost) * 100 : 0;
                  const displayName =
                    line.itemName && line.itemName !== line.itemCode
                      ? line.itemName
                      : resolvedNames[line.itemCode] ?? line.itemCode;

                  return (
                    <tr key={idx} className="hover:bg-red-50/30 transition-colors">
                      <td className="px-3.5 py-2.5">
                        <div className="font-bold text-gray-900 text-sm">{displayName}</div>
                        <div className="font-mono text-[11px] text-gray-500">{line.itemCode}</div>
                      </td>
                      <td className="px-3 py-2.5 font-bold text-gray-900">
                        {formatMoney(unitPrice)} ج
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-600">
                        {formatMoney(cost)} ج
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 font-bold text-red-700">
                          - {formatMoney(loss)} ج ({lossPct.toFixed(1)}%)
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 2. بيع أقل من أدنى سعر (BELOW_MIN_PRICE)
  if (approval.type === 'BELOW_MIN_PRICE') {
    const lines = (Array.isArray(ref.lines) ? ref.lines : []) as ViolationLine[];
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
            <span className="text-base">⚠️</span>
            <span>تنبيه: يتضمن هذا الطلب بيع أصناف بسعر أقل من الحد الأدنى للبيع</span>
          </div>
          <p className="mt-1 text-xs text-amber-700 leading-relaxed">
            الأسعار المعروضة أدناه تقل عن الحد الأدنى المعتمد المحدد للصنف في النظام.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-full border-collapse text-right text-xs">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3.5 py-2.5 font-bold">الصنف</th>
                <th className="px-3 py-2.5 font-bold">سعر البيع المطلوب</th>
                <th className="px-3 py-2.5 font-bold">الحد الأدنى للسعر</th>
                <th className="px-3 py-2.5 font-bold">مقدار النقص</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-400">
                    لم تُسجل بنود تفصيلية
                  </td>
                </tr>
              ) : (
                lines.map((line, idx) => {
                  const unitPrice = Number(line.unitPrice) || 0;
                  const minPrice = Number(line.threshold) || 0;
                  const delta = minPrice - unitPrice;
                  const displayName =
                    line.itemName && line.itemName !== line.itemCode
                      ? line.itemName
                      : resolvedNames[line.itemCode] ?? line.itemCode;

                  return (
                    <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-3.5 py-2.5">
                        <div className="font-bold text-gray-900 text-sm">{displayName}</div>
                        <div className="font-mono text-[11px] text-gray-500">{line.itemCode}</div>
                      </td>
                      <td className="px-3 py-2.5 font-bold text-gray-900">
                        {formatMoney(unitPrice)} ج
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-600">
                        {formatMoney(minPrice)} ج
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 font-bold text-amber-800">
                          - {formatMoney(delta)} ج
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 3. خصم بند (ITEM_DISCOUNT)
  if (approval.type === 'ITEM_DISCOUNT') {
    const itemCode = ref.itemCode ? String(ref.itemCode) : '';
    const displayName =
      ref.itemName && ref.itemName !== itemCode ? ref.itemName : resolvedNames[itemCode] ?? itemCode;
    const discountVal = ref.discount?.value != null ? Number(ref.discount.value) : null;
    const isPercent =
      ref.discount?.type === 'PERCENT' ||
      ref.discount?.type === 'percent' ||
      ref.discount?.type === 'pct';
    const effectivePct = ref.effectivePercent != null ? Number(ref.effectivePercent) : null;
    const limitPct = ref.userLimitPct != null ? Number(ref.userLimitPct) : 0;
    const excessPct = effectivePct != null ? Math.max(0, effectivePct - limitPct) : 0;

    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-950">
          <div className="flex items-center gap-2 font-bold text-sm text-blue-800">
            <span className="text-base">🏷️</span>
            <span>تنبيه: نسبة الخصم المطلوبة للصنف تتجاوز الحد المسموح به للمندوب</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <span className="text-gray-500 block mb-1">الصنف المطلوب</span>
            <div className="font-bold text-gray-900 text-sm">{displayName}</div>
            {itemCode && <div className="font-mono text-[11px] text-gray-400 mt-0.5">{itemCode}</div>}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <span className="text-gray-500 block mb-1">الخصم المطلوب</span>
            <div className="font-bold text-blue-700 text-sm">
              {discountVal != null
                ? isPercent
                  ? `${discountVal}%`
                  : `${formatMoney(discountVal)} ج`
                : '—'}
            </div>
            {effectivePct != null && !isPercent && (
              <div className="text-[11px] text-gray-500 mt-0.5">
                النسبة الفعلية المحسوبة: <strong>{effectivePct}%</strong>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <span className="text-gray-500 block mb-1">الحد الأقصى لصلاحية المندوب</span>
            <div className="font-bold text-gray-800 text-sm">{limitPct}%</div>
          </div>

          <div className="rounded-xl border border-red-100 bg-red-50/50 p-3">
            <span className="text-red-700 block mb-1">نسبة التجاوز عن الصلاحية</span>
            <div className="font-bold text-red-700 text-sm">+{excessPct.toFixed(1)}%</div>
          </div>
        </div>
      </div>
    );
  }

  // 4. خصم بيان (HEADER_DISCOUNT)
  if (approval.type === 'HEADER_DISCOUNT') {
    const discountVal = ref.discount?.value != null ? Number(ref.discount.value) : null;
    const isPercent =
      ref.discount?.type === 'PERCENT' ||
      ref.discount?.type === 'percent' ||
      ref.discount?.type === 'pct';
    const limitPct = ref.userLimitPct != null ? Number(ref.userLimitPct) : 0;

    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-950">
          <div className="flex items-center gap-2 font-bold text-sm text-blue-800">
            <span className="text-base">🏷️</span>
            <span>تنبيه: الخصم الإجمالي على الفاتورة يتجاوز الحد المسموح به للمندوب</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <span className="text-gray-500 block mb-1">خصم الفاتورة المطلوب</span>
            <div className="font-bold text-blue-700 text-sm">
              {discountVal != null
                ? isPercent
                  ? `${discountVal}%`
                  : `${formatMoney(discountVal)} ج`
                : '—'}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <span className="text-gray-500 block mb-1">الحد الأقصى لصلاحية المندوب</span>
            <div className="font-bold text-gray-800 text-sm">{limitPct}%</div>
          </div>
        </div>
      </div>
    );
  }

  // 5. تجاوز الحد الائتماني (CREDIT_LIMIT)
  if (approval.type === 'CREDIT_LIMIT') {
    const projected = Number(ref.projected) || 0;
    const limit = Number(ref.limit) || 0;
    const breachAmount = Math.max(0, projected - limit);

    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
            <span className="text-base">💳</span>
            <span>تنبيه: رصيد العميل سيتجاوز الحد الائتماني المعتمد</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <span className="text-gray-500 block mb-1">الرصيد المتوقع بعد البيان</span>
            <div className="font-bold text-gray-900 text-sm">{formatMoney(projected)} ج</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <span className="text-gray-500 block mb-1">الحد الائتماني المعتمد</span>
            <div className="font-bold text-gray-700 text-sm">{formatMoney(limit)} ج</div>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50 p-3">
            <span className="text-red-700 block mb-1">مبلغ التجاوز</span>
            <div className="font-bold text-red-700 text-sm">+{formatMoney(breachAmount)} ج</div>
          </div>
        </div>
      </div>
    );
  }

  // 6. مرتجع (RETURN)
  if (approval.type === 'RETURN') {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-900">
          <div className="flex items-center gap-2 font-bold text-sm text-gray-800">
            <span className="text-base">↩️</span>
            <span>بيانات المرتجع المطلوب اعتماده</span>
          </div>
          {ref.withoutStatement && (
            <p className="mt-1 text-xs text-amber-700 font-semibold">
              تنبيه: هذا المرتجع مسجل بدون بيان مبيعات سابق (يتطلب اعتماد مسؤول منفصل).
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          {ref.customer && (
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <span className="text-gray-500 block mb-1">العميل</span>
              <div className="font-bold text-gray-900 text-sm">{ref.customer}</div>
            </div>
          )}
          {ref.amount != null && (
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <span className="text-gray-500 block mb-1">إجمالي المبلغ</span>
              <div className="font-bold text-blue-700 text-sm">{formatMoney(ref.amount)} ج</div>
            </div>
          )}
          {ref.reason && (
            <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-3">
              <span className="text-gray-500 block mb-1">سبب المرتجع</span>
              <div className="font-medium text-gray-900">{ref.reason}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback: Display fields in a clean list without raw JSON code
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="mb-2 font-bold text-xs text-gray-700">بيانات الطلب:</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {Object.entries(ref).map(([key, value]) => {
          if (value == null) return null;
          const displayVal =
            typeof value === 'object' ? JSON.stringify(value) : String(value);
          return (
            <div key={key} className="rounded-lg bg-gray-50 p-2">
              <span className="font-mono text-gray-400 text-[11px] block">{key}</span>
              <span className="font-medium text-gray-800 text-xs break-all">{displayVal}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}