import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import * as path from 'node:path';
import type { Readable } from 'node:stream';
import type { ObjectStorage } from './object-storage.js';

/** جذر التخزين المحلي الافتراضي (يمكن تخصيصه بـ STORAGE_LOCAL_DIR). */
export function resolveLocalRoot(): string {
  return process.env.STORAGE_LOCAL_DIR ?? path.join(process.cwd(), 'storage');
}

/** تخزين على القرص المحلي — نفس سلوك الأرشيف/النسخ السابق مع معرّفات موحدة. */
export class LocalObjectStorage implements ObjectStorage {
  readonly driver = 'local';

  constructor(private readonly root: string) {}

  private resolve(id: string): string {
    return path.isAbsolute(id) ? id : path.join(this.root, id);
  }

  async save(relPath: string, data: Buffer): Promise<string> {
    const abs = this.resolve(relPath);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, data);
    return abs;
  }

  async load(id: string): Promise<Buffer> {
    return readFileSync(this.resolve(id));
  }

  async exists(id: string): Promise<boolean> {
    return existsSync(this.resolve(id));
  }

  stream(id: string): Promise<Readable> {
    return Promise.resolve(createReadStream(this.resolve(id)));
  }

  nextTo(id: string, ...parts: string[]): string {
    return path.join(path.dirname(this.resolve(id)), ...parts);
  }

  basename(id: string): string {
    return path.basename(this.resolve(id));
  }

  async remove(id: string): Promise<void> {
    rmSync(this.resolve(id), { force: true });
  }
}