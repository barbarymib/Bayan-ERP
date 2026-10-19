import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { OBJECT_STORAGE, type ObjectStorage } from '../common/object-storage.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { decrypt, encrypt, resolveKey } from './crypto.util.js';

const execFileAsync = promisify(execFile);

/**
 * اتصال pg_dump: يفضّل BACKUP_DATABASE_URL (دور BYPASSRLS لتجاوز سياسات RLS على الجداول
 * ذات FORCE ROW LEVEL SECURITY)، وإلا DATABASE_URL.
 */
export function resolveDumpDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.BACKUP_DATABASE_URL ?? env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return url;
}

/** اتصال قاعدة بيانات الإدارة `postgres` (لإنشاء/إسقاط قاعدة اختبار الاسترجاع). */
export function resolveAdminDatabaseUrl(baseUrl: string): string {
  const u = new URL(baseUrl);
  u.pathname = '/postgres';
  return u.toString();
}

/** اتصال قاعدة بيانات مؤقتة باسم محدّد على نفس الخادم. */
export function resolveScratchDatabaseUrl(baseUrl: string, name: string): string {
  const u = new URL(baseUrl);
  u.pathname = `/${name}`;
  return u.toString();
}

/** اسم قاعدة اختبار آمن (بلا رموز). */
export function scratchDatabaseName(date: Date, suffix: string): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  const safe = suffix.replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'x';
  return `bayan_drill_${stamp}_${safe}`.toLowerCase();
}

/** يقرأ قيمة رقمية مفردة من مخرجات psql (تُرجع -1 عند تعذّر التحويل). */
export function parseDrillScalar(stdout: string): number {
  const v = Number(stdout.trim());
  return Number.isFinite(v) ? v : -1;
}

@Injectable()
export class BackupsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupsService.name);
  private running = false;
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  onModuleInit(): void {
    const spec = process.env.BACKUP_DAILY_TIME ?? '02:00';
    if (spec === 'off' || spec === 'false') return;
    if (process.env.NODE_ENV === 'test') return;

    const parts = spec.split(':');
    const h = Number(parts[0]);
    const m = Number(parts[1] ?? 0);
    if (parts.length !== 2 || !Number.isFinite(h) || !Number.isFinite(m)) {
      this.logger.warn(`Invalid BACKUP_DAILY_TIME "${spec}" — daily backup disabled`);
      return;
    }
    this.scheduleDaily(h, m);
    this.logger.log(`Daily encrypted backup scheduled at ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }

  onModuleDestroy(): void {
    for (const t of this.timers) {
      clearTimeout(t);
      clearInterval(t);
    }
    this.timers = [];
  }

  /** تشغيل نسخة احتياطية مشفّرة فوراً (§5.16). */
  async runBackup(triggeredById?: number) {
    if (this.running) throw new BadRequestException('A backup is already running');
    this.running = true;

    const dir = path.join(os.tmpdir(), 'bayan-backups');
    mkdirSync(dir, { recursive: true });

    const code = `BK-${this.stamp(new Date())}-${randomBytes(3).toString('hex')}`;
    const filename = `${code}.sql.enc`;
    const plainPath = path.join(dir, `${code}.sql`);

    const record = await this.prisma.automatedBackup.create({
      data: {
        code,
        filename,
        path: '', // يُملأ بالمعرّف المستمر بعد رفع الكائن
        sha256: '',
        status: 'RUNNING',
        createdById: triggeredById ?? null,
      },
    });
    let storedId: string | null = null;

    try {
      // pg_dump يتطلب تجاوز RLS (جداول FORCE ROW LEVEL SECURITY): نستخدم اتصالاً بدور
      // BYPASSRLS عبر BACKUP_DATABASE_URL إن توفّر، وإلا نرجع إلى DATABASE_URL.
      const databaseUrl = resolveDumpDatabaseUrl();

      await execFileAsync(
        this.resolvePgDump(),
        ['--no-owner', '--no-privileges', '--file', plainPath, '--dbname', databaseUrl],
        { maxBuffer: 1024 * 1024 * 512, timeout: 120_000 },
      );
      if (!existsSync(plainPath)) throw new Error('pg_dump produced no output');

      const plain = readFileSync(plainPath);
      const enc = encrypt(plain, resolveKey());
      rmSync(plainPath, { force: true });

      storedId = await this.storage.save(`backups/${filename}`, enc);
      const sha256 = createHash('sha256').update(enc).digest('hex');
      const sizeBytes = BigInt(enc.length);

      const updated = await this.prisma.automatedBackup.update({
        where: { id: record.id },
        data: { sizeBytes, sha256, status: 'DONE', path: storedId, completedAt: new Date() },
      });
      this.logger.log(`Backup ${code} OK (${Number(sizeBytes)} bytes)`);
      return this.serialize(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (storedId) await this.storage.remove(storedId).catch(() => undefined);
      rmSync(plainPath, { force: true });
      await this.prisma.automatedBackup.update({
        where: { id: record.id },
        data: { status: 'FAILED', error: message.slice(0, 500), completedAt: new Date() },
      });
      this.logger.error(`Backup ${code} failed: ${message}`);
      throw new BadRequestException(`Backup failed: ${message}`);
    } finally {
      this.running = false;
    }
  }

  /** التحقق من سلامة النسخة: تطابق SHA-256 + إمكانية فك التشفير (اختبار الاسترجاع). */
  async verify(id: number) {
    const record = await this.prisma.automatedBackup.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Backup #${id} not found`);
    if (!record.path || !(await this.storage.exists(record.path))) {
      throw new BadRequestException('Backup file is missing on disk');
    }

    const buf = await this.storage.load(record.path);
    const sha256 = createHash('sha256').update(buf).digest('hex');
    if (sha256 !== record.sha256) {
      throw new BadRequestException('Checksum mismatch — the backup file was altered');
    }

    let decryptedBytes = 0;
    try {
      decryptedBytes = decrypt(buf, resolveKey()).length;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Decryption failed: ${message}`);
    }

    return {
      ok: true,
      code: record.code,
      sizeBytes: Number(record.sizeBytes),
      decryptedBytes,
      sha256,
    };
  }

  /**
   * اختبار استرجاع فعلي (R3-E6، §9): يفك التشفير ويستعيد النسخة في قاعدة بيانات
   * مؤقتة على نفس الخادم، ثم يتحقق من وجود الجداول والبيانات الأساسية، ويسقط القاعدة.
   * يُسجّل النتيجة على سجل النسخة (lastDrillAt/lastDrillOk/lastDrillDetail).
   */
  async restoreDrill(id: number) {
    const record = await this.prisma.automatedBackup.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Backup #${id} not found`);
    if (!record.path || !(await this.storage.exists(record.path))) {
      throw new BadRequestException('Backup file is missing on disk');
    }

    const buf = await this.storage.load(record.path);
    const sha256 = createHash('sha256').update(buf).digest('hex');
    if (sha256 !== record.sha256) {
      throw new BadRequestException('Checksum mismatch — the backup file was altered');
    }

    const dir = path.join(os.tmpdir(), 'bayan-backups');
    mkdirSync(dir, { recursive: true });
    const plainPath = path.join(dir, `drill-${record.code}-${randomBytes(3).toString('hex')}.sql`);
    const name = scratchDatabaseName(new Date(), record.code);
    const psql = this.resolvePsql();
    const baseUrl = resolveDumpDatabaseUrl();
    const adminUrl = resolveAdminDatabaseUrl(baseUrl);
    const scratchUrl = resolveScratchDatabaseUrl(baseUrl, name);

    const psqlBase = ['--set', 'ON_ERROR_STOP=1', '--no-psqlrc'];
    let created = false;
    let ok = false;
    let detail = '';
    let tables = -1;
    let companies = -1;

    try {
      writeFileSync(plainPath, decrypt(buf, resolveKey()));

      await execFileAsync(
        psql,
        [...psqlBase, '--dbname', adminUrl, '--command', `CREATE DATABASE "${name}"`],
        { timeout: 60_000 },
      );
      created = true;

      await execFileAsync(
        psql,
        [...psqlBase, '--quiet', '--dbname', scratchUrl, '--file', plainPath],
        { maxBuffer: 1024 * 1024 * 512, timeout: 300_000 },
      );

      const tableRes = await execFileAsync(
        psql,
        [
          ...psqlBase,
          '--tuples-only',
          '--no-align',
          '--dbname',
          scratchUrl,
          '--command',
          "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'",
        ],
        { timeout: 60_000 },
      );
      tables = parseDrillScalar(tableRes.stdout);

      const companyRes = await execFileAsync(
        psql,
        [
          ...psqlBase,
          '--tuples-only',
          '--no-align',
          '--dbname',
          scratchUrl,
          '--command',
          'SELECT count(*) FROM "Company"',
        ],
        { timeout: 60_000 },
      );
      companies = parseDrillScalar(companyRes.stdout);

      ok = tables > 0 && companies >= 0;
      detail = `tables=${tables}, companies=${companies}`;
      if (!ok) throw new Error(`drill validation failed (${detail})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!ok) detail = detail || message.slice(0, 400);
      this.logger.error(`Restore drill for ${record.code} failed: ${message}`);
    } finally {
      if (created) {
        await execFileAsync(
          psql,
          [...psqlBase, '--dbname', adminUrl, '--command', `DROP DATABASE IF EXISTS "${name}"`],
          { timeout: 60_000 },
        ).catch((e) =>
          this.logger.warn(
            `Could not drop drill database ${name}: ${e instanceof Error ? e.message : e}`,
          ),
        );
      }
      rmSync(plainPath, { force: true });
    }

    await this.prisma.automatedBackup.update({
      where: { id: record.id },
      data: { lastDrillAt: new Date(), lastDrillOk: ok, lastDrillDetail: detail.slice(0, 500) },
    });

    if (!ok) throw new BadRequestException(`Restore drill failed: ${detail}`);
    this.logger.log(`Restore drill for ${record.code} OK (${detail})`);
    return { ok, code: record.code, tables, companies, detail };
  }

  async list(limit = 50) {
    const [rows, total] = await Promise.all([
      this.prisma.automatedBackup.findMany({
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.automatedBackup.count(),
    ]);
    return { total, items: rows.map((r) => this.serialize(r)) };
  }

  async get(id: number) {
    const record = await this.prisma.automatedBackup.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    if (!record) throw new NotFoundException(`Backup #${id} not found`);
    return this.serialize(record);
  }

  // ==================== helpers ====================

  private scheduleDaily(hour: number, minute: number): void {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);

    const first = setTimeout(() => {
      void this.runScheduled();
      const interval = setInterval(() => void this.runScheduled(), 24 * 60 * 60 * 1000);
      this.timers.push(interval);
    }, next.getTime() - now.getTime());
    this.timers.push(first);
  }

  private async runScheduled(): Promise<void> {
    try {
      const backup = await this.runBackup();
      if (process.env.BACKUP_DRILL !== 'off' && process.env.BACKUP_DRILL !== 'false') {
        try {
          await this.restoreDrill(backup.id);
        } catch (err) {
          this.logger.error(
            `Scheduled restore drill failed: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`Scheduled backup failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  private backupDir(): string {
    return process.env.BACKUP_DIR ?? path.join(process.cwd(), 'backups');
  }

  private resolvePgDump(): string {
    if (process.env.PG_DUMP_PATH) return process.env.PG_DUMP_PATH;
    const candidates =
      process.platform === 'win32'
        ? [
            'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
            'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
          ]
        : ['/usr/bin/pg_dump', '/usr/local/bin/pg_dump'];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
    return 'pg_dump';
  }

  private resolvePsql(): string {
    if (process.env.PG_PSQL_PATH) return process.env.PG_PSQL_PATH;
    const candidates =
      process.platform === 'win32'
        ? [
            'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
            'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
          ]
        : ['/usr/bin/psql', '/usr/local/bin/psql'];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
    return 'psql';
  }

  private stamp(date: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return (
      `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
      `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
    );
  }

  /** BigInt لا يُحوَّل إلى JSON — نحوِّله الرقم قبل الإرجاع. */
  private serialize<T extends { sizeBytes: bigint }>(
    row: T,
  ): Omit<T, 'sizeBytes'> & { sizeBytes: number } {
    return { ...row, sizeBytes: Number(row.sizeBytes) };
  }
}
