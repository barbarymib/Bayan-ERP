import { Global, Logger, Module } from '@nestjs/common';
import { PUSH_PROVIDER, type PushProvider } from './push.js';
import { FcmPushProvider, readFcmEnv } from './push.fcm.js';
import { NoopPushProvider } from './push.noop.js';

/**
 * يوفّر مزوّد دفع الإشعارات عالمياً (§5.15). عند ضبط مفاتيح حساب خدمة Firebase
 * (`FCM_SERVICE_ACCOUNT`/`FCM_SERVICE_ACCOUNT_FILE` + `FCM_PROJECT_ID`) يُستخدم
 * FCM HTTP v1؛ وإلا فالبديل الصامت (لا تسليم فعلي، ومسار الإشعارات سليم).
 */
@Global()
@Module({
  providers: [
    {
      provide: PUSH_PROVIDER,
      useFactory: (): PushProvider => {
        const logger = new Logger('PushProvider');
        const env = readFcmEnv();
        if (env) {
          logger.log(`FCM push transport → project "${env.projectId}"`);
          return new FcmPushProvider(env);
        }
        logger.log('FCM credentials absent → no-op push transport (in-app notifications only)');
        return new NoopPushProvider();
      },
    },
  ],
  exports: [PUSH_PROVIDER],
})
export class PushModule {}
