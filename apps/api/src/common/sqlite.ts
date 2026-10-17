import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface SqliteTable {
  name: string;
  rows: Record<string, unknown>[];
}

type Affinity = 'INTEGER' | 'REAL' | 'TEXT';

/** يقتبس معرّف SQLite (جدول/عمود) بين علامتي تنصيص مع تهريب `"`. */
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** يوحّد القيمة لتكون مقبولة من مُسند `node:sqlite`. */
function normalize(value: unknown): string | number | bigint | Buffer | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return JSON.stringify(value);
}

/** يستنتج نوع العمود من القيم غير الفارغة: كلها صحيحة → INTEGER، كلها أرقام → REAL، وإلا TEXT. */
function affinityOf(values: unknown[]): Affinity {
  let saw = false;
  let allInt = true;
  let allNum = true;
  for (const v of values) {
    if (v === null || v === undefined) continue;
    saw = true;
    if (typeof v === 'boolean' || typeof v === 'bigint') continue;
    if (typeof v === 'number') {
      if (!Number.isInteger(v)) allInt = false;
      continue;
    }
    allInt = false;
    allNum = false;
  }
  if (!saw) return 'TEXT';
  if (allNum) return allInt ? 'INTEGER' : 'REAL';
  return 'TEXT';
}

/** الأعمدة الموحّدة بترتيب ظهورها في السجلات. */
function columnsOf(rows: Record<string, unknown>[]): string[] {
  const cols: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k);
        cols.push(k);
      }
    }
  }
  return cols;
}

/**
 * يبني قاعدة SQLite كاملة من سجلات الجداول ويعيدها كـ Buffer، بلا أي اعتماديات
 * خارجية (يستخدم `node:sqlite` المدمج). يُستخدم لإتاحة بيانات الأرشيف الخام
 * للعرض والاستيراد الخارجي (§5.11.3)، بجانب JSON/CSV/XLSX.
 *
 * الجداول الفارغة تُتخطّى (لا يمكن اشتقاق أعمدتها). يوجد جدول `_archive_meta`
 * يحوي بيانات وصفية (الرمز/المدى/العدد/الإجماليات) بصيغة مفتاح/قيمة JSON.
 */
export function recordsToSqlite(
  tables: SqliteTable[],
  meta?: Record<string, unknown>,
): Buffer {
  const dir = mkdtempSync(join(tmpdir(), 'bayan-sqlite-'));
  const file = join(dir, 'archive.sqlite');
  const db = new DatabaseSync(file);
  try {
    if (meta) {
      db.exec('CREATE TABLE "_archive_meta" ("key" TEXT PRIMARY KEY, "value" TEXT NOT NULL)');
      const ins = db.prepare('INSERT INTO "_archive_meta" ("key", "value") VALUES (?, ?)');
      for (const [k, v] of Object.entries(meta)) ins.run(k, JSON.stringify(v ?? null));
    }
    for (const t of tables) {
      if (!t.rows || t.rows.length === 0) continue;
      const cols = columnsOf(t.rows);
      if (cols.length === 0) continue;
      const types = cols.map((c) => affinityOf(t.rows.map((r) => r[c])));
      const defs = cols.map((c, i) => `${quoteIdent(c)} ${types[i]}`).join(', ');
      db.exec(`CREATE TABLE ${quoteIdent(t.name)} (${defs})`);
      const ph = cols.map(() => '?').join(', ');
      const ins = db.prepare(
        `INSERT INTO ${quoteIdent(t.name)} (${cols.map(quoteIdent).join(', ')}) VALUES (${ph})`,
      );
      for (const r of t.rows) ins.run(...cols.map((c) => normalize(r[c])));
    }
    db.close();
    return readFileSync(file);
  } catch (e) {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
