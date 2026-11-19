# Stage 2 — minimal refactor without full application layer

Status: **pending approval**  
Goal: remove real duplication and fix measured performance bottlenecks without DDD/repository/ports ceremony.

## Principles

- Keep Next.js Server Components and direct Prisma reads for one-off pages.
- Extract a shared query/service only when it is reused or transactional.
- No full application layer for every domain.
- No microservices, Redis, queue, or multi-tenant.
- Performance decisions come from the 100-room benchmark, not theory.

## Work items

### 2.1 Low-stock report pagination and summary

Problem:

- 100 rooms / 30 min-stock rules = 3,000 rows in one HTML.
- Server p50 640 ms; browser 1.46 s; 10 concurrent requests 5.6 s.

Change:

- `/admin/reports?report=low` displays **100 rows/page**.
- Summary count/value computed without rendering all rows.
- Excel export remains full (separate route).
- Optional grouping by item/room type; show top-N with “all” export.
- Add `?page=` and stable sort by room number/item name.

Acceptance:

- 100-room low report p95 server **< 300 ms**, browser DOM **< 700 ms**.
- 10 concurrent low-stock requests complete **< 2 s**.
- Pagination preserves filters and totals.

### 2.2 Indexes and SQLite concurrency

- Add migration index `Operation(documentDate)`.
- Enable at startup:
  ```sql
  PRAGMA journal_mode=WAL;
  PRAGMA busy_timeout=5000;
  PRAGMA synchronous=NORMAL;
  ```
- Verify Prisma connection applies pragmas; document backup/checkpoint for `-wal`/`-shm`.

Acceptance:

- `PRAGMA journal_mode` returns `wal`.
- Report by document date uses index (`EXPLAIN QUERY PLAN`).
- Backup includes checkpoint; restore test passes.

### 2.3 Reports consolidation

- Extract `server/queries/reports.ts`:
  - stock;
  - movements;
  - low stock;
  - no-price.
- Both page and Excel route call the same query functions.
- Remove legacy `STOCK_HEADERS`, `MOVEMENTS_HEADERS`, `LOW_STOCK_HEADERS`, `NO_PRICE_HEADERS`, `MAID_TASK_HEADERS`, `TASK_HEADERS` when unused.
- Keep `report-labels.ts` as the only localized label source.

Acceptance:

- One query source for page + export.
- 5-locale Excel round-trip passes.
- No duplicate report calculations in `page.tsx`.

### 2.4 Cleaning router split, not 7 files

Split `server/trpc/routers/cleaning.ts` (759 lines) into:

```text
cleaning/
  index.ts       # composition
  tasks.ts       # tasks + execution + rooms
  maids.ts       # maids + shifts + reports
```

Target each file < 350 lines; preserve all tRPC paths.

Acceptance:

- Paths unchanged; existing cleaning/maids/checklist tests pass.

### 2.5 Error handling

- Add `server/errors.ts` with `AppError` code/status.
- One client error mapper replaces 10 `errorText` copies.
- Add `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`.
- `errorCode` in tRPC error data; logs keep correlation ID.
- Do not attempt full server error-code translation yet; that is Stage 2.6.

Acceptance:

- No duplicate `function errorText`.
- Error boundary renders localized safe message.
- Existing tests + new mapper tests pass.

### 2.6 Minimal server error codes

- Start with high-frequency mutations:
  - stock insufficient;
  - invalid status transition;
  - currency locked;
  - unauthorized/forbidden;
  - task already completed.
- Client maps codes to messages; raw Russian remains fallback only.

Acceptance:

- At least 5 codes have tests and localized messages in 6 locales.

### 2.7 E2E smoke in CI

- Playwright: login, `/admin`, `/admin/reports?report=low`, `/m/tasks`, locale switch.
- Temporary SQLite copy; never production.
- Run after build; 1 browser, no 5×all-pages matrix.

Acceptance:

- CI browser smoke green; failure artifacts retained.

### 2.8 Concurrency guard for Excel

- Limit concurrent exports to 1–2 (in-process semaphore) or queue.
- Cap rows at existing 5,000; return 429/503 with retry hint when busy.

Acceptance:

- Two simultaneous exports do not exhaust memory/CPU; test with synthetic 5k rows.

## Explicit non-goals

- Full application layer.
- Repository interfaces for every model.
- Splitting every router.
- OAuth2/marketplace.
- Custom translation file upload.
- Dependency upgrades.

## Performance acceptance

| Metric | Target |
|---|---|
| Normal admin page p95 | < 300 ms (local) |
| Low-stock 100 rooms, one user | p95 < 300 ms server / < 700 ms DOM |
| 10 concurrent low-stock | < 2 s |
| 50 concurrent normal pages | 50/50 OK, < 1.5 s total |
| Test suite | ≥ 103 + new tests |
| Build | green |
| Backup/restore | verified |
