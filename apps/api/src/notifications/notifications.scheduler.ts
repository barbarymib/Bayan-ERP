import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { runWithTenant } from '../tenant/tenant.context.js';
import { NotificationsService } from './notifications.service.js';

/**
 * مجدول التنبيهات الآلية (§5.15، G23): يشغّل `refreshAlerts` دورياً لكل شركة على
 * حِدة (كل شركة داخل سياق مستأجرها لاحترام RLS). بديل داخلي عن طابور BullMQ
 * لتذكيرات الأصناف تحت الحد/الحد الائتماني/الترحيل/النسخ الاحتياطي.
 *
 * التهيئة: `ALERTS_INTERVAL_MS` (افتراضي 3600000 = ساعة، الحد الأدنى 60000)،
 * و`off`/`false` للتعطيل. معطّل تلقائياً في بيئة الاختبار.
 */
@Injectable()
export class NotificationsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    const intervalMs = resolveAlertsIntervalMs();
    if (intervalMs == null) return;
    this.timer = setInterval(() => void this.runAll(), intervalMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
    this.logger.log(`Automatic alert refresh scheduled every ${Math.round(intervalMs / 1000)}s`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** يفحص التنبيهات لكل شركة على حِدة. يفصل كل شركة بسياقها الخاص. */
  async runAll(): Promise<Record<number, unknown>> {
    const companies = await this.prisma.company.findMany({ select: { id: true } });
    const results: Record<number, unknown> = {};
    for (const company of companies) {
      try {
        results[company.id] = await runWithTenant({ companyId: company.id }, () =>
          this.notifications.refreshAlerts(company.id),
        );
      } catch (err) {
        this.logger.error(
          `Alert refresh failed for company ${company.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    return results;
  }
}

/** مهلة التشغيل الدوري بالمللي ثانية، أو null عند التعطيل/بيئة الاختبار. */
export function resolveAlertsIntervalMs(env: NodeJS.ProcessEnv = process.env): number | null {
  if (env.NODE_ENV === 'test') return null;
  const spec = env.ALERTS_INTERVAL_MS ?? '3600000';
  if (spec === 'off' || spec === 'false') return null;
  const value = Number(spec);
  if (!Number.isFinite(value)) return null;
  return value >= 60000 ? value : 60000;
}
