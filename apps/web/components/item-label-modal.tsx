'use client';

import { useEffect, useState } from 'react';
import { getText } from '@/lib/api';
import { Button, ErrorBox, Spinner } from '@/components/ui';

/**
 * ملصق باركود/QR (§5.16 «باركود/QR للأصناف والعملاء»).
 * يجلب SVG من واجهات الملصقات ويعرضه بحجم طباعة ملصق 80mm مع زر طباعة.
 */
export function ItemLabelModal({
  kind,
  code,
  nameAr,
  subtitle,
  onClose,
}: {
  kind: 'item' | 'customer';
  code: string;
  nameAr: string;
  subtitle?: string;
  onClose: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [barcode, setBarcode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const qrPath = `/labels/qr/${kind}/${encodeURIComponent(code)}`;
    const jobs = kind === 'item'
      ? Promise.all([getText(qrPath), getText(`/labels/barcode/item/${encodeURIComponent(code)}`)])
      : getText(qrPath).then((q) => [q, null] as [string, null]);
    jobs
      .then(([q, b]) => {
        if (cancelled) return;
        setQr(q);
        setBarcode(b);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'تعذّر تحميل الملصق');
      });
    return () => {
      cancelled = true;
    };
  }, [kind, code]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="print:hidden flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-base font-bold text-gray-900">
            ملصق {kind === 'item' ? 'صنف' : 'عميل'} — {code}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق">
            ✕
          </button>
        </div>
        <div className="px-5 py-4">
          {error ? <ErrorBox message={error} /> : null}
          {!error && qr == null ? <Spinner /> : null}
          {qr != null ? (
            <div className="label-print mx-auto w-[80mm] max-w-full border border-gray-300 bg-white p-[4mm] text-center">
              <div className="text-sm font-bold text-gray-900">{nameAr}</div>
              {subtitle ? <div className="text-[10px] text-gray-600">{subtitle}</div> : null}
              <div className="my-1 font-mono text-xs" dir="ltr">
                {code}
              </div>
              <div
                className="label-svg mx-auto w-[34mm]"
                // SVG يعود من واجهة الملصقات الخاصة بالتطبيق (مصدر موثوق)
                dangerouslySetInnerHTML={{ __html: qr }}
              />
              {barcode != null ? (
                <div className="label-svg mt-1 w-[60mm] mx-auto" dangerouslySetInnerHTML={{ __html: barcode }} />
              ) : null}
            </div>
          ) : null}
          <div className="print:hidden mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              إغلاق
            </Button>
            <Button onClick={() => window.print()}>طباعة</Button>
          </div>
        </div>
      </div>
      <style jsx>{`
        .label-svg :global(svg) {
          width: 100%;
          height: auto;
          display: block;
        }
        @media print {
          :global(body) * {
            visibility: hidden !important;
          }
          .label-print,
          .label-print * {
            visibility: visible !important;
          }
          .label-print {
            position: fixed;
            inset: 0;
            margin: 0;
            padding: 6mm;
            border: none;
            background: #fff;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
