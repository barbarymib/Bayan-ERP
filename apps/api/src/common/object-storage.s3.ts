import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'minio';
import type { Readable } from 'node:stream';
import type { ObjectStorage } from './object-storage.js';

const S3_PREFIX = 's3://';

export interface S3Env {
  endpoint: string;
  port: number;
  useSSL: boolean;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export function readS3Env(): S3Env {
  // يقبل بصيغة URL كاملة (http://minio:9000) أو اسم مضيف خام (minio) —
  // مكتبة minio تتطلب اسم المضيف دون مخطط، وتُشتق useSSL من المخطط عند عدم تحديدها صراحةً.
  const raw = (
    process.env.MINIO_ENDPOINT ??
    process.env.S3_ENDPOINT ??
    'localhost'
  ).trim();
  const m = /^(https?):\/\/([^/?#]+)$/i.exec(raw);
  const scheme = m?.[1]?.toLowerCase();
  const hostPort = (m ? m[2] : raw) ?? raw;
  let host = hostPort;
  let endpointPort: number | undefined;
  if (!hostPort.startsWith('[')) {
    const idx = hostPort.lastIndexOf(':');
    if (idx > -1 && /^\d+$/.test(hostPort.slice(idx + 1))) {
      host = hostPort.slice(0, idx);
      endpointPort = Number(hostPort.slice(idx + 1));
    }
  }
  const accessKey = process.env.MINIO_ACCESS_KEY ?? process.env.S3_ACCESS_KEY ?? 'minioadmin';
  const secretKey = process.env.MINIO_SECRET_KEY ?? process.env.S3_SECRET_KEY ?? 'minioadmin';
  if (
    process.env.NODE_ENV === 'production' &&
    (accessKey === 'minioadmin' || secretKey === 'minioadmin')
  ) {
    throw new Error(
      'S3/MinIO credentials (MINIO_ACCESS_KEY/MINIO_SECRET_KEY or S3_ACCESS_KEY/S3_SECRET_KEY) are required in production',
    );
  }
  const sslEnv = process.env.MINIO_USE_SSL ?? process.env.S3_USE_SSL;
  const useSSL =
    sslEnv !== undefined
      ? ['1', 'true', 'yes', 'on'].includes(String(sslEnv).toLowerCase())
      : scheme === 'https';
  const envPort = process.env.MINIO_PORT ?? process.env.S3_PORT;
  const port = envPort
    ? Number(envPort)
    : (endpointPort ?? (scheme ? (useSSL ? 443 : 80) : 9000));
  return {
    endpoint: host,
    port,
    useSSL,
    region: process.env.S3_REGION ?? 'us-east-1',
    accessKey,
    secretKey,
    bucket: process.env.MINIO_BUCKET ?? process.env.S3_BUCKET ?? 'bayan',
  };
}

/** يُرجِع مفتاحًا نسبيًا صالحًا: يقبل مسارًا نسبيًا أو معرّفًا كامل s3://bucket/key. */
export function toRelativeKey(bucket: string, relPathOrId: string): string {
  return relPathOrId.startsWith(`${S3_PREFIX}${bucket}/`)
    ? relPathOrId.slice(`${S3_PREFIX}${bucket}/`.length)
    : relPathOrId;
}

/** تخزين سحابي متوافق S3 (MinIO أو AWS S3) — المعرّفات بصيغة s3://bucket/key. */
@Injectable()
export class S3ObjectStorage implements ObjectStorage {
  readonly driver = 's3';
  readonly bucket: string;

  private readonly client: Client;
  private readonly logger = new Logger(S3ObjectStorage.name);
  private ensureDone?: Promise<void>;

  constructor(env: S3Env = readS3Env()) {
    this.bucket = env.bucket;
    this.client = new Client({
      endPoint: env.endpoint,
      port: env.port,
      useSSL: env.useSSL,
      region: env.region,
      accessKey: env.accessKey,
      secretKey: env.secretKey,
    });
  }

  /** إنشاء الجرّة إن لم تكن موجودة (مطلوب في MinIO دون إنشائها يدوياً). */
  private ensureBucket(): Promise<void> {
    if (this.ensureDone) return this.ensureDone;
    this.ensureDone = (async () => {
      try {
        const exists = await this.client.bucketExists(this.bucket);
        if (!exists) await this.client.makeBucket(this.bucket, process.env.S3_REGION ?? 'us-east-1');
      } catch (err) {
        this.logger.warn(`bucket check/setup failed (سيحاول مرة أخرى): ${String(err)}`);
      }
    })();
    return this.ensureDone;
  }

  private idOf(key: string): string {
    return `${S3_PREFIX}${this.bucket}/${key}`;
  }

  private keyOf(id: string): string {
    const prefix = `${S3_PREFIX}${this.bucket}/`;
    if (!id.startsWith(prefix)) {
      throw new Error(`معرّف S3 غير صالح: ${id}`);
    }
    return id.slice(prefix.length);
  }

  async save(relPath: string, data: Buffer): Promise<string> {
    await this.ensureBucket();
    const key = toRelativeKey(this.bucket, relPath);
    await this.client.putObject(this.bucket, key, data);
    return this.idOf(key);
  }

  async load(id: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, this.keyOf(id));
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async exists(id: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, this.keyOf(id));
      return true;
    } catch {
      return false;
    }
  }

  async stream(id: string): Promise<Readable> {
    return this.client.getObject(this.bucket, this.keyOf(id));
  }

  nextTo(id: string, ...parts: string[]): string {
    const segments = this.keyOf(id).split('/');
    segments.pop();
    segments.push(...parts);
    return this.idOf(segments.join('/'));
  }

  basename(id: string): string {
    const key = this.keyOf(id);
    const idx = key.lastIndexOf('/');
    return idx >= 0 ? key.slice(idx + 1) : key;
  }

  async remove(id: string): Promise<void> {
    await this.client.removeObject(this.bucket, this.keyOf(id));
  }
}