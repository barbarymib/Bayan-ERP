import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { recordsToSqlite, type SqliteTable } from '../src/common/sqlite.js';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** يفتح قاعدة من Buffer مُنتَج عبر كتابته لملف مؤقت. */
function open(buf: Buffer): DatabaseSync {
  const dir = mkdtempSync(join(tmpdir(), 'bayan-sqlite-test-'));
  dirs.push(dir);
  const file = join(dir, 'a.sqlite');
  writeFileSync(file, buf);
  return new DatabaseSync(file);
}

const HEADER = Buffer.from('SQLite format 3\0', 'binary');

describe('recordsToSqlite — قاعدة SQLite مدمجة للأرشيف (§5.11.3)', () => {
  it('ينتج ملف SQLite صالح (ترويسة السحر)', () => {
    const buf = recordsToSqlite([{ name: 't', rows: [{ a: 1 }] }]);
    expect(buf.subarray(0, HEADER.length).equals(HEADER)).toBe(true);
  });

  it('يعيد بناء الجداول والصفوف', () => {
    const tables: SqliteTable[] = [
      { name: 'price_statements', rows: [{ id: 1, net: 120 }, { id: 2, net: 80 }] },
      { name: 'return_statements', rows: [{ id: 1, total: 30 }] },
    ];
    const db = open(recordsToSqlite(tables));
    expect((db.prepare('SELECT COUNT(*) AS n FROM "price_statements"').get() as { n: number }).n).toBe(2);
    expect((db.prepare('SELECT COUNT(*) AS n FROM "return_statements"').get() as { n: number }).n).toBe(1);
    const row = db.prepare('SELECT "net" FROM "price_statements" WHERE "id" = 2').get() as { net: number };
    expect(row.net).toBe(80);
    db.close();
  });

  it('يستنتج أنواع الأعمدة (INTEGER/REAL/TEXT)', () => {
    const buf = recordsToSqlite([
      { name: 't', rows: [{ i: 1, r: 1.5, s: 'x' }] },
    ]);
    const db = open(buf);
    const info = db.prepare('PRAGMA table_info("t")').all() as { name: string; type: string }[];
    const byName = Object.fromEntries(info.map((c) => [c.name, c.type]));
    expect(byName.i).toBe('INTEGER');
    expect(byName.r).toBe('REAL');
    expect(byName.s).toBe('TEXT');
    db.close();
  });

  it('يوحّد القيم: التاريخ ISO والمنطقي 0/1 والكائن JSON', () => {
    const d = new Date('2026-10-13T00:00:00.000Z');
    const db = open(recordsToSqlite([{ name: 't', rows: [{ d, ok: true, obj: { x: 1 } }] }]));
    const row = db.prepare('SELECT "d", "ok", "obj" FROM "t"').get() as {
      d: string;
      ok: number;
      obj: string;
    };
    expect(row.d).toBe('2026-10-13T00:00:00.000Z');
    expect(row.ok).toBe(1);
    expect(row.obj).toBe('{"x":1}');
    db.close();
  });

  it('يتخطى الجداول الفارغة', () => {
    const db = open(recordsToSqlite([{ name: 'empty', rows: [] }, { name: 'full', rows: [{ a: 1 }] }]));
    const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(
      (r) => r.name,
    );
    expect(names).toContain('full');
    expect(names).not.toContain('empty');
    db.close();
  });

  it('يكتب جدول البيانات الوصفية _archive_meta', () => {
    const db = open(
      recordsToSqlite([{ name: 't', rows: [{ a: 1 }] }], { code: 'AR-000001', counts: { t: 1 } }),
    );
    const row = db.prepare('SELECT "value" FROM "_archive_meta" WHERE "key" = ?').get('code') as {
      value: string;
    };
    expect(JSON.parse(row.value)).toBe('AR-000001');
    const code = db.prepare('SELECT "value" FROM "_archive_meta" WHERE "key" = ?').get('counts') as {
      value: string;
    };
    expect(JSON.parse(code.value)).toEqual({ t: 1 });
    db.close();
  });
});
