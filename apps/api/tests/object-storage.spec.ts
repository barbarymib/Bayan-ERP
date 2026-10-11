import { mkdtempSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { LocalObjectStorage, resolveLocalRoot } from '../src/common/object-storage.local.js';
import { S3ObjectStorage, toRelativeKey, type S3Env } from '../src/common/object-storage.s3.js';

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