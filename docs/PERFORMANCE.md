# Performance benchmark (G25 / R3-E8, §9)

- Generated: 2026-10-20T10:00:42.260Z
- Dataset: 50,000 items, 50,000 stock balances (code prefix `BENCH-`)
- Base: http://localhost:3000/api
- Node: v24.16.0 on win32

## Single-request latency (10 samples each, warm)

| Endpoint | p50 | p95 | max |
| --- | ---: | ---: | ---: |
| items list (limit=50) | 118 ms | 155 ms | 155 ms |
| items search | 222 ms | 266 ms | 266 ms |
| items page 500 | 339 ms | 448 ms | 448 ms |
| customers list | 31 ms | 33 ms | 33 ms |
| reports stock-values | 2096 ms | 3153 ms | 3153 ms |
| reports stock-summary | 2116 ms | 2384 ms | 2384 ms |
| reports low-stock | 29 ms | 91 ms | 91 ms |
| reports item-card | 40 ms | 47 ms | 47 ms |

## 50-concurrent bursts

| Burst | Requests | Success | p50 | p95 | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| light (list/search/customers/item-card) | 50 | 50 (100.0%) | 1208 ms | 1562 ms | 1588 ms |
| mixed (all endpoints incl. heavy reports) | 50 | 50 (100.0%) | 1610 ms | 10069 ms | 10579 ms |

> Reference machine/dev DB; indicative only. Re-run with `npm run bench`.
> Heavy analytics reports (stock-values/stock-summary/low-stock) scan every
> stock balance with item+unit joins; remediation (R4-B10): a short-TTL
> single-flight cache + a concurrency gate (`common/heavy-cache.ts`) collapse
> identical simultaneous heavy calls to one DB run and cap parallel heavy
> queries, so 50-concurrent mixed bursts stay at ~100% success.
