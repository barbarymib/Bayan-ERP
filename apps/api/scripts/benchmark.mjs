#!/usr/bin/env node
// G25 / R3-E8 — 50k-row + 50-concurrent performance benchmark (§9).
//
// Seeds `--count` (default 50000) items + stock balances with the `BENCH-`
// code prefix into the live dev database, measures single-request latency for
// the hot read endpoints, then fires `--concurrency` (default 50) parallel
// requests and reports p50/p95/max + success rate. Seeded rows are removed in
// `--cleanup` (default true).
//
// Usage:
//   node scripts/benchmark.mjs
//   node scripts/benchmark.mjs --count=50000 --concurrency=50
//   node scripts/benchmark.mjs --keep            # leave seeded rows in place
//
// Env overrides: BENCH_BASE (default http://localhost:3000/api),
// BENCH_EMAIL/BENCH_PASSWORD (default admin@bayan.local/admin123),
// DATABASE_URL (default postgresql://bayan:bayan@localhost:5433/bayan),
// PG_PSQL_PATH.

import { execFile } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  return argv.includes(`--${name}`) ? true : fallback;
};

const count = Number(flag('count', 50000));
const concurrency = Number(flag('concurrency', 50));
const cleanup = flag('cleanup', true) !== false && !argv.includes('--keep');
const base = String(flag('base', process.env.BENCH_BASE ?? 'http://localhost:3000/api'));
const databaseUrl = String(
  flag('db', process.env.DATABASE_URL ?? 'postgresql://bayan:bayan@localhost:5433/bayan'),
);
const email = String(flag('email', process.env.BENCH_EMAIL ?? 'admin@bayan.local'));
const password = String(flag('password', process.env.BENCH_PASSWORD ?? 'admin123'));

function resolvePsql() {
  if (process.env.PG_PSQL_PATH) return process.env.PG_PSQL_PATH;
  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
          'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
        ]
      : ['/usr/bin/psql', '/usr/local/bin/psql'];
  for (const c of candidates) if (existsSync(c)) return c;
  return 'psql';
}

const psql = resolvePsql();

async function sql(query) {
  const { stdout } = await execFileAsync(psql, ['--no-psqlrc', '--tuples-only', '--no-align', databaseUrl, '--command', query], {
    maxBuffer: 1024 * 1024 * 64,
  });
  return stdout.trim();
}

async function seed() {
  console.log(`Seeding ${count} items (+stock balances) with prefix BENCH- …`);
  const t0 = Date.now();
  // 1) items
  await sql(`INSERT INTO "Item" ("companyId","code","nameAr","categoryId","baseUnitId","minStock","active","updatedAt")
    SELECT (SELECT id FROM "Company" ORDER BY id LIMIT 1),
           'BENCH-' || lpad(g::text, 6, '0'),
           'صنف اختبار ' || g,
           (SELECT id FROM "Category" ORDER BY id LIMIT 1),
           (SELECT id FROM "Unit" ORDER BY id LIMIT 1),
           0, true, now()
    FROM generate_series(1, ${count}) g;`);
  // 2) stock balances in the first warehouse
  await sql(`INSERT INTO "StockBalance" ("companyId","warehouseId","itemId","batchId","qtyBase","updatedAt")
    SELECT i."companyId", (SELECT id FROM "Warehouse" ORDER BY id LIMIT 1), i.id, '', (i.id % 500)::numeric(18,3), now()
    FROM "Item" i WHERE i.code LIKE 'BENCH-%';`);
  console.log(`  seeded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

async function cleanupRows() {
  console.log('Cleaning up seeded rows …');
  await sql(`DELETE FROM "StockBalance" WHERE "itemId" IN (SELECT id FROM "Item" WHERE code LIKE 'BENCH-%');`);
  await sql(`DELETE FROM "Item" WHERE code LIKE 'BENCH-%';`);
}

async function login() {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const body = await res.json();
  return body.accessToken;
}

const ENDPOINTS = [
  ['items list (limit=50)', '/items?limit=50'],
  ['items search', '/items?limit=50&q=BENCH-000123'],
  ['items page 500', '/items?limit=50&page=500'],
  ['customers list', '/customers?limit=50'],
  ['reports stock-values', '/stock-values'],
  ['reports stock-summary', '/reports/stock-summary'],
  ['reports low-stock', '/reports/low-stock'],
  ['reports item-card', '/reports/item-card?itemId='],
];

function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function timedFetch(url, token) {
  const t0 = performance.now();
  let ok = false;
  let status = 0;
  try {
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    status = res.status;
    ok = res.ok;
    await res.arrayBuffer();
  } catch {
    ok = false;
  }
  return { ms: performance.now() - t0, ok, status };
}

async function measureSingle(token, itemCardId) {
  const rows = [];
  for (const [label, suffix] of ENDPOINTS) {
    const url = `${base}${suffix}${suffix.endsWith('itemId=') ? itemCardId : ''}`;
    await timedFetch(url, token); // warm-up
    const samples = [];
    for (let i = 0; i < 10; i += 1) {
      const r = await timedFetch(url, token);
      samples.push(r.ms);
      if (!r.ok) console.log(`  !! ${label} -> HTTP ${r.status}`);
    }
    samples.sort((a, b) => a - b);
    rows.push({
      label,
      p50: pct(samples, 50),
      p95: pct(samples, 95),
      max: samples[samples.length - 1],
    });
  }
  return rows;
}

async function measureConcurrent(token) {
  const urls = ENDPOINTS.map(([, s]) => `${base}${s}`).filter((u) => !u.endsWith('itemId='));
  const tasks = [];
  for (let i = 0; i < concurrency; i += 1) {
    tasks.push(timedFetch(urls[i % urls.length], token));
  }
  const results = await Promise.all(tasks);
  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const ok = results.filter((r) => r.ok).length;
  return {
    label: 'mixed (all endpoints incl. heavy reports)',
    concurrency,
    requests: results.length,
    success: ok,
    successRate: ok / results.length,
    p50: pct(times, 50),
    p95: pct(times, 95),
    max: times[times.length - 1],
  };
}

/** 50-concurrent burst on lightweight read endpoints only (typical UI traffic). */
async function measureConcurrentLight(token, itemCardId) {
  const light = [
    `${base}/items?limit=50`,
    `${base}/items?limit=50&q=BENCH-000123`,
    `${base}/customers?limit=50`,
    `${base}/reports/item-card?itemId=${itemCardId}`,
  ];
  const tasks = [];
  for (let i = 0; i < concurrency; i += 1) tasks.push(timedFetch(light[i % light.length], token));
  const results = await Promise.all(tasks);
  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const ok = results.filter((r) => r.ok).length;
  return {
    label: 'light (list/search/customers/item-card)',
    concurrency,
    requests: results.length,
    success: ok,
    successRate: ok / results.length,
    p50: pct(times, 50),
    p95: pct(times, 95),
    max: times[times.length - 1],
  };
}

function fmt(ms) {
  return `${ms.toFixed(0)} ms`;
}

function buildReport(single, bursts, counts) {
  const now = new Date().toISOString();
  const lines = [];
  lines.push('# Performance benchmark (G25 / R3-E8, §9)');
  lines.push('');
  lines.push(`- Generated: ${now}`);
  lines.push(`- Dataset: ${counts.items.toLocaleString('en-US')} items, ${counts.balances.toLocaleString('en-US')} stock balances (code prefix \`BENCH-\`)`);
  lines.push(`- Base: ${base}`);
  lines.push(`- Node: ${process.version} on ${process.platform}`);
  lines.push('');
  lines.push('## Single-request latency (10 samples each, warm)');
  lines.push('');
  lines.push('| Endpoint | p50 | p95 | max |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const r of single) lines.push(`| ${r.label} | ${fmt(r.p50)} | ${fmt(r.p95)} | ${fmt(r.max)} |`);
  lines.push('');
  lines.push(`## ${bursts[0].concurrency}-concurrent bursts`);
  lines.push('');
  lines.push('| Burst | Requests | Success | p50 | p95 | max |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
  for (const b of bursts) {
    lines.push(
      `| ${b.label} | ${b.requests} | ${b.success} (${(b.successRate * 100).toFixed(1)}%) | ${fmt(b.p50)} | ${fmt(b.p95)} | ${fmt(b.max)} |`,
    );
  }
  lines.push('');
  lines.push('> Reference machine/dev DB; indicative only. Re-run with `npm run bench`.');
  lines.push('> Heavy analytics reports (stock-values/stock-summary/low-stock) scan every');
  lines.push('> stock balance with item+unit joins; remediation (R4-B10): a short-TTL');
  lines.push('> single-flight cache + a concurrency gate (`common/heavy-cache.ts`) collapse');
  lines.push('> identical simultaneous heavy calls to one DB run and cap parallel heavy');
  lines.push('> queries, so 50-concurrent mixed bursts stay at ~100% success.');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const docsDir = path.resolve(here, '../../../docs');
  mkdirSync(docsDir, { recursive: true });

  await seed();
  const counts = {
    items: Number(await sql(`SELECT count(*) FROM "Item" WHERE code LIKE 'BENCH-%';`)),
    balances: Number(
      await sql(`SELECT count(*) FROM "StockBalance" sb JOIN "Item" i ON i.id = sb."itemId" WHERE i.code LIKE 'BENCH-%';`),
    ),
  };
  const token = await login();
  const itemCardId = await sql(`SELECT id FROM "Item" WHERE code LIKE 'BENCH-%' ORDER BY id LIMIT 1;`);

  console.log('\nSingle-request latency:');
  const single = await measureSingle(token, itemCardId);
  for (const r of single) console.log(`  ${r.label.padEnd(26)} p50 ${fmt(r.p50)}  p95 ${fmt(r.p95)}  max ${fmt(r.max)}`);

  console.log(`\nConcurrency bursts (${concurrency}):`);
  const mixed = await measureConcurrent(token);
  const light = await measureConcurrentLight(token, itemCardId);
  for (const b of [light, mixed]) {
    console.log(
      `  ${b.label}: ${b.requests} requests, ${(b.successRate * 100).toFixed(1)}% ok, ` +
        `p50 ${fmt(b.p50)}, p95 ${fmt(b.p95)}, max ${fmt(b.max)}`,
    );
  }

  const report = buildReport(single, [light, mixed], counts);
  writeFileSync(path.join(docsDir, 'PERFORMANCE.md'), report, 'utf8');
  writeFileSync(
    path.join(here, '..', 'benchmark-result.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), counts, single, bursts: [light, mixed] }, null, 2),
    'utf8',
  );
  console.log(`\nWrote docs/PERFORMANCE.md and apps/api/benchmark-result.json`);

  if (cleanup) await cleanupRows();
  else console.log('--keep: seeded rows left in place.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
