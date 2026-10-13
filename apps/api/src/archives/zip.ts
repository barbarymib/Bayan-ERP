export { crc32, createZip, sha256, type ZipEntry } from '../common/zip.js';

/** CSV متوافق مع Excel: BOM + اقتباس الحقول. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '\ufeff';
  const cols: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        cols.push(k);
      }
    }
  }
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [cols.join(','), ...rows.map((row) => cols.map((c) => escape(row[c])).join(','))];
  return '\ufeff' + lines.join('\r\n');
}
