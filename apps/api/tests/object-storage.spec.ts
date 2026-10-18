import { mkdtempSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { LocalObjectStorage, resolveLocalRoot } from '../src/common/object-storage.local.js';
import { S3ObjectStorage, readS3Env, toRelativeKey, type S3Env } from '../src/common/object-storage.s3.js';

const roots: string[] = [];

function tempRoot(tag: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), `bayan-${tag}-`));
  roots.push(dir);
  return dir;
}

afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

describe('LocalObjectStorage', () => {
  it('saves/loads a roundtrip and creates nested dirs', async () => {
    const root = tempRoot('obj');
    const s = new LocalObjectStorage(root);
    const id = await s.save('archives/AR-000001.zip', Buffer.from('zip-bytes'));
    expect(id).toBe(path.join(root, 'archives', 'AR-000001.zip'));
    expect(await s.exists(id)).toBe(true);
    expect((await s.load(id)).toString('utf8')).toBe('zip-bytes');
  });

  it('is tolerant of absolute ids (legacy rows)', async () => {
    const root = tempRoot('obj');
    const s = new LocalObjectStorage(root);
    const id = await s.save('backups/db.sql.enc', Buffer.from('enc'));
    const again = await s.load(id);
    expect(again.length).toBe(3);
    expect(await s.exists(id)).toBe(true);
  });

  it('nextTo resolves a sibling under the same dir', async () => {
    const root = tempRoot('obj');
    const s = new LocalObjectStorage(root);
    const id = path.join(root, 'archives', 'AR-000001.zip');
    const data = s.nextTo(id, 'AR-000001', 'data.json');
    expect(data).toBe(path.join(root, 'archives', 'AR-000001', 'data.json'));
    await s.save('archives/AR-000001/data.json', Buffer.from('{}'));
    expect(await s.exists(data)).toBe(true);
  });

  it('basename/remove behave as a flat key store', async () => {
    const root = tempRoot('obj');
    const s = new LocalObjectStorage(root);
    const id = await s.save('archives/backups/backup-BK-1.json.gz', Buffer.from('gz'));
    expect(s.basename(id)).toBe('backup-BK-1.json.gz');
    await s.remove(id);
    expect(await s.exists(id)).toBe(false);
  });

  it('default root honours STORAGE_LOCAL_DIR else cwd/storage', () => {
    const prev = process.env.STORAGE_LOCAL_DIR;
    try {
      process.env.STORAGE_LOCAL_DIR = 'D:\\archive-root';
      expect(resolveLocalRoot()).toBe('D:\\archive-root');
      delete process.env.STORAGE_LOCAL_DIR;
      expect(resolveLocalRoot()).toBe(path.join(process.cwd(), 'storage'));
    } finally {
      if (prev !== undefined) process.env.STORAGE_LOCAL_DIR = prev;
      else delete process.env.STORAGE_LOCAL_DIR;
    }
  });
});

describe('S3ObjectStorage (pure id helpers, no network)', () => {
  const env: S3Env = {
    endpoint: 'localhost',
    port: 9000,
    useSSL: false,
    region: 'us-east-1',
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
    bucket: 'bayan',
  };

  it('exposes the s3 driver', () => {
    expect(new S3ObjectStorage(env).driver).toBe('s3');
  });

  it('nextTo rewrites the sibling of the object key', () => {
    const s = new S3ObjectStorage(env);
    const data = s.nextTo('s3://bayan/archives/AR-000001.zip', 'AR-000001', 'data.json');
    expect(data).toBe('s3://bayan/archives/AR-000001/data.json');
  });

  it('basename trims the s3://bucket/ prefix', () => {
    const s = new S3ObjectStorage(env);
    expect(s.basename('s3://bayan/archives/AR-000001.zip')).toBe('AR-000001.zip');
    expect(s.basename('s3://bayan/backup.sql.enc')).toBe('backup.sql.enc');
  });

  it('save normalizes a full s3://id to a relative key', () => {
    expect(toRelativeKey('bayan', 'archives/AR-1.zip')).toBe('archives/AR-1.zip');
    expect(toRelativeKey('bayan', 's3://bayan/archives/AR-1.zip')).toBe('archives/AR-1.zip');
    expect(toRelativeKey('other', 's3://bayan/archives/AR-1.zip')).toBe('s3://bayan/archives/AR-1.zip');
  });
});

describe('readS3Env (endpoint parsing)', () => {
  const KEYS = [
    'NODE_ENV', 'S3_ENDPOINT', 'MINIO_ENDPOINT', 'S3_PORT', 'MINIO_PORT',
    'S3_USE_SSL', 'MINIO_USE_SSL', 'S3_ACCESS_KEY', 'MINIO_ACCESS_KEY',
    'S3_SECRET_KEY', 'MINIO_SECRET_KEY',
  ];
  let saved: Record<string, string | undefined>;

  function setEnv(vars: Record<string, string | undefined>): void {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    for (const k of KEYS) delete process.env[k];
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }

  function restoreEnv(): void {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }

  it('parses a full http URL into host/port (minio-js needs a bare hostname)', () => {
    try {
      setEnv({ S3_ENDPOINT: 'http://minio:9000', S3_ACCESS_KEY: 'bayan', S3_SECRET_KEY: 'k' });
      const env = readS3Env();
      expect(env.endpoint).toBe('minio');
      expect(env.port).toBe(9000);
      expect(env.useSSL).toBe(false);
    } finally {
      restoreEnv();
    }
  });

  it('derives https + port 443 from scheme when no explicit port/ssl', () => {
    try {
      setEnv({ S3_ENDPOINT: 'https://s3.example.com', S3_ACCESS_KEY: 'bayan', S3_SECRET_KEY: 'k' });
      const env = readS3Env();
      expect(env.endpoint).toBe('s3.example.com');
      expect(env.port).toBe(443);
      expect(env.useSSL).toBe(true);
    } finally {
      restoreEnv();
    }
  });

  it('keeps legacy raw-hostname behaviour (no scheme → port 9000, no ssl)', () => {
    try {
      setEnv({ S3_ENDPOINT: 'minio', S3_ACCESS_KEY: 'bayan', S3_SECRET_KEY: 'k' });
      const env = readS3Env();
      expect(env.endpoint).toBe('minio');
      expect(env.port).toBe(9000);
      expect(env.useSSL).toBe(false);
    } finally {
      restoreEnv();
    }
  });

  it('explicit S3_PORT wins over the URL port', () => {
    try {
      setEnv({ S3_ENDPOINT: 'http://minio:9000', S3_PORT: '9100', S3_ACCESS_KEY: 'bayan', S3_SECRET_KEY: 'k' });
      expect(readS3Env().port).toBe(9100);
    } finally {
      restoreEnv();
    }
  });

  it('rejects default minioadmin credentials in production', () => {
    try {
      setEnv({ NODE_ENV: 'production', S3_ENDPOINT: 'http://minio:9000' });
      expect(() => readS3Env()).toThrow(/required in production/);
    } finally {
      restoreEnv();
    }
  });
});