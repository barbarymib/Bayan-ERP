import { afterEach, describe, expect, it } from 'vitest';
import { decrypt, encrypt, resolveKey } from '../src/backups/crypto.util.js';
import {
  parseDrillScalar,
  resolveAdminDatabaseUrl,
  resolveDumpDatabaseUrl,
  resolveScratchDatabaseUrl,
  scratchDatabaseName,
} from '../src/backups/backups.service.js';
const ORIGINAL_KEY = process.env.BACKUP_ENCRYPTION_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
  else process.env.BACKUP_ENCRYPTION_KEY = ORIGINAL_KEY;
});

describe('backup crypto (§5.16 نسخ احتياطي مشفر يومي AES-256-GCM)', () => {
  it('يشفّر ويفك التشفير دون فقدان بيانات', () => {
    const plain = Buffer.from('SELECT 1;\n-- بيانات كبيرة\n', 'utf8');
    const key = resolveKey();
    const enc = encrypt(plain, key);
    expect(enc.equals(plain)).toBe(false);
    expect(decrypt(enc, key).equals(plain)).toBe(true);
  });

  it('صيغة الملف: MAGIC(8) | iv(12) | tag(16) | ciphertext', () => {
    const plain = Buffer.alloc(100, 7);
    const enc = encrypt(plain, resolveKey());
    expect(enc.length).toBe(8 + 12 + 16 + plain.length);
    expect(enc.subarray(0, 8).toString('utf8')).toBe('BAYANBK1');
  });

  it('المفتاح ثابت عبر العمليات (فك التشفير بعد إعادة التشغيل)', () => {
    delete process.env.BACKUP_ENCRYPTION_KEY;
    const a = resolveKey();
    const b = resolveKey();
    expect(a.equals(b)).toBe(true);
    expect(a.length).toBe(32);
  });

  it('يحترم BACKUP_ENCRYPTION_KEY عندما يكون 64 hex', () => {
    process.env.BACKUP_ENCRYPTION_KEY = 'ab'.repeat(32);
    const key = resolveKey();
    expect(key.length).toBe(32);
    expect(key.toString('hex')).toBe('ab'.repeat(32));
  });

  it('يتشقق مفتاح عبارة السر بنفس القيمة الثابتة', () => {
    process.env.BACKUP_ENCRYPTION_KEY = 'bayan-dummy-passphrase';
    const plain = Buffer.from('backup');
    const enc = encrypt(plain, resolveKey());
    expect(decrypt(enc, resolveKey()).equals(plain)).toBe(true);
  });

  it('يرفض المفتاح الخاطئ', () => {
    const enc = encrypt(Buffer.from('secret'), resolveKey());
    process.env.BACKUP_ENCRYPTION_KEY = 'cd'.repeat(32);
    expect(() => decrypt(enc, resolveKey())).toThrow();
  });

  it('يرفض بيانات معدّلة (GCM auth tag)', () => {
    const enc = encrypt(Buffer.from('important payload'), resolveKey());
    const tampered = Buffer.from(enc);
    tampered[tampered.length - 1]! ^= 0xff;
    expect(() => decrypt(tampered, resolveKey())).toThrow();
  });

  it('يرفض ملفاً ليس من صيغة النسخ الاحتياطي المشفرة', () => {
    expect(() => decrypt(Buffer.from('not an encrypted backup'), resolveKey())).toThrow(
      'bad header',
    );
  });

  it('يرفض الملفات الأقصر من رأس الصيغة', () => {
    expect(() => decrypt(Buffer.from('BAYAN'), resolveKey())).toThrow('bad header');
  });
});

describe('resolveDumpDatabaseUrl (اتصال pg_dump مع تجاوز RLS)', () => {
  it('يفضّل BACKUP_DATABASE_URL عند توفره', () => {
    expect(
      resolveDumpDatabaseUrl({
        BACKUP_DATABASE_URL: 'postgresql://bypass@db/bayan',
        DATABASE_URL: 'postgresql://app@db/bayan',
      }),
    ).toBe('postgresql://bypass@db/bayan');
  });

  it('يرجع إلى DATABASE_URL عند غياب BACKUP_DATABASE_URL', () => {
    expect(resolveDumpDatabaseUrl({ DATABASE_URL: 'postgresql://app@db/bayan' })).toBe(
      'postgresql://app@db/bayan',
    );
  });

  it('يرفض غياب كلاهما', () => {
    expect(() => resolveDumpDatabaseUrl({})).toThrow('DATABASE_URL is not set');
  });
});

describe('اختبار الاسترجاع الدوري (R3-E6، §9)', () => {
  const base = 'postgresql://bypass:secret@localhost:5433/bayan?schema=public';

  it('يبني اتصال قاعدة الإدارة postgres', () => {
    const url = new URL(resolveAdminDatabaseUrl(base));
    expect(url.pathname).toBe('/postgres');
    expect(url.host).toBe('localhost:5433');
    expect(url.password).toBe('secret');
  });

  it('يبني اتصال قاعدة الاختبار المؤقتة باسمها', () => {
    const url = new URL(resolveScratchDatabaseUrl(base, 'bayan_drill_x'));
    expect(url.pathname).toBe('/bayan_drill_x');
    expect(url.searchParams.get('schema')).toBe('public');
  });

  it('يولّد اسم قاعدة اختبار آمن وفريد بحسب الوقت', () => {
    const a = scratchDatabaseName(new Date('2026-10-19T02:00:00Z'), 'BK-20261019020000-ab12cd');
    expect(a).toMatch(/^bayan_drill_20261019\d{6}_[a-z0-9]+$/);
    expect(a).not.toMatch(/[^a-z0-9_]/);
    const b = scratchDatabaseName(new Date('2026-10-20T02:00:00Z'), 'BK-20261020020000-ab12cd');
    expect(a).not.toBe(b);
  });

  it('يستخرج قيمة psql الرقمية المفردة', () => {
    expect(parseDrillScalar('  42\n')).toBe(42);
    expect(parseDrillScalar('0\n')).toBe(0);
    expect(parseDrillScalar('غير صالح')).toBe(-1);
  });
});
