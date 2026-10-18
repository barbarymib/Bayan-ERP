import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkMigrations, readMigrationFolders } from '../src/migrations-check/migrations-check.js';

function makeMigrationsDir(names: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'mig-'));
  for (const n of names) {
    mkdirSync(join(dir, n));
    writeFileSync(join(dir, n, 'migration.sql'), 'SELECT 1;');
  }
  return dir;
}

describe('checkMigrations', () => {
  it('reports all pending on a fresh DB', () => {
    const dir = makeMigrationsDir(['20260101000000_init', '20260102000000_second']);
    const status = checkMigrations(dir, []);
    expect(status.ok).toBe(false);
    expect(status.totalOnDisk).toBe(2);
    expect(status.applied).toBe(0);
    expect(status.pending).toEqual(['20260101000000_init', '20260102000000_second']);
    rmSync(dir, { recursive: true, force: true });
  });

  it('reports ok when every folder is applied', () => {
    const dir = makeMigrationsDir(['20260101000000_init', '20260102000000_second']);
    const status = checkMigrations(dir, ['20260101000000_init', '20260102000000_second']);
    expect(status.ok).toBe(true);
    expect(status.applied).toBe(2);
    expect(status.pending).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it('lists only the missing migration as pending', () => {
    const dir = makeMigrationsDir(['20260101000000_init', '20260102000000_second']);
    const status = checkMigrations(dir, ['20260101000000_init']);
    expect(status.ok).toBe(false);
    expect(status.applied).toBe(1);
    expect(status.pending).toEqual(['20260102000000_second']);
    rmSync(dir, { recursive: true, force: true });
  });

  it('sorts folders lexicographically (timestamp order)', () => {
    const dir = makeMigrationsDir(['20260103_c', '20260101_a', '20260102_b']);
    expect(readMigrationFolders(dir)).toEqual(['20260101_a', '20260102_b', '20260103_c']);
    rmSync(dir, { recursive: true, force: true });
  });

  it('ignores the _prisma_migrations bookkeeping dir', () => {
    const dir = makeMigrationsDir(['20260101_init']);
    mkdirSync(join(dir, '_prisma_migrations'));
    expect(readMigrationFolders(dir)).toEqual(['20260101_init']);
    rmSync(dir, { recursive: true, force: true });
  });
});
