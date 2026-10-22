import type { Quotation } from '@/lib/api';
import { formatDate } from '@/components/ui';
import { formatArabicAmount, numberToArabic } from '@/lib/tafqit';

type PdfMake = {
  vfs: Record<string, string>;
  fonts: Record<string, unknown>;
  createPdf: (doc: object) => { download: (name: string) => void };
};

const money = (v: unknown) => fmtMoney(Number(v));
const qty = (v: unknown) => fmtMoney(Number(v), 3);

function fmtMoney(n: number, places = 2): string {
  const s = Number.isInteger(n) ? n.toFixed(places).replace(/\.?0+$/, '') : n.toFixed(places);
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

let pdfMake: PdfMake | null = null;
let fontsReady: Promise<void> | null = null;

async function ensurePdfMake(): Promise<PdfMake> {
  if (!pdfMake) {
    const mod = await import('pdfmake/build/pdfmake');
    pdfMake = ((mod.default ?? mod) as unknown) as PdfMake;
  }
  if (!fontsReady) {
    fontsReady = (async () => {
      const toB64 = async (url: string) => {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        let bin = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
      };
      const [regular, bold] = await Promise.all([
        toB64('/fonts/Amiri-Regular.ttf'),
        toB64('/fonts/Amiri-Bold.ttf'),
      ]);
      pdfMake!.vfs = { 'Amiri-Regular.ttf': regular, 'Amiri-Bold.ttf': bold };
      pdfMake!.fonts = {
        Amiri: {
          normal: 'Amiri-Regular.ttf',
          bold: 'Amiri-Bold.ttf',
          italics: 'Amiri-Regular.ttf',
          bolditalics: 'Amiri-Bold.ttf',
        },
      };
    })();
  }
  await fontsReady;
  return pdfMake!;
}

/** تصدير عرض سعر PDF عربي RTL (تقييم pdfmake بخط مضمّن — ADR-7). */
export async function downloadQuotationPdf(q: Quotation): Promise<void> {
  const pm = await ensurePdfMake();

  const label = (text: string): object => ({ text: `${text}:`, bold: true, fontSize: 12, color: '#334155' });
  const small = (text: string, opts: object = {}): object => ({ text, fontSize: 10, color: '#64748b', ...opts });

  const linesTable = {
    layout: 'lightHorizontalLines',
    alignment: 'center',
    table: {
      headerRows: 1,
      widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
      body: [
        ['#', 'الصنف', 'الوحدة', 'الكمية', 'السعر', 'الإجمالي'].map(
          (h) => ({ text: h, bold: true, fillColor: '#f1f5f9', fontSize: 11 }),
        ),
        ...(q.lines ?? []).map((l, i) => [
          String(i + 1),
          { text: `${l.item.nameAr}\n${l.item.code}`, fontSize: 11 },
          l.unit.code,
          qty(l.qty),
          money(l.unitPrice),
          money(l.netLine),
        ]),
      ],
    },
  };

  const doc = {
    background: () => ({
      canvas: [
        { type: 'rect', x: 0, y: 0, w: 595, h: 842, color: '#ffffff' },
        { type: 'rect', x: 0, y: 0, w: 595, h: 8, color: '#1d4ed8' },
      ],
    }),
    content: [
      {
        columns: [
          [
            { text: 'نظام بيان', fontSize: 20, bold: true, color: '#1d4ed8' },
            { text: 'شركة تجارة الحدايد والبويات', fontSize: 12, color: '#64748b' },
            { text: 'بريد: info@company.com  —  هاتف: 0100 000 0000', fontSize: 9, color: '#94a3b8' },
          ],
          {
            alignment: 'center',
            stack: [
              { text: 'عرض سعر', fontSize: 26, bold: true, color: '#0f172a' },
              { text: `الرقم: ${q.number}`, fontSize: 12, marginTop: 4 },
              { text: `التاريخ: ${formatDate(q.date)}`, fontSize: 12 },
              { text: `صالح حتى: ${q.validUntil ? formatDate(q.validUntil) : '—'}`, fontSize: 11 },
            ],
          },
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cbd5e1' }], margin: [0, 10, 0, 10] },
      {
        columns: [
          {
            stack: [
              label('العميل'),
              { text: q.customer.nameAr, fontSize: 13, bold: true, marginTop: 2 },
              { text: q.customer.code, fontSize: 10, color: '#64748b' },
              { text: `هاتف: ${q.customer.phone ?? '—'}`, fontSize: 10, color: '#64748b' },
            ],
          },
          {
            stack: [
              label('المخزن'),
              { text: q.warehouse?.nameAr ?? '—', fontSize: 12, marginTop: 2 },
              small(`أنشأه: ${q.createdBy?.name ?? '—'}`, { marginTop: 2 }),
            ],
          },
        ],
      },
      { margin: [0, 8, 0, 2], text: 'البنود:', bold: true, fontSize: 11 },
      linesTable,
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cbd5e1' }], margin: [0, 8, 0, 8] },
      {
        columns: [
          {
            stack: [
              { text: formatArabicAmount(Number(q.net)), fontSize: 11, color: '#1e293b', marginTop: 4 },
              small(`ملاحظات: ${q.notes ?? '—'}`, { marginTop: 4 }),
            ],
          },
          {
            table: {
              widths: [90, 90],
              body: [
                ['الإجمالي الفرعي', money(q.subtotal)],
                ['الخصم', money(q.discountAmount)],
                ['النقل', money(q.shipping)],
                [`الضريبة ${q.taxPercent}%`, money(q.taxAmount)],
                [{ text: 'الصافي', bold: true }, { text: money(q.net), bold: true }],
              ].map((r) => [
                { text: r[0], bold: r[0] === 'الصافي', alignment: 'right', fontSize: 11 },
                { text: r[1], alignment: 'left', fontSize: 11, bold: r[0] === 'الصافي' },
              ]),
            },
          },
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cbd5e1' }], margin: [0, 10, 0, 14] },
      {
        columns: [
          { text: 'المستلم / التوقيع', fontSize: 10, color: '#64748b' },
          {
            stack: [
              { text: numberToArabic(Number(q.net)), fontSize: 9, color: '#64748b' },
              { text: 'المحاسب / المدير ....................', fontSize: 10, color: '#64748b', alignment: 'center' },
            ],
          },
          { text: 'التوقيع', fontSize: 10, color: '#64748b', alignment: 'left' },
        ],
      },
    ],
    defaultStyle: { font: 'Amiri' },
    pageMargins: [36, 30, 36, 30],
    pageSize: 'A4',
  };

  await pm.createPdf(doc).download(`${q.number}.pdf`);
}
