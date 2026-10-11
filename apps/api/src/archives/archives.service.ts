import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import type { Prisma } from '../generated/prisma/client';
import { OBJECT_STORAGE, type ObjectStorage } from '../common/object-storage.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { createZip, sha256, toCsv, type ZipEntry } from './zip.js';

const DAY = 86_400_000;

type CheckResult = { key: string; label: string; ok: boolean; detail: string };
type Row = Record<string, unknown>;
type Range = { from: Date; to: Date; toEnd: Date };

const CONFIRM_WORD = 'أرشفة';
const RESTORE_WORD = 'استعادة';

/** جدول الحزمة بترتيب المحتوى (الفحص والحذف بترتيب FK معكوس) */
const ARCHIVE_TABLES = [
  'price_statements',
  'price_statement_lines',
  'statement_revisions',
  'return_statements',
  'return_lines',
  'purchase_statements',
  'purchase_statement_lines',
  'receipts',
  'receipt_allocations',
  'payments',
  'cheques',
  'stocktake_sessions',
  'stocktake_lines',
  'stock_movements',
  'ledger_entries',
] as const;
type ArchiveTable = (typeof ARCHIVE_TABLES)[number];

const TABLE_LABELS: Record<ArchiveTable, string> = {
  price_statements: 'بيانات الأسعار',
  price_statement_lines: 'بنود بيانات الأسعار',
  statement_revisions: 'نسخ بيانات الأسعار',
  return_statements: 'المرتجعات',
  return_lines: 'بنود المرتجعات',
  purchase_statements: 'التوريد',
  purchase_statement_lines: 'بنود التوريد',
  receipts: 'سندات القبض',
  receipt_allocations: 'تسويات السندات',
  payments: 'سندات الصرف',
  cheques: 'الشيكات',
  stocktake_sessions: 'جلسات الجرد',
  stocktake_lines: 'بنود الجرد',
  stock_movements: 'حركات المخزون',
  ledger_entries: 'دفتر الحسابات',
};

@Injectable()
export class ArchivesService {
  private readonly logger = new Logger(ArchivesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly audits: AuditLogsService,
  ) {}

  private range(from: Date, to: Date): Range {
    return { from, to, toEnd: new Date(to.getTime() + DAY) };
  }

  private inRange(r: Range, field: string): Record<string, { gte: Date; lt: Date }> {
    return { [field]: { gte: r.from, lt: r.toEnd } };
  }

  private async nextCode(): Promise<string> {
    const last = await this.prisma.archiveRun.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    return `AR-${String((last?.id ?? 0) + 1).padStart(6, '0')}`;
  }

  // ============================ فحوصات ما قبل الترحيل ============================

  async prechecks(fromDate: string, toDate: string): Promise<CheckResult[]> {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const checks: CheckResult[] = [];

    const valid = !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from <= to;
    checks.push({
      key: 'range',
      label: 'المدى الزمني صالح',
      ok: valid,
      detail: valid ? `${fromDate} ← ${toDate}` : 'تاريخ البداية يجب أن يسبق أو يساوي تاريخ النهاية',
    });
    if (!valid) return checks;

    const r = this.range(from, to);

    const before = await this.contiguity(r);
    checks.push({
      key: 'contiguity',
      label: 'البداية من أول بيانات غير مؤرشفة',
      ok: before.length === 0,
      detail:
        before.length === 0
          ? 'لا توجد بيانات قبل تاريخ البداية'
          : `توجد بيانات قبل البداية: ${before.join('، ')} — ابدأ من تاريخ أقدم أو وسّع المدى`,
    });

    const drafts = await this.draftsIn(r);
    checks.push({
      key: 'drafts',
      label: 'لا توجد بيانات مسودة في الفترة',
      ok: drafts.length === 0,
      detail: drafts.length === 0 ? 'لا مسودات' : `مسودات: ${drafts.join('، ')}`,
    });

    const unsynced = await this.unsyncedIn(r);
    checks.push({
      key: 'unsynced',
      label: 'لا بيانات غير متزامنة من أجهزة المناديب',
      ok: unsynced.length === 0,
      detail: unsynced.length === 0 ? 'كل الأجهزة متزامنة' : unsynced.join('، '),
    });

    const pendingReturns = await this.pendingReturns(r);
    checks.push({
      key: 'pending_returns',
      label: 'لا توجد مرتجعات معلقة على بيانات الفترة',
      ok: pendingReturns.length === 0,
      detail: pendingReturns.length === 0 ? 'لا مرتجعات معلقة' : `مرتجعات معلقة: ${pendingReturns.join('، ')}`,
    });

    const pendingApprovals = await this.prisma.approval.count({
      where: { status: 'PENDING', createdAt: { lt: r.toEnd } },
    });
    checks.push({
      key: 'pending_approvals',
      label: 'لا توجد موافقات معلقة قبل تاريخ النهاية',
      ok: pendingApprovals === 0,
      detail: pendingApprovals === 0 ? 'لا موافقات معلقة' : `${pendingApprovals} موافقة بانتظار القرار`,
    });

    const later = await this.laterReferences(r);
    checks.push({
      key: 'later_refs',
      label: 'لا توجد بيانات لاحقة تشير إلى بيانات الفترة',
      ok: later.length === 0,
      detail: later.length === 0 ? 'لا مراجع لاحقة' : `مراجع لاحقة: ${later.join('، ')} — وسّع المدى`,
    });

    return checks;
  }

  private async contiguity(r: Range): Promise<string[]> {
    const before = (field: string) => ({ [field]: { lt: r.from } });
    const [st, ret, pur, rec, pay, chq, mov, take, led] = await Promise.all([
      this.prisma.priceStatement.count({ where: before('date') }),
      this.prisma.returnStatement.count({ where: before('date') }),
      this.prisma.purchaseStatement.count({ where: before('date') }),
      this.prisma.receipt.count({ where: before('receivedAt') }),
      this.prisma.payment.count({ where: before('paidAt') }),
      this.prisma.cheque.count({ where: before('receivedAt') }),
      this.prisma.stockMovement.count({ where: before('createdAt') }),
      this.prisma.stocktakeSession.count({ where: before('openedAt') }),
      this.prisma.ledgerEntry.count({ where: before('entryDate') }),
    ]);
    const found: string[] = [];
    const pairs: [string, number][] = [
      ['بيانات أسعار', st],
      ['مرتجعات', ret],
      ['توريد', pur],
      ['سندات قبض', rec],
      ['سندات صرف', pay],
      ['شيكات', chq],
      ['حركات مخزون', mov],
      ['جرد', take],
      ['دفتر حسابات', led],
    ];
    for (const [name, n] of pairs) if (n > 0) found.push(`${name} (${n})`);
    return found;
  }

  private async draftsIn(r: Range): Promise<string[]> {
    const [st, ret, pur, tOpen, tCount, tReview] = await Promise.all([
      this.prisma.priceStatement.count({ where: { status: 'DRAFT', ...this.inRange(r, 'date') } }),
      this.prisma.returnStatement.count({ where: { status: 'DRAFT', ...this.inRange(r, 'date') } }),
      this.prisma.purchaseStatement.count({ where: { status: 'DRAFT', ...this.inRange(r, 'date') } }),
      this.prisma.stocktakeSession.count({ where: { status: 'OPEN', ...this.inRange(r, 'openedAt') } }),
      this.prisma.stocktakeSession.count({ where: { status: 'COUNTING', ...this.inRange(r, 'openedAt') } }),
      this.prisma.stocktakeSession.count({ where: { status: 'REVIEW', ...this.inRange(r, 'openedAt') } }),
    ]);
    const found: string[] = [];
    if (st) found.push(`بيانات أسعار (${st})`);
    if (ret) found.push(`مرتجعات (${ret})`);
    if (pur) found.push(`توريد (${pur})`);
    const takes = tOpen + tCount + tReview;
    if (takes) found.push(`جلسات جرد غير مغلقة (${takes})`);
    return found;
  }

  private async unsyncedIn(r: Range): Promise<string[]> {
    const [offlineDrafts, openShifts] = await Promise.all([
      this.prisma.priceStatement.count({ where: { status: 'DRAFT', ...this.inRange(r, 'createdAt') } }),
      this.prisma.repShift.count({ where: { endedAt: null, startedAt: { lt: r.toEnd } } }),
    ]);
    const found: string[] = [];
    if (offlineDrafts) found.push(`مسودات أجهزة غير مرفوعة (${offlineDrafts})`);
    if (openShifts) found.push(`ورديات مفتوحة على أجهزة (${openShifts})`);
    return found;
  }

  private async pendingReturns(r: Range): Promise<string[]> {
    const inRangeIds = await this.prisma.priceStatement.findMany({
      where: this.inRange(r, 'date'),
      select: { id: true },
    });
    const ids = inRangeIds.map((s) => s.id);
    if (ids.length === 0) return [];
    const pending = await this.prisma.returnStatement.count({
      where: { status: 'DRAFT', lines: { some: { sourceLine: { statementId: { in: ids } } } } },
    });
    return pending ? [`مرتجعات معلقة لبيانات الفترة (${pending})`] : [];
  }

  private async laterReferences(r: Range): Promise<string[]> {
    const [stmts, receipts] = await Promise.all([
      this.prisma.priceStatement.findMany({ where: this.inRange(r, 'date'), select: { id: true } }),
      this.prisma.receipt.findMany({ where: this.inRange(r, 'receivedAt'), select: { id: true } }),
    ]);
    const stmtIds = stmts.map((s) => s.id);
    const receiptIds = receipts.map((x) => x.id);
    const after = { gt: r.to };

    const found: string[] = [];
    if (stmtIds.length || receiptIds.length) {
      const [laterLedger, laterAllocs, laterReturns, laterMoves] = await Promise.all([
        this.prisma.ledgerEntry.count({
          where: {
            entryDate: after,
            OR: [
              { refType: 'price_statement', refId: { in: stmtIds } },
              { refType: 'return', refId: { in: stmtIds } },
              { refType: 'receipt', refId: { in: receiptIds } },
            ],
          },
        }),
        stmtIds.length
          ? this.prisma.receiptAllocation.count({
              where: { statementId: { in: stmtIds }, receipt: { receivedAt: after } },
            })
          : Promise.resolve(0),
        stmtIds.length
          ? this.prisma.returnStatement.count({
              where: { date: after, lines: { some: { sourceLine: { statementId: { in: stmtIds } } } } },
            })
          : Promise.resolve(0),
        stmtIds.length
          ? this.prisma.stockMovement.count({
              where: { refType: 'price_statement', refId: { in: stmtIds }, createdAt: after },
            })
          : Promise.resolve(0),
      ]);
      if (laterLedger) found.push(`قيود دفترية (${laterLedger})`);
      if (laterAllocs) found.push(`تسويات سندات (${laterAllocs})`);
      if (laterReturns) found.push(`مرتجعات (${laterReturns})`);
      if (laterMoves) found.push(`حركات مخزون (${laterMoves})`);
    }
    return found;
  }

  // ============================ خط الترحيل ============================

  async run(dto: { fromDate: string; toDate: string; note?: string }, userId: number) {
    const from = new Date(dto.fromDate);
    const to = new Date(dto.toDate);
    const r = this.range(from, to);
    const checks = await this.prechecks(dto.fromDate, dto.toDate);
    const failed = checks.filter((c) => !c.ok);

    const code = await this.nextCode();
    const run = await this.prisma.archiveRun.create({
      data: {
        code,
        fromDate: from,
        toDate: to,
        status: failed.length ? 'FAILED' : 'PRECHECKS',
        checks: checks as unknown as Prisma.InputJsonValue,
        note: dto.note ?? null,
        createdById: userId,
      },
    });

    if (failed.length) {
      this.logger.warn(`archive ${code} failed prechecks: ${failed.map((f) => f.key).join(',')}`);
      throw new BadRequestException({
        message: 'فشل فحص ما قبل الترحيل — لم يتم إنشاء الحزمة',
        runId: run.id,
        code,
        checks,
      });
    }

    try {
      const backupPath = await this.backup(code);
      const bundle = await this.exportBundle(r, code);
      const verify = await this.verify(r, bundle.manifest);
      if (!verify.ok) throw new Error(`مطابقة فشلت: ${verify.detail}`);

      await this.prisma.archiveRun.update({
        where: { id: run.id },
        data: {
          status: 'READY',
          manifest: bundle.manifest as unknown as Prisma.InputJsonValue,
          counts: bundle.manifest.counts as unknown as Prisma.InputJsonValue,
          bundlePath: bundle.zipId,
          bundleSha256: bundle.zipSha256,
          backupPath,
        },
      });

      this.logger.log(`archive ${code} ready: zip sha256=${bundle.zipSha256.slice(0, 12)}…`);
      await this.audits.write({
        userId,
        action: 'archive.run',
        entity: 'ArchiveRun',
        entityId: run.id,
        afterJson: { code, fromDate: dto.fromDate, toDate: dto.toDate, status: 'READY', counts: bundle.manifest.counts, bundleSha256: bundle.zipSha256 },
      });
      return {
        id: run.id,
        code,
        status: 'READY' as const,
        checks,
        manifest: bundle.manifest,
        bundleSha256: bundle.zipSha256,
        backupPath,
      };
    } catch (err) {
      await this.prisma.archiveRun.update({ where: { id: run.id }, data: { status: 'FAILED' } });
      this.logger.error(`archive ${code} failed: ${String(err)}`);
      throw new BadRequestException(
        `تعذّر إنشاء حزمة الأرشيف: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** نسخة احتياطية كاملة (gzip JSON لكل الجداول) */
  private async backup(code: string): Promise<string> {
    const dump: Row = {};
    const read = async <T extends object>(key: string, q: Promise<T[]>): Promise<void> => {
      dump[key] = (await q) as unknown as Row;
    };
    await Promise.all([
      read('users', this.prisma.user.findMany({ omit: { passwordHash: true } })),
      read('roles', this.prisma.role.findMany()),
      read('categories', this.prisma.category.findMany()),
      read('brands', this.prisma.brand.findMany()),
      read('units', this.prisma.unit.findMany()),
      read('items', this.prisma.item.findMany()),
      read('item_units', this.prisma.itemUnit.findMany()),
      read('item_prices', this.prisma.itemPrice.findMany()),
      read('price_lists', this.prisma.priceList.findMany()),
      read('customers', this.prisma.customer.findMany()),
      read('suppliers', this.prisma.supplier.findMany()),
      read('warehouses', this.prisma.warehouse.findMany()),
      read('stock_balances', this.prisma.stockBalance.findMany()),
      read('price_statements', this.prisma.priceStatement.findMany()),
      read('price_statement_lines', this.prisma.priceStatementLine.findMany()),
      read('statement_revisions', this.prisma.statementRevision.findMany()),
      read('return_statements', this.prisma.returnStatement.findMany()),
      read('return_lines', this.prisma.returnLine.findMany()),
      read('purchase_statements', this.prisma.purchaseStatement.findMany()),
      read('purchase_statement_lines', this.prisma.purchaseStatementLine.findMany()),
      read('receipts', this.prisma.receipt.findMany()),
      read('receipt_allocations', this.prisma.receiptAllocation.findMany()),
      read('payments', this.prisma.payment.findMany()),
      read('cheques', this.prisma.cheque.findMany()),
      read('stock_movements', this.prisma.stockMovement.findMany()),
      read('stocktake_sessions', this.prisma.stocktakeSession.findMany()),
      read('stocktake_lines', this.prisma.stocktakeLine.findMany()),
      read('ledger_entries', this.prisma.ledgerEntry.findMany()),
      read('periods', this.prisma.period.findMany()),
      read('number_blocks', this.prisma.numberBlock.findMany()),
      read('approvals', this.prisma.approval.findMany()),
      read('audit_logs', this.prisma.auditLog.findMany()),
    ]);
    const gz = gzipSync(Buffer.from(JSON.stringify(dump), 'utf8'), { level: 9 });
    const id = await this.storage.save(`archives/backups/backup-${code}.json.gz`, gz);
    this.logger.log(`backup ${code}: ${gz.length} bytes`);
    return id;
  }

  /** التصدير: JSON كامل + CSV لكل نوع + manifest بـ SHA-256 لكل ملف */
  private async exportBundle(r: Range, code: string) {
    const rows: Record<ArchiveTable, Row[]> = {
      price_statements: await this.prisma.priceStatement.findMany({ where: this.inRange(r, 'date'), orderBy: { id: 'asc' } }),
      price_statement_lines: await this.prisma.priceStatementLine.findMany({
        where: { statement: this.inRange(r, 'date') },
        orderBy: { id: 'asc' },
      }),
      statement_revisions: await this.prisma.statementRevision.findMany({
        where: { statement: this.inRange(r, 'date') },
        orderBy: [{ statementId: 'asc' }, { revisionNo: 'asc' }],
      }),
      return_statements: await this.prisma.returnStatement.findMany({ where: this.inRange(r, 'date'), orderBy: { id: 'asc' } }),
      return_lines: await this.prisma.returnLine.findMany({
        where: { return: this.inRange(r, 'date') },
        orderBy: { id: 'asc' },
      }),
      purchase_statements: await this.prisma.purchaseStatement.findMany({ where: this.inRange(r, 'date'), orderBy: { id: 'asc' } }),
      purchase_statement_lines: await this.prisma.purchaseStatementLine.findMany({
        where: { statement: this.inRange(r, 'date') },
        orderBy: { id: 'asc' },
      }),
      receipts: await this.prisma.receipt.findMany({ where: this.inRange(r, 'receivedAt'), orderBy: { id: 'asc' } }),
      receipt_allocations: await this.prisma.receiptAllocation.findMany({
        where: { OR: [{ receipt: this.inRange(r, 'receivedAt') }, { statement: this.inRange(r, 'date') }] },
        orderBy: { id: 'asc' },
      }),
      payments: await this.prisma.payment.findMany({ where: this.inRange(r, 'paidAt'), orderBy: { id: 'asc' } }),
      cheques: await this.prisma.cheque.findMany({ where: this.inRange(r, 'receivedAt'), orderBy: { id: 'asc' } }),
      stock_movements: await this.prisma.stockMovement.findMany({ where: this.inRange(r, 'createdAt'), orderBy: { id: 'asc' } }),
      stocktake_sessions: await this.prisma.stocktakeSession.findMany({ where: this.inRange(r, 'openedAt'), orderBy: { id: 'asc' } }),
      stocktake_lines: await this.prisma.stocktakeLine.findMany({
        where: { session: this.inRange(r, 'openedAt') },
        orderBy: { id: 'asc' },
      }),
      ledger_entries: await this.prisma.ledgerEntry.findMany({ where: this.inRange(r, 'entryDate'), orderBy: { id: 'asc' } }),
    };

    const counts: Record<string, number> = {};
    for (const t of ARCHIVE_TABLES) counts[t] = rows[t].length;
    const totals = {
      salesNet: sumOf(rows.price_statements, 'net'),
      purchaseNet: sumOf(rows.purchase_statements, 'net'),
      returnsTotal: sumOf(rows.return_statements, 'total'),
      receiptsTotal: sumOf(rows.receipts, 'amount'),
      paymentsTotal: sumOf(rows.payments, 'amount'),
      chequesTotal: sumOf(rows.cheques, 'amount'),
      ledgerDebit: sumOf(rows.ledger_entries, 'debit'),
      ledgerCredit: sumOf(rows.ledger_entries, 'credit'),
    };

    const files: { name: string; bytes: number; sha256: string }[] = [];
    const loose: { name: string; data: Buffer }[] = [];
    const zipEntries: ZipEntry[] = [];
    const writeFile = (name: string, data: Buffer): void => {
      loose.push({ name, data });
      files.push({ name, bytes: data.length, sha256: sha256(data) });
      zipEntries.push({ name: `${code}/${name}`, data });
    };

    writeFile(
      'data.json',
      Buffer.from(
        JSON.stringify(
          {
            code,
            fromDate: r.from.toISOString(),
            toDate: r.to.toISOString(),
            generatedAt: new Date().toISOString(),
            counts,
            totals,
            tables: rows,
          },
          null,
          2,
        ),
        'utf8',
      ),
    );
    for (const t of ARCHIVE_TABLES) writeFile(`${t}.csv`, Buffer.from(toCsv(rows[t]), 'utf8'));

    const manifest = {
      code,
      fromDate: r.from.toISOString(),
      toDate: r.to.toISOString(),
      generatedAt: new Date().toISOString(),
      counts,
      totals,
      files,
      labels: TABLE_LABELS,
    };
    writeFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

    const zip = createZip(zipEntries);
    const zipSha256 = createHash('sha256').update(zip).digest('hex');

    for (const f of loose) await this.storage.save(`archives/${code}/${f.name}`, f.data);
    const zipId = await this.storage.save(`archives/${code}.zip`, zip);

    this.logger.log(`bundle ${code}: ${zipEntries.length} files, zip ${zip.length} bytes`);
    return { manifest, zipId, zipSha256 };
  }

  /** مطابقة الأعداد والإجماليات مع قاعدة البيانات بعد التصدير */
  private async verify(
    r: Range,
    manifest: { counts: Record<string, number>; totals: Record<string, number> },
  ): Promise<{ ok: boolean; detail: string }> {
    const fresh: Record<string, number> = {
      price_statements: await this.prisma.priceStatement.count({ where: this.inRange(r, 'date') }),
      return_statements: await this.prisma.returnStatement.count({ where: this.inRange(r, 'date') }),
      purchase_statements: await this.prisma.purchaseStatement.count({ where: this.inRange(r, 'date') }),
      receipts: await this.prisma.receipt.count({ where: this.inRange(r, 'receivedAt') }),
      payments: await this.prisma.payment.count({ where: this.inRange(r, 'paidAt') }),
      ledger_entries: await this.prisma.ledgerEntry.count({ where: this.inRange(r, 'entryDate') }),
    };
    for (const [k, n] of Object.entries(fresh)) {
      if (manifest.counts[k] !== n) return { ok: false, detail: `${k}: manifest=${manifest.counts[k]} db=${n}` };
    }
    const salesAgg = await this.prisma.priceStatement.aggregate({
      where: this.inRange(r, 'date'),
      _sum: { net: true },
    });
    const dbNet = Number(salesAgg._sum.net ?? 0);
    const manifestNet = Number(manifest.totals.salesNet ?? 0);
    if (Math.abs(dbNet - manifestNet) > 0.01) {
      return { ok: false, detail: `salesNet: manifest=${manifestNet} db=${dbNet}` };
    }
    return { ok: true, detail: 'ok' };
  }

  // ============================ التأكيد: حذف + تدوير ============================

  async confirm(id: number, confirmText: string, userId: number) {
    const run = await this.prisma.archiveRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('عملية الترحيل غير موجودة');
    if (run.status !== 'READY') {
      throw new BadRequestException(`الحالة الحالية "${run.status}" — التأكيد متاح فقط للحزم الجاهزة`);
    }
    if (confirmText.trim() !== CONFIRM_WORD) {
      throw new BadRequestException(`اكتب كلمة التأكيد "${CONFIRM_WORD}" بالضبط لتنفيذ الحذف`);
    }

    const r = this.range(run.fromDate, run.toDate);

    const checks = await this.prechecks(run.fromDate.toISOString(), run.toDate.toISOString());
    const failed = checks.filter((c) => !c.ok);
    if (failed.length) throw new BadRequestException({ message: 'تغيّرت البيانات بعد إنشاء الحزمة — أعد الترحيل', checks });

    const manifest = run.manifest as unknown as { counts?: Record<string, number> } | null;
    const recount = await this.prisma.priceStatement.count({ where: this.inRange(r, 'date') });
    if (manifest?.counts?.price_statements !== undefined && manifest.counts.price_statements !== recount) {
      throw new BadRequestException('عدد بيانات الأسعار تغيّر بعد إنشاء الحزمة — أعد الترحيل');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const period = await tx.period.create({
        data: {
          fromDate: run.fromDate,
          toDate: run.toDate,
          status: 'ARCHIVED',
          archiveFile: run.bundlePath ? this.storage.basename(run.bundlePath) : null,
          checksum: run.bundleSha256,
          closedById: userId,
          closedAt: new Date(),
        },
      });
      const hasOpen = await tx.period.findFirst({ where: { status: 'OPEN' } });
      if (!hasOpen) {
        await tx.period.create({
          data: {
            fromDate: new Date(run.toDate.getTime() + DAY),
            toDate: new Date(run.toDate.getTime() + DAY + 365 * DAY),
            status: 'OPEN',
          },
        });
      }

      const ledger = await this.rollLedger(tx, r, run.id, run.code);
      const opening = await this.rollOpeningBalances(tx, r, run.id);
      const deleted = await this.deleteArchived(tx, r);
      deleted.ledger_entries = ledger.deleted;

      return { periodId: period.id, ledger, opening, deleted };
    });

    const updated = await this.prisma.archiveRun.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        confirmedById: userId,
        confirmedAt: new Date(),
        periodId: result.periodId,
        counts: {
          ...((run.counts as object) ?? {}),
          deleted: result.deleted,
          openingBalances: result.opening,
          rolledLedgerAccounts: result.ledger.created,
        } as unknown as Prisma.InputJsonValue,
      },
      include: { createdBy: { select: { id: true, name: true } }, confirmedBy: { select: { id: true, name: true } } },
    });

    this.logger.log(`archive ${run.code} confirmed by user ${userId}`);
    await this.audits.write({
      userId,
      action: 'archive.confirm',
      entity: 'ArchiveRun',
      entityId: id,
      beforeJson: { status: run.status },
      afterJson: { status: 'CONFIRMED', periodId: result.periodId, deleted: result.deleted, openingBalances: result.opening, rolledLedgerAccounts: result.ledger.created },
    });
    return {
      id,
      code: run.code,
      status: updated.status,
      confirmedAt: updated.confirmedAt,
      deleted: result.deleted,
      openingBalances: result.opening,
      rolledLedgerAccounts: result.ledger.created,
      bundleSha256: run.bundleSha256,
    };
  }

  /** قيد افتتاحي واحد لكل حساب، ثم حذف كل قيود الفترة (يبقى الرصيد كما هو) */
  private async rollLedger(
    tx: Prisma.TransactionClient,
    r: Range,
    runId: number,
    code: string,
  ): Promise<{ created: number; deleted: number }> {
    const entries = await tx.ledgerEntry.findMany({
      where: { entryDate: { lt: r.toEnd } },
      select: { accountType: true, accountId: true, debit: true, credit: true },
    });
    const nets = new Map<string, { accountType: 'CUSTOMER' | 'SUPPLIER' | 'CASH'; accountId: number; net: number }>();
    for (const e of entries) {
      const key = `${e.accountType}:${e.accountId}`;
      const cur = nets.get(key) ?? { accountType: e.accountType, accountId: e.accountId, net: 0 };
      cur.net += Number(e.debit) - Number(e.credit);
      nets.set(key, cur);
    }

    let created = 0;
    for (const { accountType, accountId, net } of nets.values()) {
      if (Math.abs(net) < 0.005) continue;
      await tx.ledgerEntry.create({
        data: {
          entryDate: r.from,
          accountType,
          accountId,
          debit: net > 0 ? net : 0,
          credit: net < 0 ? -net : 0,
          refType: 'archive',
          refId: runId,
          description: `رصيد افتتاحي مرحّل — الأرشيف ${code}`,
        },
      });
      created++;
    }

    const del = await tx.ledgerEntry.deleteMany({
      where: { entryDate: { lt: r.toEnd }, NOT: { refType: 'archive', refId: runId } },
    });
    return { created, deleted: del.count };
  }

  /** أرصدة افتتاحية للفترة الجديدة (§5.11 الخطوة 7) */
  private async rollOpeningBalances(
    tx: Prisma.TransactionClient,
    r: Range,
    runId: number,
  ): Promise<{ customers: number; suppliers: number; items: number; cash: number }> {
    const [customers, suppliers] = await Promise.all([
      tx.customer.findMany({ select: { id: true, openingBalance: true } }),
      tx.supplier.findMany({ select: { id: true, openingBalance: true } }),
    ]);

    const archivedLedger = await tx.ledgerEntry.groupBy({
      by: ['accountType', 'accountId'],
      where: { refType: 'archive', refId: runId },
      _sum: { debit: true, credit: true },
    });
    const ledgerNet = (type: string): number =>
      archivedLedger
        .filter((l) => l.accountType === type)
        .reduce((sum, l) => sum + Number(l._sum.debit ?? 0) - Number(l._sum.credit ?? 0), 0);

    const openingRows: Prisma.OpeningBalanceCreateManyInput[] = [];
    for (const c of customers) {
      const net = archivedLedger
        .filter((l) => l.accountType === 'CUSTOMER' && l.accountId === c.id)
        .reduce((s, l) => s + Number(l._sum.debit ?? 0) - Number(l._sum.credit ?? 0), 0);
      openingRows.push({ runId, kind: 'CUSTOMER', accountId: c.id, amount: Number(c.openingBalance) + net });
    }
    for (const s of suppliers) {
      const net = archivedLedger
        .filter((l) => l.accountType === 'SUPPLIER' && l.accountId === s.id)
        .reduce((acc, l) => acc + Number(l._sum.debit ?? 0) - Number(l._sum.credit ?? 0), 0);
      openingRows.push({ runId, kind: 'SUPPLIER', accountId: s.id, amount: Number(s.openingBalance) + net });
    }

    const [recSum, paySum] = await Promise.all([
      tx.receipt.aggregate({ where: { receivedAt: { lt: r.toEnd } }, _sum: { amount: true } }),
      tx.payment.aggregate({ where: { paidAt: { lt: r.toEnd } }, _sum: { amount: true } }),
    ]);
    const cashAmount =
      Number(recSum._sum.amount ?? 0) - Number(paySum._sum.amount ?? 0) + ledgerNet('CASH');
    openingRows.push({ runId, kind: 'CASH', accountId: 0, amount: Math.round(cashAmount * 100) / 100 });

    const balances = await tx.stockBalance.findMany({
      select: {
        itemId: true,
        warehouseId: true,
        qtyBase: true,
        item: { select: { lastPurchaseCost: true } },
      },
    });
    let itemCount = 0;
    for (const b of balances) {
      const qty = Number(b.qtyBase);
      if (qty === 0) continue;
      itemCount++;
      openingRows.push({
        runId,
        kind: 'ITEM',
        itemId: b.itemId,
        warehouseId: b.warehouseId,
        qtyBase: qty,
        amount: Math.round(qty * Number(b.item.lastPurchaseCost ?? 0) * 100) / 100,
      });
    }

    if (openingRows.length) await tx.openingBalance.createMany({ data: openingRows });
    return { customers: customers.length, suppliers: suppliers.length, items: itemCount, cash: 1 };
  }

  /** حذف بيانات الفترة — أبناء قبل آباء (تسلسلي داخل الترانزاكشن) */
  private async deleteArchived(tx: Prisma.TransactionClient, r: Range): Promise<Record<string, number>> {
    const ids = async (q: Promise<{ id: number }[]>): Promise<number[]> => (await q).map((x) => x.id);
    const stmtIds = await ids(tx.priceStatement.findMany({ where: this.inRange(r, 'date'), select: { id: true } }));
    const receiptIds = await ids(tx.receipt.findMany({ where: this.inRange(r, 'receivedAt'), select: { id: true } }));
    const returnIds = await ids(tx.returnStatement.findMany({ where: this.inRange(r, 'date'), select: { id: true } }));
    const purchaseIds = await ids(tx.purchaseStatement.findMany({ where: this.inRange(r, 'date'), select: { id: true } }));
    const takeIds = await ids(tx.stocktakeSession.findMany({ where: this.inRange(r, 'openedAt'), select: { id: true } }));

    const c: Record<string, number> = {};
    c.stock_reservations = (
      await tx.stockReservation.deleteMany({ where: { refType: 'price_statement', refId: { in: stmtIds } } })
    ).count;
    c.return_lines = (await tx.returnLine.deleteMany({ where: { returnId: { in: returnIds } } })).count;
    c.receipt_allocations = (
      await tx.receiptAllocation.deleteMany({
        where: { OR: [{ receiptId: { in: receiptIds } }, { statementId: { in: stmtIds } }] },
      })
    ).count;
    c.statement_revisions = (await tx.statementRevision.deleteMany({ where: { statementId: { in: stmtIds } } })).count;
    c.price_statement_lines = (
      await tx.priceStatementLine.deleteMany({ where: { statementId: { in: stmtIds } } })
    ).count;
    c.purchase_statement_lines = (
      await tx.purchaseStatementLine.deleteMany({ where: { statementId: { in: purchaseIds } } })
    ).count;
    c.stocktake_lines = (await tx.stocktakeLine.deleteMany({ where: { sessionId: { in: takeIds } } })).count;

    c.return_statements = (await tx.returnStatement.deleteMany({ where: { id: { in: returnIds } } })).count;
    c.price_statements = (await tx.priceStatement.deleteMany({ where: { id: { in: stmtIds } } })).count;
    c.purchase_statements = (await tx.purchaseStatement.deleteMany({ where: { id: { in: purchaseIds } } })).count;
    c.receipts = (await tx.receipt.deleteMany({ where: { id: { in: receiptIds } } })).count;
    c.payments = (await tx.payment.deleteMany({ where: this.inRange(r, 'paidAt') })).count;
    c.cheques = (await tx.cheque.deleteMany({ where: this.inRange(r, 'receivedAt') })).count;
    c.stocktake_sessions = (await tx.stocktakeSession.deleteMany({ where: { id: { in: takeIds } } })).count;
    c.stock_movements = (await tx.stockMovement.deleteMany({ where: this.inRange(r, 'createdAt') })).count;
    c.ledger_entries = 0; // يُحسب من rollLedger
    return c;
  }

  // ============================ السجل / العارض / الاستعادة ============================

  async list() {
    return this.prisma.archiveRun.findMany({
      orderBy: { id: 'desc' },
      select: {
        id: true,
        code: true,
        fromDate: true,
        toDate: true,
        status: true,
        bundleSha256: true,
        note: true,
        createdAt: true,
        confirmedAt: true,
        restoredAt: true,
        createdBy: { select: { id: true, name: true } },
        confirmedBy: { select: { id: true, name: true } },
        _count: { select: { openingBalances: true } },
      },
    });
  }

  async get(id: number) {
    const run = await this.prisma.archiveRun.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        confirmedBy: { select: { id: true, name: true } },
        openingBalances: true,
      },
    });
    if (!run) throw new NotFoundException('عملية الترحيل غير موجودة');
    return run;
  }

  /** تذكير دوري: مضى كم منذ آخر ترحيل */
  async summary() {
    const last = await this.prisma.archiveRun.findFirst({
      where: { status: { in: ['READY', 'CONFIRMED'] } },
      orderBy: { id: 'desc' },
    });
    const readyRuns = await this.prisma.archiveRun.count({ where: { status: 'READY' } });
    if (!last) {
      return {
        lastRun: null,
        monthsSinceLast: null,
        reminder: 'لم يتم أي ترحيل بعد — يُنصح بترحيل دوري لتفريغ قاعدة البيانات التشغيلية',
        readyRuns,
      };
    }
    const base = last.confirmedAt ?? last.createdAt;
    const monthsSinceLast = Math.floor((Date.now() - base.getTime()) / (30 * DAY));
    return {
      lastRun: { code: last.code, status: last.status, confirmedAt: last.confirmedAt, createdAt: last.createdAt },
      monthsSinceLast,
      reminder: monthsSinceLast >= 3 ? `مضى ${monthsSinceLast} أشهر منذ آخر ترحيل (${last.code}) — يُوصى ببدء ترحيل جديد` : null,
      readyRuns,
    };
  }

  /** دفق حزمة التنزيل + اسم الملف */
  async bundleStream(id: number): Promise<{ stream: Readable; name: string }> {
    const run = await this.prisma.archiveRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('عملية الترحيل غير موجودة');
    if (!run.bundlePath || !(await this.storage.exists(run.bundlePath))) {
      throw new NotFoundException('ملف الحزمة غير موجود على القرص');
    }
    return { stream: await this.storage.stream(run.bundlePath), name: this.storage.basename(run.bundlePath) };
  }

  /** عارض الأرشيف: بحث وعرض دون استيراد */
  async viewerData(id: number, query: { type?: string; q?: string; limit?: number }) {
    const run = await this.prisma.archiveRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('عملية الترحيل غير موجودة');
    if (!run.bundlePath) throw new BadRequestException('لا توجد حزمة لهذه العملية');
    const dataId = this.storage.nextTo(run.bundlePath, run.code, 'data.json');
    if (!(await this.storage.exists(dataId))) throw new NotFoundException('بيانات الحزمة غير موجودة على القرص');

    const payload = JSON.parse((await this.storage.load(dataId)).toString('utf8')) as {
      counts: Record<string, number>;
      totals: Record<string, number>;
      tables: Record<string, Row[]>;
    };
    const limit = Math.min(query.limit ?? 200, 1000);
    const wanted = query.type ? [query.type] : Object.keys(payload.tables);
    const out: Record<string, Row[]> = {};
    let truncated = false;
    for (const t of wanted) {
      let rows = payload.tables[t] ?? [];
      if (rows.length > limit) truncated = true;
      if (query.q) {
        const needle = query.q.toLowerCase();
        rows = rows.filter((row) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(needle)));
      }
      out[t] = rows.slice(0, limit);
    }
    return {
      code: run.code,
      fromDate: run.fromDate,
      toDate: run.toDate,
      counts: payload.counts,
      totals: payload.totals,
      labels: TABLE_LABELS,
      rows: out,
      truncated,
    };
  }

  /** استعادة حزمة (للمدير فقط) — تُلغي قيد الافتتاح وتعيد البيانات كما كانت */
  async restore(id: number, confirmText: string, userId?: number) {
    const run = await this.prisma.archiveRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('عملية الترحيل غير موجودة');
    if (run.status !== 'CONFIRMED') throw new BadRequestException('الاستعادة متاحة فقط لعمليات مؤكدة');
    if (confirmText.trim() !== RESTORE_WORD) {
      throw new BadRequestException(`اكتب كلمة التأكيد "${RESTORE_WORD}" بالضبط للاستعادة`);
    }
    const dataId = run.bundlePath ? this.storage.nextTo(run.bundlePath, run.code, 'data.json') : null;
    if (!dataId || !(await this.storage.exists(dataId))) throw new NotFoundException('بيانات الحزمة غير موجودة على القرص');

    const payload = JSON.parse((await this.storage.load(dataId)).toString('utf8')) as { tables: Record<string, Row[]> };
    const t = payload.tables;
    const archivedStmtIds = (t.price_statements ?? []).map((x) => Number(x.id));
    const conflict = archivedStmtIds.length
      ? await this.prisma.priceStatement.count({ where: { id: { in: archivedStmtIds } } })
      : 0;
    if (conflict > 0) throw new BadRequestException('توجد بيانات في نفس المعرّفات — استعادة متعذّرة لتجنب التعارض');

    const restored = await this.prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.deleteMany({ where: { refType: 'archive', refId: id } });
      await tx.openingBalance.deleteMany({ where: { runId: id } });

      const c: Record<string, number> = {};
      const put = async (label: string, p: Promise<{ count: number }>): Promise<void> => {
        c[label] = (await p).count;
      };
      await put(
        'price_statements',
        tx.priceStatement.createMany({ data: asRows<Prisma.PriceStatementCreateManyInput>(t.price_statements) }),
      );
      await put(
        'price_statement_lines',
        tx.priceStatementLine.createMany({
          data: asRows<Prisma.PriceStatementLineCreateManyInput>(t.price_statement_lines),
        }),
      );
      await put(
        'statement_revisions',
        tx.statementRevision.createMany({ data: asRows<Prisma.StatementRevisionCreateManyInput>(t.statement_revisions) }),
      );
      await put(
        'return_statements',
        tx.returnStatement.createMany({ data: asRows<Prisma.ReturnStatementCreateManyInput>(t.return_statements) }),
      );
      await put('return_lines', tx.returnLine.createMany({ data: asRows<Prisma.ReturnLineCreateManyInput>(t.return_lines) }));
      await put(
        'purchase_statements',
        tx.purchaseStatement.createMany({ data: asRows<Prisma.PurchaseStatementCreateManyInput>(t.purchase_statements) }),
      );
      await put(
        'purchase_statement_lines',
        tx.purchaseStatementLine.createMany({
          data: asRows<Prisma.PurchaseStatementLineCreateManyInput>(t.purchase_statement_lines),
        }),
      );
      await put('receipts', tx.receipt.createMany({ data: asRows<Prisma.ReceiptCreateManyInput>(t.receipts) }));
      await put(
        'receipt_allocations',
        tx.receiptAllocation.createMany({ data: asRows<Prisma.ReceiptAllocationCreateManyInput>(t.receipt_allocations) }),
      );
      await put('payments', tx.payment.createMany({ data: asRows<Prisma.PaymentCreateManyInput>(t.payments) }));
      await put('cheques', tx.cheque.createMany({ data: asRows<Prisma.ChequeCreateManyInput>(t.cheques) }));
      await put(
        'stocktake_sessions',
        tx.stocktakeSession.createMany({ data: asRows<Prisma.StocktakeSessionCreateManyInput>(t.stocktake_sessions) }),
      );
      await put(
        'stocktake_lines',
        tx.stocktakeLine.createMany({ data: asRows<Prisma.StocktakeLineCreateManyInput>(t.stocktake_lines) }),
      );
      await put(
        'stock_movements',
        tx.stockMovement.createMany({ data: asRows<Prisma.StockMovementCreateManyInput>(t.stock_movements) }),
      );
      await put(
        'ledger_entries',
        tx.ledgerEntry.createMany({ data: asRows<Prisma.LedgerEntryCreateManyInput>(t.ledger_entries) }),
      );
      if (run.periodId) {
        const refs =
          (await tx.priceStatement.count({ where: { periodId: run.periodId } })) +
          (await tx.purchaseStatement.count({ where: { periodId: run.periodId } })) +
          (await tx.returnStatement.count({ where: { periodId: run.periodId } }));
        if (refs === 0) await tx.period.delete({ where: { id: run.periodId } });
      }
      return c;
    });

    await this.prisma.archiveRun.update({
      where: { id },
      data: { status: 'RESTORED', restoredAt: new Date(), periodId: null },
    });
    this.logger.log(`archive ${run.code} restored`);
    await this.audits.write({
      userId,
      action: 'archive.restore',
      entity: 'ArchiveRun',
      entityId: id,
      beforeJson: { status: run.status },
      afterJson: { status: 'RESTORED', restored },
    });
    return { id, code: run.code, status: 'RESTORED' as const, restored };
  }
}

function sumOf(rows: Row[], field: string): number {
  let sum = 0;
  for (const row of rows) sum += Number(row[field] ?? 0);
  return Math.round(sum * 100) / 100;
}

function asRows<T>(rows?: Row[]): T[] {
  return (rows ?? []) as unknown as T[];
}
