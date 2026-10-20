/** رمز حقن خدمة دفع الإشعارات (FCM HTTP v1 أو بديل صامت). */
export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');

/** رسالة دفع بسيطة موجّهة لرمز جهاز مفرد. */
export interface PushMessage {
  /** رمز جهاز FCM. */
  token: string;
  title: string;
  body?: string;
  /** بيانات وصفية إضافية تُسلَّم مع الإشعار (نوع الإشعار ومعرّفه). */
  data?: Record<string, string>;
}

export interface PushResult {
  token: string;
  ok: boolean;
  /** معرّف رسالة FCM عند النجاح. */
  messageId?: string;
  /** رمز الخطأ عند الفشل (مثلاً UNREGISTERED). */
  error?: string;
  /** هل يجب حذف الرمز؟ (رمز غير صالح/غير مسجّل). */
  invalid?: boolean;
}

/**
 * مزوّد دفع موحّد — يخفي تفاصيل FCM خلف واجهة واحدة، على غرار
 * `ObjectStorage` (محلي/S3). البديل الصامت يسمح بتشغيل النظام دون مفاتيح
 * Firebase مع إبقاء مسار الإشعارات سليماً.
 */
export interface PushProvider {
  readonly driver: 'fcm' | 'noop';
  /** إرسال رسالة واحدة؛ لا يرمي عند فشل التسليم (يعيد النتيجة). */
  send(message: PushMessage): Promise<PushResult>;
  /** إرسال دفعة رسائل (متوازٍ محدود). */
  sendAll(messages: PushMessage[]): Promise<PushResult[]>;
}

/** الرموز التي تعني أن الجهاز لم يعد صالحاً فيجب إبطاله. */
export const INVALID_TOKEN_ERRORS = ['UNREGISTERED', 'INVALID_ARGUMENT', 'NOT_FOUND'] as const;
