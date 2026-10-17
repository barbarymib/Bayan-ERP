import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import { PriceStatementsService } from '../price-statements/price-statements.service.js';
import { ReturnsService } from '../returns/returns.service.js';
import { CollectionsService } from '../collections/collections.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SalesOpsService } from '../common/sales-ops.service.js';
import { StocktakesService } from '../stocktakes/stocktakes.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { StocktakeCountsDto } from '../stocktakes/stocktakes.dto.js';
import type { CreateStatementDto, StatementLineInputDto, DiscountInputDto } from '../price-statements/price-statements.dto.js';
import type { DeviceRegisterDto, PushItemDto, PushDto, ReserveBlockDto } from './sync.dto.js';

/** عدد افتراضي للأرقام المحجوزة للجهاز. */
const DEFAULT_BLOCK_COUNT = 100;

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : undefined;
};

const isUniqueViolation = (e: unknown): boolean => (e as { code?: string })?.code === 'P2002';

/** تحويل حالة بيان في قاعدة البيانات إلى حالة مزامنة للجهاز. */
const mapStatementStatus = (s: string): 'UPLOADED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' =>
  s === 'APPROVED'
    ? 'APPROVED'
    : s === 'PENDING_REVIEW'
      ? 'PENDING_REVIEW'
      : s === 'CANCELLED'
        ? 'REJECTED'
        : 'UPLOADED';

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statements: PriceStatementsService,
    private readonly returnsSvc: ReturnsService,
    private readonly collections: CollectionsService,
    private readonly notifications: NotificationsService,
    private readonly ops: SalesOpsService,
    private readonly stocktakes: StocktakesService,
    private readonly audits: AuditLogsService,
  ) {}

  /** ربط جهاز واحد لكل مستخدم (§5.12). */
  async registerDevice(user: AuthUser, dto: DeviceRegisterDto) {
    const companyId = user.companyId ?? null;
    const existing = await this.prisma.deviceRegistration.findFirst({
      where: { deviceId: dto.deviceId, ...tenantWhere(companyId) },
    });
    if (existing && existing.userId !== user.id) {
      throw new ForbiddenException('Device already registered to another user');
    }
    if (existing) {
      return this.prisma.deviceRegistration.update({
        where: { id: existing.id },
        data: {
          active: true,
          lastSeenAt: new Date(),
          ...(dto.deviceName ? { deviceName: dto.deviceName } : {}),
        },
      });
    }
    // إلغاء الأجهزة الأخرى لنفس المستخدم (جهاز واحد)
    await this.prisma.deviceRegistration.updateMany({
      where: { userId: user.id, active: true, ...tenantWhere(companyId) },
      data: { active: false },
    });
    return this.prisma.deviceRegistration.create({
      data: {
        userId: user.id,
        deviceId: dto.deviceId,
        deviceName: dto.deviceName,
        active: true,
        lastSeenAt: new Date(),
        companyId,
      },
    });
  }

  /** حجز كتلة أرقام مخصصة للجهاز — يستهلكها الخادم افتراضياً لتفادي أي تضارب مع الترقيم المركزي. */
  async reserveBlocks(user: AuthUser, dto: ReserveBlockDto) {
    const companyId = user.companyId ?? null;
    const ownerCode = dto.repCode || user.repCode || '';
    const count = dto.count ?? DEFAULT_BLOCK_COUNT;
    for (let attempt = 0; attempt < 5; attempt++) {
      // كتل الجهاز تبقى على الفترة الافتراضية (0) — التطبيق أوفلاين لا يطبّق مقطع السنة.
      const last = await this.prisma.numberBlock.findFirst({
        where: { prefix: dto.kind, ownerCode, period: 0, ...tenantWhere(companyId) },
        orderBy: { toNo: 'desc' },
      });
      const from = (last?.toNo ?? 0) + 1;
      const to = from + count - 1;
      try {
        await this.prisma.numberBlock.create({
          data: { prefix: dto.kind, ownerCode, period: 0, fromNo: from, toNo: to, lastUsed: to, companyId },
        });
        return { kind: dto.kind, repCode: ownerCode, from, to, used: 0 };
      } catch (e) {
        if (isUniqueViolation(e)) continue;
        throw e;
      }
    }
    throw new ConflictException(`Number block busy for ${dto.kind}-${ownerCode}`);
  }

  /** مزامنة تفاضلية: الأصناف + عملاء المندوب بأرصدتهم + كتل أرقامه. */
  async delta(user: AuthUser, since?: string) {
    const companyId = user.companyId ?? null;
    const cursor = since ? parseDate(since) : undefined;
    if (since && !cursor) throw new BadRequestException(`Invalid since=${since}`);

    const items = await this.prisma.item.findMany({
      where: {
        active: true,
        ...tenantWhere(companyId),
        ...(cursor ? { updatedAt: { gt: cursor } } : {}),
      },
      include: { baseUnit: { select: { code: true } }, category: { select: { code: true } } },
      orderBy: { id: 'asc' },
    });

    const assignments = await this.prisma.customerRepAssignment.findMany({
      where: { repId: user.id, toDate: null, ...tenantWhere(companyId) },
      select: { customerId: true },
    });
    const ids = assignments.map((a) => a.customerId);
    const customers =
      ids.length > 0
        ? await this.prisma.customer.findMany({
            where: { id: { in: ids }, active: true, ...tenantWhere(companyId) },
            orderBy: { nameAr: 'asc' },
          })
        : [];

    // قوائم الأسعار النشطة مع أسعار الأصناف السارية.
    const priceLists = await this.prisma.priceList.findMany({
      where: { active: true, ...tenantWhere(companyId) },
      include: {
        prices: {
          where: { OR: [{ validTo: null }, { validTo: { gt: new Date() } }] },
          select: { itemId: true, unitId: true, price: true },
        },
      },
      orderBy: { id: 'asc' },
    });

    // بيانات الأصناف للعملاء (لإصدار المرتجعات أوفلاين + آخر كشف).
    const repStatements =
      ids.length > 0
        ? await this.prisma.priceStatement.findMany({
            where: { customerId: { in: ids }, status: { not: 'CANCELLED' }, ...tenantWhere(companyId) },
            include: {
              lines: {
                select: {
                  id: true,
                  itemId: true,
                  unitId: true,
                  qty: true,
                  qtyBase: true,
                  unitPrice: true,
                  netLine: true,
                },
              },
            },
            orderBy: { id: 'desc' },
            take: 1000,
          })
        : [];
    const lastByCustomer = new Map<number, (typeof repStatements)[number]>();
    for (const st of repStatements) {
      if (!lastByCustomer.has(st.customerId)) lastByCustomer.set(st.customerId, st);
    }

    const withBalance = await Promise.all(
      customers.map(async (c) => {
        const [ledger] = await Promise.all([
          this.prisma.ledgerEntry.aggregate({
            where: { accountType: 'CUSTOMER', accountId: c.id, ...tenantWhere(companyId) },
            _sum: { debit: true, credit: true },
          }),
        ]);
        return {
          id: c.id,
          code: c.code,
          name: c.nameAr,
          phone: c.phone,
          balance: round2(
            Number(c.openingBalance) +
              Number(ledger._sum.debit ?? 0) -
              Number(ledger._sum.credit ?? 0),
          ),
          lat: c.lat != null ? Number(c.lat) : null,
          lng: c.lng != null ? Number(c.lng) : null,
          priceListId: c.priceListId,
          lastStatement: (() => {
            const last = lastByCustomer.get(c.id);
            return last
              ? {
                  id: last.id,
                  number: last.number,
                  date: last.date.toISOString(),
                  net: Number(last.net),
                  status: last.status,
                }
              : null;
          })(),
        };
      }),
    );

    const blocks = await this.prisma.numberBlock.findMany({
      where: { ownerCode: user.repCode ?? '', period: 0, ...tenantWhere(companyId) },
      orderBy: { toNo: 'desc' },
      take: 20,
    });

    return {
      serverTime: new Date().toISOString(),
      items: items.map((i) => ({
        id: i.id,
        code: i.code,
        name: i.nameAr,
        baseUnit: i.baseUnit?.code ?? null,
        categoryCode: i.category?.code ?? null,
        lastPrice: null, // يُرسل مع قائمة أسعار العميل في إصدار لاحق
      })),
      customers: withBalance,
      priceLists: priceLists.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.nameAr,
        prices: p.prices.map((pr) => ({
          itemId: pr.itemId,
          unitId: pr.unitId,
          price: Number(pr.price),
        })),
      })),
      statements: repStatements.map((st) => ({
        id: st.id,
        number: st.number,
        customerId: st.customerId,
        date: st.date.toISOString(),
        status: st.status,
        net: Number(st.net),
        lines: st.lines.map((ln) => ({
          id: ln.id,
          itemId: ln.itemId,
          unitId: ln.unitId,
          qty: Number(ln.qty),
          qtyBase: Number(ln.qtyBase),
          unitPrice: Number(ln.unitPrice),
          netLine: Number(ln.netLine),
        })),
      })),
      blocks: blocks.map((b) => ({
        kind: b.prefix,
        repCode: b.ownerCode,
        from: b.fromNo,
        to: b.toNo,
        // أزِمّة قُدّمت للجهاز: server يحمي النطاق عبر lastUsed=toNo،
        // لكن الاستهلاك الفعلي يُتتبع على الجهاز نفسه ولا يعرفه الخادم.
        used: 0,
      })),
    };
  }

  /** رفع دفعة مستندات أوفلاين — منفذة لكل عنصر مع التكرار عبر clientUuid. */
  async push(user: AuthUser, dto: PushDto) {
    const results = [];
    for (const item of dto.items) {
      try {
        results.push(await this.pushOne(user, item));
      } catch (e) {
        results.push({
          clientUuid: item.clientUuid,
          status: 'PENDING_REVIEW',
          error: (e as Error).message,
        });
      }
    }
    // إشعار المندوب بأي مستند مرفوض أو بانتظار المراجعة (§5.15)
    for (const r of results) {
      if (r.status === 'PENDING_REVIEW' || r.status === 'REJECTED') {
        await this.notifications.notify(user.id, {
          type: 'sync_failed',
          title: 'رفع مستند بانتظار المراجعة',
          body: `المستند ${r.clientUuid} — ${(r as { error?: string }).error ?? 'تم رفض المستند'}`,
          refType: 'sync_push',
        });
      }
    }
    // تدقيق رفع المستندات (لكل مستند تم قبوله على الخادم) (§9)
    for (let i = 0; i < results.length; i++) {
      const r = results[i] as { clientUuid: string; status: string; serverId?: number };
      if (typeof r.serverId === 'number') {
        await this.audits.write({
          userId: user.id,
          action: 'sync.push',
          entity: 'SyncPush',
          entityId: r.serverId,
          afterJson: {
            type: dto.items[i]?.type ?? null,
            clientUuid: r.clientUuid,
            status: r.status,
          },
        });
      }
    }
    return { results };
  }

  private async pushOne(user: AuthUser, item: PushItemDto) {
    if (item.type === 'price_statement') return this.pushPriceStatement(user, item);
    if (item.type === 'return_statement') return this.pushReturnStatement(user, item);
    if (item.type === 'receipt') return this.pushReceipt(user, item);
    if (item.type === 'stocktake') return this.pushStocktake(user, item);
    return {
      clientUuid: item.clientUuid,
      status: 'PENDING_REVIEW' as const,
      error: `type_${item.type}_not_supported_yet`,
    };
  }

  /**
   * رفع عدّات جرد أُنجزت أوفلاين — تُطبَّق على الجلسة مباشرة.
   * لا حاجة لـ clientUuid في الخادم: الإدخال بمفتاح (sessionId, itemId, batchId)
   * فتكرار الرفع يعيد النتيجة نفسها (آخر كتابة تنتصر).
   */
  private async pushStocktake(user: AuthUser, item: PushItemDto) {
    const uuid = item.clientUuid;
    if (!user.permissions.includes('stocktake.execute')) {
      throw new ForbiddenException('لا تملك صلاحية تنفيذ الجرد');
    }
    const payload = item.payload ?? {};
    const sessionId = num(payload['sessionId']);
    if (sessionId === undefined) throw new BadRequestException('payload.sessionId is required');

    const raw = payload['counts'];
    const rows = Array.isArray(raw) ? raw : [];
    if (rows.length === 0) throw new BadRequestException('payload.counts is required');

    const counts = rows.map((r) => {
      const rec = r as Record<string, unknown>;
      const itemId = num(rec['itemId']);
      if (itemId === undefined) throw new BadRequestException('counts[].itemId is required');
      const qty = num(rec['qty'] ?? rec['qtyBase']);
      return {
        itemId,
        batchId: typeof rec['batchId'] === 'string' ? (rec['batchId'] as string) : '',
        qty: qty ?? 0,
      };
    });

    const dto: StocktakeCountsDto = { counts };
    const res = (await this.stocktakes.counts(sessionId, dto, user)) as { id: number };
    return { clientUuid: uuid, status: 'UPLOADED' as const, serverId: res.id };
  }

  private async pushPriceStatement(user: AuthUser, item: PushItemDto) {
    const uuid = item.clientUuid;
    const companyId = user.companyId ?? null;
    const existing = await this.prisma.priceStatement.findFirst({
      where: { clientUuid: uuid, ...tenantWhere(companyId) },
    });
    if (existing) {
      return {
        clientUuid: uuid,
        status: mapStatementStatus(existing.status),
        serverId: existing.id,
        number: existing.number,
      };
    }

    const payload = item.payload ?? {};
    const customerId = num(payload['customerId']);
    if (customerId === undefined) throw new NotFoundException('payload.customerId is required');

    const rawLines = payload['lines'];
    const linesArr = Array.isArray(rawLines) ? rawLines : [];
    if (linesArr.length === 0) throw new NotFoundException('payload.lines is required');

    // تحويل معرّفات الأصناف (إن أُرسلت) إلى أكواد.
    const codeByItemId = new Map<number, string>();
    for (const l of linesArr) {
      const rec = l as Record<string, unknown>;
      const itemId = num(rec['itemId']);
      if (itemId !== undefined && !codeByItemId.has(itemId)) {
        const it = await this.prisma.item.findFirst({ where: { id: itemId, ...tenantWhere(companyId) } });
        if (!it) throw new NotFoundException(`Item ${itemId} not found`);
        codeByItemId.set(itemId, it.code);
      }
    }

    const headerPct = num(payload['headerDiscount']);
    const discount: DiscountInputDto | undefined =
      headerPct !== undefined && headerPct > 0 ? { type: 'percent', value: headerPct } : undefined;

    const dto: CreateStatementDto = {
      customerId,
      date: (payload['date'] as string) || (payload['createdAt'] as string),
      clientUuid: uuid,
      number: item.number,
      paid: num(payload['paid']) ?? 0,
      discount,
      notes:
        typeof payload['notes'] === 'string'
          ? (payload['notes'] as string)
          : `${item.number ? `${item.number} ` : ''}من تطبيق المندوب`,
      lines: linesArr.map((l): StatementLineInputDto => {
        const rec = l as Record<string, unknown>;
        const itemId = num(rec['itemId']);
        const codeFromId = itemId !== undefined ? codeByItemId.get(itemId) : undefined;
        const code = (rec['itemCode'] as string) || codeFromId;
        if (!code) throw new NotFoundException(`line.itemCode is required (itemId=${itemId})`);
        const qty = num(rec['qty']);
        if (qty === undefined || qty <= 0) throw new NotFoundException(`line.qty invalid`);
        const unitPrice = num(rec['unitPrice']);
        const discType = rec['discountType'] === 'amount' ? 'amount' : 'percent';
        const discValue = num(rec['discountValue']);
        const weightNote =
          typeof rec['weightNote'] === 'string' && (rec['weightNote'] as string).trim().length > 0
            ? (rec['weightNote'] as string).trim()
            : undefined;
        return {
          itemCode: code,
          qty,
          ...(unitPrice !== undefined ? { unitPrice } : {}),
          ...(weightNote !== undefined ? { weightNote } : {}),
          discount:
            discValue !== undefined && discValue > 0
              ? ({ type: discType, value: discValue } as DiscountInputDto)
              : undefined,
        };
      }),
    };

    const stmt = await (async () => {
      try {
        return await this.statements.create(dto, user);
      } catch (e) {
        // فشل إتمام الاعتماد: إن أُنشئ البيان، احتُجز للمراجعة مع حجز الكميات (§5.7/G8)
        const created = await this.prisma.priceStatement.findFirst({
          where: { clientUuid: uuid, ...tenantWhere(companyId) },
          select: { id: true, status: true },
        });
        if (created && created.status !== 'CANCELLED') {
          try {
            await this.ops.holdForReview(created.id, user);
          } catch {
            /* best-effort: لا نحجب خطأ الرفع الأصلي */
          }
        }
        throw e;
      }
    })();
    const s = stmt as unknown as {
      id: number;
      net: string | number;
      status: string;
      number: string;
    };
    const net = num(payload['net']);
    if (net !== undefined && Math.abs(Number(s.net) - net) > 0.01) {
      // كميات مخالفة: يُحتجز البيان للمراجعة (عكس الترحيل إن كان معتمداً) مع حجز الكميات (§5.7/G8)
      await this.ops.holdForReview(s.id, user);
      return {
        clientUuid: uuid,
        status: 'PENDING_REVIEW' as const,
        serverId: s.id,
        number: s.number,
        error: 'net_mismatch',
      };
    }
    return {
      clientUuid: uuid,
      status: mapStatementStatus(String(s.status)) as 'UPLOADED',
      serverId: s.id,
      number: s.number,
    };
  }

  private async pushReturnStatement(user: AuthUser, item: PushItemDto) {
    const uuid = item.clientUuid;
    const companyId = user.companyId ?? null;
    const existing = await this.prisma.returnStatement.findFirst({
      where: { clientUuid: uuid, ...tenantWhere(companyId) },
    });
    if (existing) {
      return {
        clientUuid: uuid,
        status: mapStatementStatus(existing.status),
        serverId: existing.id,
        number: existing.number,
      };
    }
    const payload = item.payload ?? {};
    const customerId = num(payload['customerId']);
    if (customerId === undefined) throw new NotFoundException('payload.customerId is required');
    const mode = payload['mode'] === 'BY_CUSTOMER' ? 'BY_CUSTOMER' : 'BY_REP';
    const reasonCode = payload['reasonCode'] as string | undefined;
    const dto: Record<string, unknown> = {
      mode,
      customerId,
      date: payload['date'] as string | undefined,
      reasonCode,
      notes: payload['notes'] as string | undefined,
      settlement: payload['settlement'] as string | undefined,
      clientUuid: uuid,
      number: item.number,
      lines: Array.isArray(payload['lines'])
        ? (payload['lines'] as Record<string, unknown>[]).map((l) => ({
            sourceLineId: Number(l['sourceLineId']),
            qty: Number(l['qty']),
            unitCode: l['unitCode'] as string | undefined,
            condition: String(l['condition'] ?? 'GOOD') === 'DAMAGED' ? 'DAMAGED' : 'GOOD',
          }))
        : [],
    };
    const rtn = await this.returnsSvc.create(
      dto as unknown as Parameters<typeof this.returnsSvc.create>[0],
      user,
    );
    const r = rtn as { id: number; status: string; number: string };
    return {
      clientUuid: uuid,
      status: mapStatementStatus(String(r.status)) as 'UPLOADED',
      serverId: r.id,
      number: r.number,
    };
  }

  private async pushReceipt(user: AuthUser, item: PushItemDto) {
    const uuid = item.clientUuid;
    const companyId = user.companyId ?? null;
    const existing = await this.prisma.receipt.findFirst({
      where: { clientUuid: uuid, ...tenantWhere(companyId) },
    });
    if (existing) {
      return {
        clientUuid: uuid,
        status: 'UPLOADED' as const,
        serverId: existing.id,
        number: existing.number,
      };
    }
    const payload = item.payload ?? {};
    const customerId = num(payload['customerId']);
    if (customerId === undefined) throw new NotFoundException('payload.customerId is required');
    const dto: Record<string, unknown> = {
      customerId,
      amount: Number(payload['amount']),
      method: (payload['method'] as string | undefined) ?? 'CASH',
      statementId: num(payload['statementId']),
      receivedAt: payload['receivedAt'] as string | undefined,
      notes: payload['notes'] as string | undefined,
      chequeNumber: payload['chequeNumber'] as string | undefined,
      bankName: payload['bankName'] as string | undefined,
      chequeDueDate: payload['chequeDueDate'] as string | undefined,
      clientUuid: uuid,
      number: item.number,
    };
    const rc = await this.collections.createReceipt(dto as unknown as Parameters<typeof this.collections.createReceipt>[0], user);
    const r2 = rc as { id: number; number: string };
    return {
      clientUuid: uuid,
      status: 'UPLOADED' as const,
      serverId: r2.id,
      number: r2.number,
    };
  }
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const parseDate = (s: string): Date | null => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};
