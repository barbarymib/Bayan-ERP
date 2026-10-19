# Performance benchmark (G25 / R3-E8, §9)

- Generated: 2026-10-19T19:12:31.750Z
- Dataset: 50,000 items, 50,000 stock balances (code prefix `BENCH-`)
- Base: http://localhost:3000/api
- Node: v24.16.0 on win32

## Single-request latency (10 samples each, warm)

| Endpoint | p50 | p95 | max |
| --- | ---: | ---: | ---: |
| items list (limit=50) | 74 ms | 129 ms | 129 ms |
| items search | 132 ms | 182 ms | 182 ms |
| items page 500 | 213 ms | 309 ms | 309 ms |
| customers list | 36 ms | 43 ms | 43 ms |
| reports stock-values | 2883 ms | 5969 ms | 5969 ms |
| reports stock-summary | 3176 ms | 4104 ms | 4104 ms |
| reports low-stock | 1839 ms | 2140 ms | 2140 ms |
| reports item-card | 48 ms | 63 ms | 63 ms |

## 50-concurrent bursts

| Burst | Requests | Success | p50 | p95 | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| light (list/search/customers/item-card) | 50 | 50 (100.0%) | 1095 ms | 1583 ms | 1640 ms |
| mixed (all endpoints incl. heavy reports) | 50 | 42 (84.0%) | 1855 ms | 33648 ms | 34292 ms |

> Reference machine/dev DB; indicative only. Re-run with `npm run bench`.
> Heavy analytics reports (stock-values/stock-summary/low-stock) scan every
> stock balance with item+unit joins; at 50k rows they are the scalable
> bottleneck and degrade sharply under 50 **simultaneous** heavy calls.
