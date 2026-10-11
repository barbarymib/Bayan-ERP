import { Global, Logger, Module } from '@nestjs/common';
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage.js';
import { LocalObjectStorage, resolveLocalRoot } from './object-storage.local.js';
import { S3ObjectStorage } from './object-storage.s3.js';

/**
 * يوفّر تخزين الملفات الكبيرة (أرشيفات/نسخ احتياطية) عالمياً.
 * `STORAGE_DRIVER=local|s3` (الافتراضي local — السلوك الحالي دون تغيير).
 */
@Global()
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      useFactory: (): ObjectStorage => {
        const logger = new Logger('ObjectStorage');
        const driver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();
        if (driver === 's3') {
          const storage = new S3ObjectStorage();
          logger.log(`S3 object storage → bucket "${storage.bucket}"`);
          return storage;
        }
        logger.log(`Local object storage → ${resolveLocalRoot()}`);
        return new LocalObjectStorage(resolveLocalRoot());
      },
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class ObjectStorageModule {}