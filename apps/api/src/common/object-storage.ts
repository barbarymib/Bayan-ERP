import type { Readable } from 'node:stream';

/** رمز حقن خدمة تخزين الملفات (محلي أو S3/MinIO). */
export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

/** مكبّرات الملفات الكبيرة (أرشيفات + نسخ احتياطية) خلف واجهة موحدة. */
export interface ObjectStorage {
  readonly driver: 'local' | 's3';

  /** يكتب بايتات تحت مفتاح نسبي ويعيد المعرّف المستمر (مسار محلي مطلق أو s3://bucket/key). */
  save(relPath: string, data: Buffer): Promise<string>;

  /** يقرأ بايتات من معرّف مستمر. */
  load(id: string): Promise<Buffer>;

  /** هل المعرّف المستمر موجود؟ */
  exists(id: string): Promise<boolean>;

  /** دفق قراءة للمعرف المستمر (للتنزيل). */
  stream(id: string): Promise<Readable>;

  /** معرّف مستمر لأخت في نفس "المجلد" (تُستعمل لبيانات الحزمة المتناثرة). */
  nextTo(id: string, ...parts: string[]): string;

  /** اسم الملف (بدون مجلدات) من معرّف مستمر. */
  basename(id: string): string;

  /** حذف المعرّف المستمر (تنظيف عند الفشل). */
  remove(id: string): Promise<void>;
}