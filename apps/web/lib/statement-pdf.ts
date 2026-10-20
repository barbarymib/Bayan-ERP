import type { CompanySettings, PriceStatement } from '@/lib/api';
import { formatDate, formatDateHijri } from '@/components/ui';
import { formatArabicAmount, numberToArabic } from '@/lib/tafqit';

/** بيانات الشركة لترويسة الطباعة (R4-C4 §5.6). */
export type PrintCompany = Pick<
  CompanySettings['company'],
  'nameAr' | 'phone' | 'email' | 'logoUrl'
> | null;

type PdfMake = {
  vfs: Record<string, string>;
  fonts: Record<string, unknown>;
  createPdf: (doc: object) => {
    download: (name: string) => void;
    getBlob: (cb: (b: Blob) => void) => void;
  };
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

/** تحويل شعار الشركة إلى data URL قابل للضمّ في PDF (رابط https يُجلب ويُحوّل). */
async function resolveLogo(logoUrl: string | null | undefined): Promise<string | null> {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('data:')) return logoUrl;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const mime = res.headers.get('content-type') || 'image/png';
    return `data:${mime};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

/** تصدير PDF عربي RTL (تقييم pdfmake بخط مضمّن — ADR-7). */
export async function downloadStatementPdf(
  st: PriceStatement,
  outstanding: number | null,
  company: PrintCompany = null,
): Promise<void> {
  const pm = await ensurePdfMake();
  const logo = await resolveLogo(company?.logoUrl);
  await pm.createPdf(statementDoc(st, outstanding, company, logo)).download(`${st.number}.pdf`);
}

/** PDF كـ Blob (للمشاركة عبر واتساب/Web Share — G18). */
export async function statementPdfBlob(
  st: PriceStatement,
  outstanding: number | null,
  company: PrintCompany = null,
): Promise<Blob> {
  const pm = await ensurePdfMake();
  const logo = await resolveLogo(company?.logoUrl);
  return new Promise<Blob>((resolve, reject) => {
    try {
      pm.createPdf(statementDoc(st, outstanding, company, logo)).getBlob((b) => resolve(b));
    } catch (err) {
      reject(err);
    }
  });
}

function statementDoc(st: PriceStatement, outstanding: number | null, company: PrintCompany, logo: string | null): object {
  const before = outstanding != null ? outstanding - Number(st.net) : null;

  const label = (text: string): object => ({ text: `${text}:`, bold: true, fontSize: 12, color: '#334155' });
  const small = (text: string, opts: object = {}): object => ({ text, fontSize: 10, color: '#64748b', ...opts });

  const linesTable = {
    layout: 'lightHorizontalLines',
    alignment: 'center',
    table: {
      headerRows: 1,
      widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto'],
      body: [
        ['#', 'الصنف', 'الوحدة', 'الكمية', 'السعر', 'الخصم', 'الإجمالي'].map(
          (h) => ({ text: h, bold: true, fillColor: '#f1f5f9', fontSize: 11 }),
        ),
        ...st.lines.map((l, i) => [
          String(i + 1),
          {
            text:
              `${l.item.nameAr}\n${l.item.code}` + (l.weightNote ? `\nوزن فعلي: ${l.weightNote}` : ''),
            fontSize: 11,
          },
          l.unit.code,
          qty(l.qty),
          money(l.unitPrice),
          money(l.lineDiscountAmount),
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
            ...(logo ? [{ image: logo, width: 56, margin: [0, 0, 0, 4] as [number, number, number, number] }] : []),
            { text: 'نظام بيان', fontSize: 20, bold: true, color: '#1d4ed8' },
            { text: company?.nameAr ?? 'بيان', fontSize: 12, color: '#64748b' },
            {
              text: [
                ...(company?.email ? [`بريد: ${company.email}`] : []),
                ...(company?.phone ? [`هاتف: ${company.phone}`] : []),
              ].join('  —  ') || ' ',
              fontSize: 9,
              color: '#94a3b8',
            },
          ],
          {
            alignment: 'center',
            stack: [
              { text: 'بيان أسعار', fontSize: 26, bold: true, color: '#0f172a' },
              { text: `الرقم: ${st.number}`, fontSize: 12, marginTop: 4 },
              { text: `التاريخ: ${formatDate(st.date)}`, fontSize: 12 },
              // R4-B11: التاريخ الهجري بجانب الميلادي (§9).
              { text: `هجري: ${formatDateHijri(st.date)}`, fontSize: 10, color: '#64748b' },
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
              { text: st.customer.nameAr, fontSize: 13, bold: true, marginTop: 2 },
              { text: st.customer.code, fontSize: 10, color: '#64748b' },
              { text: `هاتف: ${st.customer.phone ?? '—'}`, fontSize: 10, color: '#64748b' },
            ],
          },
          {
            stack: [
              label('المخزن'),
              { text: st.warehouse.nameAr, fontSize: 12, marginTop: 2 },
              small(`المندوب: ${st.createdBy?.name ?? '—'}`, { marginTop: 2 }),
              small(`الاعتماد: ${st.approvedBy?.name ?? '—'}`),
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
              { text: formatArabicAmount(Number(st.net)), fontSize: 11, color: '#1e293b', marginTop: 4 },
              before != null
                ? small(`الرصيد قبل البيان: ${money(before)}  —  بعد: ${money(before + Number(st.net))}`, { marginTop: 3 })
                : {},
              small(`ملاحظات: ${st.notes ?? '—'}`, { marginTop: 4 }),
              { text: `المتبقي: ${money(Number(st.net) - Number(st.paid))}`, fontSize: 11, bold: true, marginTop: 2 },
            ],
          },
          {
            table: {
              widths: [90, 90],
              body: [
                ['الإجمالي الفرعي', money(st.subtotal)],
                ['خصم البيان', money(st.discountAmount)],
                ['النقل', money(st.shipping)],
                ['الضريبة', money(st.taxAmount)],
                [{ text: 'الصافي', bold: true }, { text: money(st.net), bold: true }],
                ['المدفوع', money(st.paid)],
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
              { text: numberToArabic(Number(st.net)), fontSize: 9, color: '#64748b' },
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
  return doc;
}