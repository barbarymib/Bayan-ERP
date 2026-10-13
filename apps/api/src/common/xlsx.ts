import { createZip, type ZipEntry } from './zip.js';

export interface XlsxSheet {
  /** اسم الورقة (سيُقصّ إلى 31 حرفاً وتُستبدل المحارف الممنوعة) */
  name: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}

const XML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => XML_ESCAPE[c] as string);
}

/** اسم ورقة صالح: بلا `\ / ? * [ ] :`، وبحد 31 حرفاً. */
function sheetName(name: string, index: number): string {
  const clean = (name || `Sheet${index + 1}`).replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31);
  return clean || `Sheet${index + 1}`;
}

/** مرجع الخلية: العمود 0→A، 26→AA. */
function colRef(col: number): string {
  let n = col + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cell(ref: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

function rowXml(rowIndex: number, values: (string | number | null | undefined)[]): string {
  const cells = values.map((v, c) => cell(`${colRef(c)}${rowIndex}`, v)).join('');
  return `<row r="${rowIndex}">${cells}</row>`;
}

function sheetXml(sheet: XlsxSheet): string {
  const rows: string[] = [rowXml(1, sheet.headers)];
  sheet.rows.forEach((r, i) => rows.push(rowXml(i + 2, r)));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews>
<sheetData>${rows.join('')}</sheetData>
</worksheet>`;
}

const CONTENT_TYPES = (sheetCount: number): string => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${Array.from({ length: sheetCount }, (_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="1"><fill><patternFill patternType="none"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`;

function workbookXml(sheets: XlsxSheet[]): string {
  const items = sheets
    .map((s, i) => `<sheet name="${esc(sheetName(s.name, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${items}</sheets>
</workbook>`;
}

function workbookRels(sheetCount: number): string {
  const rels = Array.from(
    { length: sheetCount },
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${rels}<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

/**
 * يولّد مصنّف XLSX (OOXML) بلا أي اعتماديات خارجية، بإعادة استخدام كاتب ZIP
 * الداخلي (`.zip` بأسلوب Store + XML). كل خلية نصية inlineStr، والأرقام خلايا
 * رقمية، والأوراق باتجاه RTL لملاءمة العربية.
 */
export function toXlsx(sheets: XlsxSheet[]): Buffer {
  const list = sheets.length > 0 ? sheets : [{ name: 'Sheet1', headers: [], rows: [] }];
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: Buffer.from(CONTENT_TYPES(list.length), 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(ROOT_RELS, 'utf8') },
    { name: 'xl/workbook.xml', data: Buffer.from(workbookXml(list), 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(workbookRels(list.length), 'utf8') },
    { name: 'xl/styles.xml', data: Buffer.from(STYLES, 'utf8') },
    ...list.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: Buffer.from(sheetXml(s), 'utf8'),
    })),
  ];
  return createZip(entries);
}

/** يحوّل سجلات (Record[]) إلى ورقة: أعمدة موحّدة + صفوف. */
export function recordsToSheet(
  name: string,
  records: Record<string, unknown>[],
): XlsxSheet {
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const r of records) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k);
        headers.push(k);
      }
    }
  }
  const rows = records.map((r) =>
    headers.map((h) => {
      const v = r[h];
      if (v === null || v === undefined) return '';
      if (v instanceof Date) return v.toISOString();
      if (typeof v === 'object') return JSON.stringify(v);
      return v as string | number;
    }),
  );
  return { name, headers, rows };
}
