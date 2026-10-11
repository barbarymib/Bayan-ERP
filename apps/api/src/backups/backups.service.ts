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
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { OBJECT_STORAGE, type ObjectStorage } from '../common/object-storage.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { decrypt, encrypt, resolveKey } from './crypto.util.js';

const execFileAsync = promisify(execFile);

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
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) throw new Error('DATABASE_URL is not set');

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
      await this.runBackup();
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
