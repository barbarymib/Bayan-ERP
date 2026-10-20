import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { NoopPushProvider } from '../src/common/push.noop.js';
import { readFcmEnv } from '../src/common/push.fcm.js';
import type { PushMessage, PushProvider, PushResult } from '../src/common/push.js';

afterEach(() => {
  delete process.env.FCM_SERVICE_ACCOUNT;
  delete process.env.FCM_SERVICE_ACCOUNT_FILE;
  delete process.env.FCM_PROJECT_ID;
});

describe('readFcmEnv — اختيار مزوّد الدفع (F2 §5.15)', () => {
  it('يعيد null عند غياب المفاتيح (فيُستخدم البديل الصامت)', () => {
    expect(readFcmEnv()).toBeNull();
  });

  it('يبني الإعدادات من حساب خدمة inline', () => {
    process.env.FCM_SERVICE_ACCOUNT = JSON.stringify({
      project_id: 'bayan-proj',
      client_email: 'svc@bayan-proj.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
    });
    const env = readFcmEnv();
    expect(env).not.toBeNull();
    expect(env?.projectId).toBe('bayan-proj');
    expect(env?.clientEmail).toContain('gserviceaccount.com');
    // الفواصل المُهرّبة (\n) تُفكّ إلى أسطر فعلية لتفكيك PEM.
    expect(env?.privateKey).toContain('\n');
  });

  it('يعيد null عند JSON غير صالح', () => {
    process.env.FCM_SERVICE_ACCOUNT = '{not json}';
    expect(readFcmEnv()).toBeNull();
  });
});

describe('NoopPushProvider — مزوّد الدفع الصامت (F2 §5.15)', () => {
  it('يسجّل الرسائل المرسلة ويعيد النجاح دون شبكة', async () => {
    const provider = new NoopPushProvider();
    const out = await provider.send({ token: 't1', title: 'مرحباً' });
    expect(out).toEqual({ token: 't1', ok: true });
    expect(provider.sent).toHaveLength(1);
    expect(provider.driver).toBe('noop');
  });

  it('sendAll يرسل كل الرسائل', async () => {
    const provider = new NoopPushProvider();
    const out = await provider.sendAll([
      { token: 't1', title: 'a' },
      { token: 't2', title: 'b' },
    ]);
    expect(out.map((r) => r.ok)).toEqual([true, true]);
    expect(provider.sent).toHaveLength(2);
  });
});

function stubPrisma(devices: { id: number; pushToken: string | null }[]) {
  const revoked: string[] = [];
  const prisma = {
    deviceRegistration: {
      findMany: vi.fn(async () => devices),
      updateMany: vi.fn(async (args: { data: { pushToken: null }; where: { pushToken: { in: string[] } } }) => {
        revoked.push(...args.where.pushToken.in);
        return { count: args.where.pushToken.in.length };
      }),
    },
  } as unknown as PrismaService;
  return { prisma, revoked };
}

class FakePush implements PushProvider {
  readonly driver = 'noop' as const;
  readonly sent: PushMessage[] = [];
  constructor(private readonly invalidTokens: string[] = []) {}
  async send(message: PushMessage): Promise<PushResult> {
    this.sent.push(message);
    const invalid = this.invalidTokens.includes(message.token);
    return { token: message.token, ok: !invalid, error: invalid ? 'UNREGISTERED' : undefined, invalid };
  }
  async sendAll(messages: PushMessage[]): Promise<PushResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }
}

describe('NotificationsService.pushToDevices — دفع لأجهزة المستخدم (F2 §5.15)', () => {
  it('يدفع لكل جهاز نشط حامل رمز دفع ويبلّغ عدد النجاح', async () => {
    const { prisma } = stubPrisma([
      { id: 1, pushToken: 'tok-a' },
      { id: 2, pushToken: 'tok-b' },
    ]);
    const push = new FakePush();
    const svc = new NotificationsService(prisma, push);
    const ok = await svc.pushToDevices(7, { type: 'low_stock', title: 'أصناف تحت الحد', body: '3 أصناف' });
    expect(ok).toBe(2);
    expect(push.sent.map((m) => m.token).sort()).toEqual(['tok-a', 'tok-b']);
    expect(push.sent[0]!.data).toMatchObject({ type: 'low_stock' });
  });

  it('يعيد 0 عند عدم وجود أجهزة حاملة رمز دفع', async () => {
    const { prisma } = stubPrisma([]);
    const push = new FakePush();
    const svc = new NotificationsService(prisma, push);
    expect(await svc.pushToDevices(7, { type: 'low_stock', title: 'x' })).toBe(0);
    expect(push.sent).toHaveLength(0);
  });

  it('يُبطل الرموز غير الصالحة ويترك الأخرى', async () => {
    const { prisma, revoked } = stubPrisma([
      { id: 1, pushToken: 'tok-good' },
      { id: 2, pushToken: 'tok-bad' },
    ]);
    const push = new FakePush(['tok-bad']);
    const svc = new NotificationsService(prisma, push);
    const ok = await svc.pushToDevices(7, { type: 'low_stock', title: 'x' });
    expect(ok).toBe(1);
    expect(revoked).toEqual(['tok-bad']);
  });

  it('يبني data مع refType/refId عند وجودهما', async () => {
    const { prisma } = stubPrisma([{ id: 1, pushToken: 'tok-a' }]);
    const push = new FakePush();
    const svc = new NotificationsService(prisma, push);
    await svc.pushToDevices(7, { type: 'return_approval', title: 'x', refType: 'Return', refId: 42 });
    expect(push.sent[0]!.data).toEqual({ type: 'return_approval', refType: 'Return', refId: '42' });
  });
});
