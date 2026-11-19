# Performance baseline — 5–100 rooms

Date: 2026-11-19  
Build: `v2.3.6`, production `next start`  
Machine: local Windows 11, Intel i5-12400, 16 GB RAM, SSD  
Purpose: input for Stages 1–2; not a production capacity guarantee.

## Dataset

Synthetic copies of the production DB:

| Rooms | Items | Operations | RoomInventory | MinStock rules | Tasks | LogEvent | DB size |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 10 | 1,000 | 0 | 0 | 200 | 5,000 | ~0.5 MB |
| 50 | 50 | 5,000 | 1,000 | 90 | 500 | 5,000 | ~3.3 MB |
| 100 | 50 | 10,000 | 2,000 | 90 | 1,000 | 5,000 | 6.5 MB |

Low-stock test intentionally made almost all room/item combinations deficient: 3,000 rows for 100 rooms.

## Prisma query p50

| Query | 10 | 50 | 100 |
|---|---:|---:|---:|
| Dashboard | 13.4 ms | 15.3 ms | 15.0 ms |
| Warehouse | 2.1 ms | 1.9 ms | 2.0 ms |
| Reports stock | 2.0 ms | 1.8 ms | 1.9 ms |
| Movements 500 | 0.5 ms | 0.9 ms | 1.3 ms |
| Low stock | 2.8 ms | 6.5 ms | 12.2 ms |
| Cleaning list | 5.0 ms | 12.5 ms | 22.5 ms |
| Maids overview | 2.1 ms | 3.1 ms | 4.9 ms |
| Logs page | 1.7 ms | 1.5 ms | 1.6 ms |

## HTTP server p50

| Page | 10 | 50 | 100 |
|---|---:|---:|---:|
| `/admin` | 38 ms | 33 ms | 34 ms |
| `/admin/warehouse` | 26 ms | 31 ms | 32 ms |
| Stock report | 31 ms | 34 ms | 36 ms |
| **Low-stock report** | **94 ms** | **362 ms** | **640 ms** |
| Cleaning | 14 ms | 14 ms | 16 ms |
| Maids | 15 ms | 17 ms | 13 ms |
| Logs | 34 ms | 33 ms | 32 ms |

100-room browser wall:

- normal admin: ~0.58 s;
- stock report: ~0.59 s;
- low-stock: **1.46 s**, DOMContentLoaded ~892 ms.

## Concurrency (100 rooms)

| Scenario | Result |
|---|---|
| 25 normal concurrent | 432 ms, 25/25 OK |
| 50 normal concurrent | 659 ms, 50/50 OK |
| 10 low-stock concurrent | 5.6 s |
| 20 low-stock concurrent | 10.35 s |

## SQLite

Current pragmas:

```text
journal_mode=delete
synchronous=2 (FULL)
busy timeout not configured
```

Synthetic 1,000 inserts in one transaction:

| Mode | Time |
|---|---:|
| delete + FULL | 12.3 ms |
| WAL + NORMAL | 9.1 ms |
| WAL + FULL | 11.6 ms |

Write volume is not the limit for a hotel; WAL is recommended for read/write concurrency and to avoid reader blocking during writes.

## Interpretation

- 5–50 rooms: comfortable; no architectural change needed.
- 100 rooms: normal pages fine; **low-stock report is the first bottleneck**.
- Maximum comfortable current load: ~50 concurrent normal requests; ~2–3 concurrent low-stock.
- 100+ rooms requires low-stock pagination, `Operation(documentDate)` index, WAL, and export concurrency guard.
- SQLite/Prisma are not the bottleneck at 100 rooms; HTML rendering of 3,000 rows is.

## Required fixes

1. Paginate low-stock to 100 rows; separate summary.
2. Add index `Operation(documentDate)`.
3. WAL + busy_timeout + synchronous=NORMAL.
4. Limit concurrent Excel exports.
5. Optional 30–60s report summary cache.

## Test caveats

- Synthetic data, not real hotel history/photos.
- Server and browser on the same PC.
- Single Node process.
- Network latency not included.
- 5-room result is represented by the 10-room baseline.
