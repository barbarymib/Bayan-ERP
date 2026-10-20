import type { PushMessage, PushProvider, PushResult } from './push.js';

/**
 * مزوّد دفع صامت يُستخدم عند غياب مفاتيح Firebase: يسجّل الرسل كنجاح دون
 * إجراء شبكة، فيبقى مسار الإشعارات (DB + هذه الطبقة) قابلاً للاختبار والتشغيل.
 */
export class NoopPushProvider implements PushProvider {
  readonly driver = 'noop' as const;
  readonly sent: PushMessage[] = [];

  async send(message: PushMessage): Promise<PushResult> {
    this.sent.push(message);
    return { token: message.token, ok: true };
  }

  async sendAll(messages: PushMessage[]): Promise<PushResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }
}
