import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * §12.5 boot-time schema check (GAP G24): verifies that every Prisma migration
 * folder on disk has been applied (has a matching `_prisma_migrations` row)
 * before the API starts serving. Catches "new code, stale DB" at boot instead
 * of surfacing as 500s on first request.
 *
 * Pure (fs + injected query fn) so it is unit-testable without a DB.
 */
export interface MigrationStatus {
  ok: boolean;
  totalOnDisk: number;
  applied: number;
  pending: string[];
}

/**
 * Resolves `prisma/migrations` without `import.meta` (the API builds to
 * CommonJS). Tries `process.cwd()/prisma/migrations` first, then the `dist`
 * layout (`dist/../prisma/migrations`). Throws if neither exists so a
 * misconfigured deploy fails loudly at boot rather than silently skipping.
 */
export function resolveMigrationsDir(): string {
  const candidates = [
    join(process.cwd(), 'prisma', 'migrations'),
    join(process.cwd(), '..', 'prisma', 'migrations'),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  throw new Error(
    `[boot] could not locate prisma/migrations (tried: ${candidates.join(', ')}). ` +
      'Set the working directory to the API package root.',
  );
}

/**
 * Reads the ordered list of migration folder names (the timestamp-prefixed
 * directory names under `prisma/migrations`, excluding helper dirs like
 * `migration_lock.toml`'s siblings and the `_prisma_migrations` bookkeeping).
 */
export function readMigrationFolders(migrationsDir: string): string[] {
  const entries = readdirSync(migrationsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
    .map((e) => e.name)
    .sort();
}

/** Extracts the migration names from `migration.sql` files (sanity only). */
export function hasSql(migrationsDir: string, name: string): boolean {
  try {
    const sql = readFileSync(join(migrationsDir, name, 'migration.sql'), 'utf8');
    return sql.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Compares the folders on disk against the applied migration names reported by
 * Prisma (`SELECT migration_name FROM _prisma_migrations`).
 */
export function checkMigrations(
  migrationsDir: string,
  appliedNames: string[],
): MigrationStatus {
  const folders = readMigrationFolders(migrationsDir);
  const applied = new Set(appliedNames);
  const pending = folders.filter((f) => !applied.has(f));
  return {
    ok: pending.length === 0,
    totalOnDisk: folders.length,
    applied: folders.length - pending.length,
    pending,
  };
}

/**
 * Queries `_prisma_migrations` for applied migration names. Tolerates a missing
 * bookkeeping table (fresh DB) by returning [] so callers report every on-disk
 * migration as pending rather than crashing.
 */
export async function fetchAppliedMigrations(
  queryRaw: (sql: string) => Promise<{ migration_name: string }[]>,
): Promise<string[]> {
  try {
    const rows = await queryRaw(
      'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL',
    );
    return rows.map((r) => r.migration_name);
  } catch {
    return [];
  }
}
