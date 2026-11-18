# Per-module logging subsystem — feasibility report

Project: `hotel-linen-management` (Next.js app under `app/`)
Date: 2026-11-18
Author: logging-researcher (team task-4)
Status: read-only research; no source, DB, `.env`, messages or deployment were modified.

## 0. Verdict (short)

**GO**, phased, with conditions:

- **GO now (≈2.5 dev-days):** harden the existing pino logger, add request IDs + tRPC/API envelope logging, add domain events at service boundaries. This closes the real diagnostic gaps with almost no schema risk.
- **GO with approval (≈5 more dev-days):** SQLite `LogEvent` table + read-only `/admin/logs` UI + `logs.view` permission. Needed because file-only filtering does not meet the stated admin filters/pagination requirement.
- **NO-GO:** treating these operational logs as audit/legal records; storing secrets, request bodies or full PII; logging every read query; a custom file-tail UI over 90 days of JSONL files.

Recommended retention: **files 14 days** (already claimed by the TZ), **DB log rows 90 days** (configurable).

## 1. Method and evidence limits

What was checked:

- Static read of every logging call site, tRPC setup, auth, API routes, 1C worker/sync, Prisma schema/migrations, RBAC/seed, admin navigation, docs and tests.
- Read-only SQLite inspection (`sqlite3 app/data/app.db`) for baseline scale: currently `User=3`, `Room=10`, `Item=10`, `Permission=20`, `Operation=0` (demo/seed state after tests). Volume numbers below are projections, not measurements.
- No runtime execution, no build, no test run, no server start, no DB write. No log-content or secret values are reproduced.

## 2. Current state and gaps

Existing logger: pino 9, multistream to stdout + `logs/app-YYYY-MM-DD.log` (`app/src/lib/logger.ts:51-61`, `:17-40`). There is no other logging mechanism; Prisma has its own stdout logging (`app/src/lib/prisma.ts:7-9`).

### 2.1 Current coverage by area

| Area | What is logged now | Evidence | Gap |
|---|---|---|---|
| Auth (login) | success, bad password, lockout, disabled, rate-limit | `app/src/lib/auth.ts:71,87,102,107,115` | no logout/session/NextAuth callback errors; no userId; no correlation; no persisted security trail |
| tRPC | only errors: `path`, `code`, `message` | `app/src/app/api/trpc/[trpc]/route.ts:12-17`; no middleware in `app/src/server/trpc/trpc.ts:33-48` | no request/access event, no user, duration, input summary, request ID; successful mutations invisible |
| Operations | one success line inside the transaction | `app/src/server/services/operations.ts:147,238-248` | logged **before commit** → false success on rollback; idempotent replay unlogged (`:72-78`); validation rejections unlogged (`:90-130,173-177`) |
| Audit / inventory | photo upload only | `app/src/app/api/audit/[sessionId]/photo/route.ts:78-81`; router has no logs (`app/src/server/trpc/routers/audit.ts:62-262`) | no start/save-draft/apply events; applied audit is only visible as an `Operation` row |
| Cleaning / checklists | 1C queue failure only | `app/src/server/trpc/routers/cleaning.ts:29-35` | create/assign/status/answer/comment/shift transitions invisible (`:188-240,242-259,262-336,423-478,786-807`); checklist template changes invisible (`routers/checklists.ts`) |
| QR | only unlink warning | `app/src/lib/qr-storage.ts:41`; service `app/src/server/services/qr.ts:70-112` and routes `app/src/app/api/qr/[id]/route.ts:11-55` have no logs | generate/regenerate/resolve/download/delete not traceable |
| Reports / Excel | none | `app/src/app/api/reports/export/route.ts:38-286`; `app/src/app/admin/reports/page.tsx:41-103` | who exported which report/period, row count, bytes, duration unknown |
| 1C integration | start, sync summary, outbox sent summary, inbound applied summary, worker crash | `app/src/server/erp/worker.ts:20,51`; `sync.ts:85,189`; `room-status.ts:155,272` | per-entry failures are swallowed and only stored in `OutboxEntry.lastError` / `RoomStatusEvent.lastError` (`sync.ts:166-190`; `room-status.ts:251-273`); webhook success unlogged (`api/integrations/1c/room-status/route.ts:19-50`); no HTTP status/duration |
| Users / roles | user create, profile update (with `fullName`!) | `routers/users.ts:67,99-102` | role change, activate/deactivate, room assignment, password reset (`:112-179`) unlogged; `fullName` in logs is PII |
| Settings / branding | logo upload/delete | `api/admin/branding/logo/route.ts:72,87` | UI/currency/branding/1C config changes unlogged (`routers/settings.ts:26-111`, `routers/integration.ts:28-127`) |
| Catalog / rooms | none | `routers/catalog.ts:38-129`; `routers/rooms.ts:160-334` | item/room create/update/delete invisible |
| Errors / 500 | none | no `error.tsx`, `global-error.tsx` or `not-found.tsx` under `app/src` (glob check); `correlationId` appears nowhere in code | TZ requires `correlationId` on 500 (`docs/hotel-linen-TZ-v3.2.md:416`) — not implemented |
| Middleware | auth gate only | `app/src/middleware.ts:1-10` | no request ID/access log |
| Prisma errors | Prisma's own stdout `["warn","error"]` | `app/src/lib/prisma.ts:7-9` | not in the pino file, no context (path/user/request) |

### 2.2 Logger defects and documentation drift

1. **Debug level is unreachable.** Logger level is `LOG_LEVEL` (`logger.ts:53`) but both multistream sinks are pinned to `"info"` (`logger.ts:58-59`). Setting `LOG_LEVEL=debug` does not write debug events.
2. **No retention cleanup.** The module comment says 14 days are enforced by an external stage (`logger.ts:1-4`), and the TZ/README repeat 14 days (`docs/hotel-linen-TZ-v3.2.md:103,402`; `README.md:83`), but there is no cleanup code or npm script in the repo. Files from 2026-11-04 onward remain in `app/logs/`.
3. **UTC day boundary.** The file rotates on `toISOString().slice(0,10)` (`logger.ts:27`) while the hotel runs `TZ=Europe/Moscow` (`docs/DEPLOYMENT.md:60`) → the "daily" file changes at 03:00 local time. Must be documented or switched to local day.
4. **No process identity.** `base: { app: "hotel-linen" }` (`logger.ts:54`) replaces pino's default base, so `pid`/`hostname` are absent; multi-process diagnosis is impossible.
5. **Dead code.** `exitHook` is created and discarded (`logger.ts:48-49`).
6. **Docs name a non-existent file.** `docs/DEPLOYMENT.md:321` and `docs/CONFIGURATION.md:143` say `app/logs/server.log`; actual files are `logs/app-YYYY-MM-DD.log`.
7. **Windows viewer encoding.** The JSONL is valid UTF-8, but Windows PowerShell 5.1 / notepad can show mojibake unless read as UTF-8. Any admin UI or support script must decode UTF-8 explicitly (AGENTS.md R3).

## 3. Goals / non-goals

Goals:

- One structured event stream that an administrator can filter by module, level, date, user and entity.
- Fast troubleshooting of 1C failures, failed mutations, auth problems and data-change disputes.
- Request/correlation ID from browser through tRPC/service/worker to the log row.
- No secrets and no full PII; bounded storage with retention.

Non-goals:

- Replacing `Operation`/`AuditSession` or creating a legally admissible audit trail.
- Real-time APM, metrics, tracing backend, external log SaaS.
- Logging every page render or read query by default.

## 4. Module taxonomy

Use a fixed `module` enum (code-level constant; no DB enum because the project already avoids enums for SQLite — `prisma/schema.prisma:1-3`).

| Module | Covers | Primary code |
|---|---|---|
| `auth` | login/logout, rate-limit, lockout, session errors | `lib/auth.ts`, `middleware.ts` |
| `users` | users, roles, permissions, password reset, room assignment | `routers/users.ts`, `routers/roles.ts` |
| `catalog` | items, categories, write-off reasons | `routers/catalog.ts`, `routers/items.ts` |
| `rooms` | rooms, room types, maid↔room links | `routers/rooms.ts` |
| `warehouse` | stock views/changes (domain level) | `services/operations.ts`, `routers/items.ts` |
| `operations` | RECEIVE/DISTRIBUTE/RETURN/WRITE_OFF/AUDIT documents | `services/operations.ts`, `routers/operations.ts` |
| `audit` | inventory drafts, lines, apply, photos | `routers/audit.ts`, `api/audit/.../photo` |
| `cleaning` | tasks, checklist answers, shifts, room status | `routers/cleaning.ts`, `routers/checklists.ts` |
| `maids` | maid overview/archive/plan (reads + assignment effects) | `routers/cleaning.ts` (`maidsOverview`, `maidArchive`) |
| `qr` | generate, resolve, print, download, delete | `services/qr.ts`, `routers/qr.ts`, `api/qr/[id]` |
| `reports` | report views/exports, Excel generation | `api/reports/export`, `server/reports/excel.ts` |
| `integration-1c` | config, ping, item sync, outbox, room-status webhooks | `server/erp/*`, `api/integrations/1c/room-status`, `api/integration/worker` |
| `settings` | UI/currency/branding/integration settings | `routers/settings.ts`, `routers/integration.ts`, logo route |
| `system` | startup, shutdown, db errors, unhandled request errors | `lib/logger.ts`, `lib/prisma.ts`, tRPC route, error boundaries |
| `logs` | log viewing/export (meta-audit) | new `/admin/logs` |

## 5. Event schema

### 5.1 Required fields

```
schemaVersion  1
ts             ISO-8601 UTC with ms
level          debug | info | warn | error | fatal
module         one of the taxonomy values
action         "<module>.<entity>.<verb>" or "<module>.<verb>", past tense
               e.g. operations.operation.created, auth.login.failed,
                    integration.outbox.push_failed
outcome        success | failure | denied | skipped
requestId      UUID or validated incoming x-request-id
source         trpc | api | auth | worker | offline | cli
userId         internal user id, nullable for anonymous/worker
userLogin      only for auth events (login can change; id is the key)
roleCode       ADMIN | MANAGER | MAID | null
entityType     operation | audit_session | cleaning_task | item | room |
               qr | outbox | room_status_event | user | setting | log | null
entityId       id of the primary entity, nullable
durationMs     integer, for envelopes and slow operations
errorCode      TRPC code, Prisma code, HTTP status class, ERP_* code
http           { method, path, status } for API-originated events
message        short human-readable, sanitized, ≤300 chars
metadata       JSON object, allow-listed per action, ≤2 KB serialized
appVersion     package.json version
instanceId     stable per process start (pid + random suffix)
```

### 5.2 Example

```json
{"schemaVersion":1,
 "ts":"2026-11-18T03:12:44.512Z",
 "level":"info",
 "module":"operations",
 "action":"operation.created",
 "outcome":"success",
 "requestId":"6f1c2a0e-6a0e-4e2e-9a54-0f6f3f7c1a11",
 "source":"trpc",
 "userId":"cmw3769480001n4r82vzlid58",
 "roleCode":"MAID",
 "entityType":"operation",
 "entityId":"cmw9v1x2k0001...",
 "durationMs":42,
 "http":{"method":"POST","path":"/api/trpc/operations.distribute","status":200},
 "message":"DISTRIBUTE, 1 line",
 "metadata":{"operationType":"DISTRIBUTE","roomId":"cmw...","lines":1,
             "idempotent":false,"documentDate":"2026-11-18"},
 "appVersion":"2.3.3",
 "instanceId":"pid-8128-3f9c"}
```

Deliberately absent: item names, comments, full names, QR payloads, passwords, tokens, 1C login/base URL, cookies, request bodies.

### 5.3 Action catalog (minimum)

| Module | Actions |
|---|---|
| auth | `login.succeeded`, `login.failed`, `login.rate_limited`, `login.locked`, `login.disabled`, `logout`, `session.denied` |
| users | `user.created`, `user.profile_updated`, `user.role_changed`, `user.activated`, `user.deactivated`, `user.rooms_assigned`, `user.password_reset`, `role.permissions_updated` |
| catalog | `item.created`, `item.updated`, `item.deleted`, `item.deactivated` |
| rooms | `room.created`, `room.updated`, `room.deleted`, `room_type.created`, `room_type.updated`, `room_type.deactivated` |
| operations | `operation.created`, `operation.rejected`, `operation.idempotent_hit` |
| audit | `session.started`, `session.draft_saved`, `session.applied`, `photo.uploaded` |
| cleaning | `task.created`, `task.assigned`, `task.status_changed`, `checklist.answered`, `checklist.photo_uploaded`, `task.commented`, `shift.started`, `shift.ended`, `room_status.changed` |
| qr | `qr.generated`, `qr.resolved`, `qr.downloaded`, `qr.file_missing` |
| reports | `report.exported` (report key, period, rows, bytes, duration), `report.export_failed` |
| integration-1c | `config.saved`, `ping.succeeded`, `ping.failed`, `sync.completed`, `sync.failed`, `outbox.pushed`, `outbox.push_failed`, `room_status.inbound`, `room_status.outbound`, `worker.tick` (debug, only when work exists) |
| settings | `settings.updated`, `branding.updated`, `branding.logo_uploaded`, `branding.logo_deleted` |
| logs | `logs.viewed`, `logs.exported` |
| system | `startup`, `request.failed`, `db.error`, `retention.cleaned` |

## 6. Hook architecture and anti-double-logging rules

### 6.1 Where to hook

```
browser --x-request-id--> Next route
  /api/trpc  -> withRequestContext -> tRPC base middleware (envelope event)
                                   -> protected/permission -> service (domain event)
  /api/*     -> withApiLogging      (envelope event) -> service (domain event)
  /api/auth  -> authOptions.events / authorize (auth events)
worker tick -> withRequestContext(tickId) -> sync/outbox/room-status (domain events)
                         |
                   LogSink (batch): SQLite LogEvent + JSONL mirror/fallback
```

Decision: **envelope in tRPC middleware, domain event in services, nothing in routers/components.**

- `tRPC middleware` is the only place that sees procedure path, type (query/mutation), authenticated `ctx.user`, timing and the final outcome for every procedure, including unauthorized/forbidden calls. Add it to the base procedure before auth checks: `publicProcedure = t.procedure.use(logging)`, `protectedProcedure = publicProcedure.use(authCheck)` (`app/src/server/trpc/trpc.ts:31-38`).
- **Services** own business facts: operation id, idempotent flag, line count, audit applied, task transition, export row count. A service may be called by a router, another router (`audit.applyAudit` → `createOperation`, `audit.ts:231-237`) or a future job; logging it in the router would miss or duplicate. Log there.
- **Route handlers** not covered by tRPC (`/api/reports/export`, `/api/qr/[id]`, photo uploads, `/api/integrations/1c/room-status`, `/api/integration/worker`, branding logo) need one wrapper. Do not sprinkle start/end log calls in each handler.
- **NextAuth**: use `authOptions.events` (`signIn`, `signOut`, `error`) plus the existing `authorize` failure branches (`lib/auth.ts:64-123`). This covers logout and callback errors that currently have no hook.
- **Next pages / server components**: not logged by default (privacy and noise). Admin diagnostics do not need page-view telemetry.

### 6.2 No double logging — five enforceable rules

1. Exactly **one envelope event per tRPC procedure call** (or per wrapped API request), emitted by the middleware/wrapper. Services must never emit `action` names ending in `.request`, `.started`, `.completed` for the same call.
2. **One domain event per state transition**, emitted by the service/transaction owner after the DB commit. Routers do not log.
3. Errors are logged **once**: middleware/wrapper catches, writes the event, marks the error (`Symbol.for("omd.logged")` or a non-enumerable `__logged` flag), rethrows. The existing `onError` (`app/src/app/api/trpc/[trpc]/route.ts:12-17`) checks the marker and logs only unmarked transport/parse errors, tagged `source=trpc-transport`. Add a unit test that counts sink calls.
4. **Never log inside a Prisma transaction.** The current `operations.ts:238-248` line is inside `prisma.$transaction` (`:147`); move it after the transaction resolves. Same rule for `audit.applyAudit` (`audit.ts:230-262`): log after both the operation and the `auditSession.update` succeed.
5. **Recovered errors** (e.g. `queueRoomStatus` catches and swallows at `cleaning.ts:29-35`) are logged as `outcome=success` for the request plus a `warn` domain event `integration.room_status.enqueue_failed` with `recovered:true` — not as a failed request.

### 6.3 Services vs route handlers table

| Event | Emit in | Reason |
|---|---|---|
| tRPC path, duration, user, outcome, error code | tRPC middleware | one per call, covers authz denials |
| HTTP route duration/status/bytes | `withApiLogging` wrapper | tRPC middleware never sees these |
| operation created/idempotent/rejected | `services/operations.ts` | single business owner, called by 2 routers |
| audit started/saved/applied | `routers/audit.ts` after the transaction OR a new `services/audit.ts` | currently logic lives in router; preferred: extract service for testability |
| task/checklist/shift transitions | `routers/cleaning.ts` (or extracted service) | no service layer today; keep in one place |
| report export facts | `api/reports/export/route.ts` | rows/bytes/duration only known there |
| 1C outbox/room-status attempts | `server/erp/sync.ts`, `server/erp/room-status.ts` | must include attempts, HTTP status, backoff |
| login/logout | `lib/auth.ts` | NextAuth callbacks |

## 7. Correlation and request IDs

1. **Ingress**: at the start of every tRPC/API request, read `x-request-id`; accept only `^[A-Za-z0-9._:-]{8,64}$`; otherwise generate `crypto.randomUUID()`. Reject CR/LF and over-long values (log-injection guard).
2. **Context**: wrap the request in `AsyncLocalStorage<RequestContext>` (`requestId`, `source`, `userId`, `instanceId`). `logEvent()` reads it; no need to thread parameters through 20 functions. Node runtime is guaranteed for these routes because pino is a `serverExternalPackages` dependency (`next.config.mjs:9`) and the export route already sets `runtime = "nodejs"` (`api/reports/export/route.ts:24`).
3. **Response**: set `x-request-id` on API responses. For tRPC, the route wrapper sets it; the client can surface it in an error toast (support-friendly).
4. **tRPC batching**: one HTTP POST can carry several procedures. All envelope events share the same `requestId`; each has its own `http.path` + procedure path. Do not emit a separate per-batch event.
5. **Client → server**: add a `headers()` callback to `httpBatchLink` (`app/src/components/providers.tsx:11-14`) and to the offline client (`app/src/lib/offline/queue.ts:7-9`) that sends `x-request-id`. For offline replays, also send the existing `clientOpId` as `metadata.correlationId`; it is already generated (`components/operation-form.tsx:20,105`; `components/mobile/distribute.tsx:100`) and used for idempotency (`services/operations.ts:72-78`).
6. **Offline replay**: `source=offline`, `metadata.attempt`, `metadata.queuedAt`, `metadata.correlationId=clientOpId`. This links the original user action, retries and the server-side `Operation` row.
7. **Worker**: `workerTick` gets `tickId = randomUUID()` and `source=worker`; pass it to `pushPending`/`pushRoomStatuses`/`syncItems` via ALS (same helper). Log `worker.tick` at debug only when work was attempted; log `sync.completed`/`outbox.pushed` at info when counters are non-zero.
8. **NextAuth**: `authorize()` already receives the request object for IP extraction (`lib/auth.ts:64,69`). Generate/read `x-request-id` there; NextAuth `events` callbacks do not get the raw request, so store the id on the returned user/session? Simpler: log success in `authorize` (already the place) and log `signOut` in the `events.signOut` callback with a generated id. Document that logout is not correlated to the login request.
9. **Error boundary**: add `app/src/app/error.tsx` and `global-error.tsx` that display Next's `error.digest` and a generated support id, and POST a sanitized `client.error` event (module `system`) to a small route. Server-side 500s must log the same `requestId`.

## 8. Privacy, security, redaction, retention

### 8.1 Never log

- Passwords/hashes, `NEXTAUTH_SECRET`, `INTEGRATION_WORKER_TOKEN`, 1C password, room-status webhook token.
- `Authorization`, `Cookie`, `Set-Cookie`, `x-webhook-token`.
- 1C `baseUrl` with userinfo (`https://user:pass@host/...`); the adapter builds Basic auth from config (`server/erp/adapters/onec.ts:70-87`) — never log headers/config.
- Request/response bodies, tRPC raw input, `getRawInput()` output wholesale.
- Full names (`users.ts:100` currently logs `fullName` — must change), comments, checklist comments, photo bytes, QR payload.
- Full IP in general logs. **Exception:** auth/security events may store IP (needed for brute-force investigation); mask as `192.168.1.x` / truncate IPv6 by default, `LOG_IP_MODE=full|masked|off`.

### 8.2 Redaction implementation

- **Allow-list, not deny-list.** Each action declares its metadata keys (`operationType`, `lines`, `rows`, `bytes`, `outboundId`, …). `metadata` is built from those keys only; unknown fields are dropped, not serialized.
- A final defensive `redact()` pass is still applied to `message` and metadata strings: drop keys matching `/(pass(word)?|secret|token|authorization|cookie|session|hash|api[-_]?key|webhook)/i`, truncate strings to 200 chars, depth ≤3, JSON ≤2 KB, strip control chars except `\n`/`\t`.
- Error text: cap 500 chars, remove `file:...` connection strings and `user:pass@` patterns, never include `process.env` values. 1C adapter errors already contain only `HTTP <status>` or a network message (`onec.ts:84-86,105-107,118-120,147-149`), which is safe.
- Tests must feed a synthetic input containing every secret field and assert none of the values appear in the serialized event.

### 8.3 Retention

| Data | Retention | Mechanism |
|---|---|---|
| JSONL files | 14 days (as declared) | daily cleanup job, delete whole files older than cutoff, never the current file |
| `LogEvent` rows | 90 days default (`LOG_RETENTION_DAYS`), configurable 30–365 | batched `DELETE ... WHERE ts < cutoff LIMIT 5000` loop |
| Auth/security rows | same 90 days, admin-only | no separate store in phase 1; can be extended later |
| Meta-audit (`logs.viewed/exported`) | 180 days optional | same table, no separate retention in MVP |

Cleanup runs on startup and every 24h in-process, plus a CLI `npm run logs:cleanup` for an external scheduler (single-node assumption). Every cleanup writes `system.retention.cleaned` with deleted file/row counts.

## 9. Storage: file rotation vs SQLite table

### 9.1 Comparison

| Criterion | JSONL files (today) | SQLite `LogEvent` |
|---|---|---|
| Admin filters/pagination | poor: open/parse multiple files, no indexes | good: indexed WHERE/ORDER/LIMIT |
| Write cost | low, append-only | medium: WAL + indexes |
| Failure isolation | good: DB down still logs | DB down = no logs (file mirror covers) |
| Retention | delete files by mtime | DELETE by `ts`, batched |
| Admin UI | file locks on Windows, custom parser | Prisma queries, trivial |
| Backup impact | excluded from backups | grows `app.db` (backups get bigger) |
| Multi-process | day-rotation race, interleaved appends | one writer, `SQLITE_BUSY` retries |
| Volume per event | ~400–800 B | ~700–1,100 B + index overhead |

### 9.2 Recommendation

**Dual sink, DB primary for the UI, file as crash/debug mirror and fallback.**

- Keep pino JSONL (fix rotation/level/pid) as an always-on fallback; it also survives a DB restore.
- Add `LogEvent` to the existing SQLite DB via Prisma. A separate SQLite file would require a second Prisma client/schema or `better-sqlite3` (not installed) — avoid.
- Batch inserts outside transactions: buffer 50 events or 1 s, `createMany`, retry on `SQLITE_BUSY` 3× with backoff, then fall back to file and drop (never block the request).
- Cap: `LOG_DB_MAX_ROWS` (default 250,000) as a safety valve in addition to time retention.
- Do **not** write log rows inside `prisma.$transaction`; the log table shares the DB, so a failed/retried transaction must not take logs with it.

### 9.3 Volume estimate (projection, not measured)

Assumptions: 30 rooms, 3–10 users, operations and cleaning dominate; envelope logging for mutations only, queries at debug (not stored).

| Scenario | Events/day | Bytes/event | Raw MB/day | 90-day DB (≈2× with indexes) |
|---|---|---|---|---|
| Expected hotel load | 300–800 | ~600 | 0.2–0.5 | 18–45 MB |
| Busy day (inventory + many tasks) | ~1,500 | ~600 | 0.9 | ~80 MB |
| If every tRPC query is logged | 5,000–10,000 | ~500 | 2.5–5 | 225–450 MB |
| If every 60 s worker tick is logged | +1,440 | ~400 | +0.6 | +54 MB |

Conclusion: expected load is small; the danger is accidental query/tick logging. Enforce `LOG_QUERY=off` default and skip no-op ticks.

### 9.4 Multi-process concerns

- The project explicitly assumes a single Node process: in-memory rate limiting (`lib/rate-limit.ts:1-5`) and the single worker timer (`server/erp/worker.ts:9-28`). Current deployment uses `next start` (`docs/DEPLOYMENT.md`).
- If a second process ever appears (PM2 cluster, two terminals, IIS node):
  - File sink must use `app-YYYY-MM-DD-<pid>.log` or a single writer; otherwise lines interleave and day rotation races.
  - SQLite gets concurrent writers; WAL + `busy_timeout=5000` helps, but the app already has one DB for business data — do not increase contention.
  - The 1C worker would run twice and duplicate outbox pushes (existing risk, not caused by logging). Add a leader lock or a `WORKER_ENABLED` guard before scaling out.
  - Record `instanceId`/`pid` on every event so duplicates are visible and filterable.
- Next dev HMR can re-evaluate the logger module; keep the sink on `globalThis` (same pattern as `lib/prisma.ts:5-9`) to avoid duplicate streams/timers.

## 10. Admin UI: `/admin/logs`

### 10.1 Permission

Recommend a **new `logs.view` permission, ADMIN only** (21st permission).

Rationale: `settings.ui` is granted to MANAGER (`lib/rbac.ts:34-43`), so reusing it would expose login/IP/security events to managers; `settings.integration` is semantically wrong; a dedicated permission is auditable and matches the existing pattern (`rooms.manage` was added the same way in `prisma/migrations/20261117121500_rooms_manage_permission/migration.sql`).

Files to change:

- `app/src/lib/rbac.ts:6-27` — add `"logs.view"`; `ROLE_PRESETS.MANAGER` filter (`:36-43`) must exclude it; `ADMIN: PERMISSIONS` gets it automatically.
- `app/src/lib/permission-labels.ts:4-25` — add Russian label; `tests/permission-labels.test.ts:6-16` enforces exact parity.
- `app/prisma/seed.ts:11-32` — add permission; MANAGER filter (`:36-43`) excludes it.
- New migration `app/prisma/migrations/<ts>_logs_permission/migration.sql` — `INSERT OR IGNORE` into `Permission` and `RolePermission` for ADMIN (copy the pattern from the rooms.manage migration).
- `app/src/app/admin/layout.tsx:16-55` — add nav item, e.g. top-level after Reports: `{ href: "/admin/logs", labelKey: "logs", permission: "logs.view" }`.
- Five locale files `app/src/i18n/messages/{ru,en,es,it,de}.json` — add `nav.logs`.

### 10.2 Data access and UI

- Page: `app/src/app/admin/logs/page.tsx` (server component) + `components/logs-admin.tsx` (client).
- tRPC router `app/src/server/trpc/routers/logs.ts`:
  - `list` (query, `permissionProcedure("logs.view")`): filters `module`, `level[]`, `actionPrefix`, `from`, `to`, `userId`, `userLogin`, `entityType`, `entityId`, `requestId`, `outcome`; cursor pagination by `(ts, id)` descending, `limit` 25/50/100; returns `{ items, nextCursor }`. No `total` unless explicitly requested with a capped count.
  - `get` (query by id) for the detail drawer.
  - **No mutations, no delete/purge/retention controls.**
- Export: `GET /api/admin/logs/export?format=csv|jsonl&…same filters`; permission `logs.view`; max 50,000 rows and max 31-day range; streamed response; `Cache-Control: no-store`; UTF-8 CSV with BOM for Excel; prefix cells starting with `= + - @` with `'` to block CSV formula injection. Exporting logs itself emits `logs.exported`.
- Viewing logs emits `logs.viewed` (filters hashed/summarized, not raw), so access to logs is itself traceable.
- UI details: time in local TZ with TZ label; level badge; module; action; user (login + role); entity link (e.g. operation → `/admin/audit/<id>`? operations have no page — link only where a page exists); outcome; duration; short request ID with copy button; read-only banner; metadata JSON viewer collapsed by default; "no results" state; query state in URL for shareable troubleshooting links.
- Safety: render all strings as text (React escaping), never `dangerouslySetInnerHTML`; strip control characters server-side; cap message/metadata lengths; do not expose `SELECT *`.
- Tests: Playwright `scripts/ui-logs.mjs` — manager gets 403/absent nav, admin filters by module/level/date/entity, pagination, export content-type and row cap, no mutation controls visible.

## 11. Relationship to the existing audit trail (`Operation` / `AuditSession`)

| | `Operation` | `AuditSession` | `LogEvent` (proposed) |
|---|---|---|---|
| Purpose | immutable business document of stock movement | inventory workflow aggregate | diagnostics/forensics of system behavior |
| Written by | transaction in `services/operations.ts` | router transaction | async sink |
| Content | type, room, user, lines, qty/delta, reason, documentDate (`schema.prisma:183-219`) | room, user, status, lines, photos, operationId (`:221-266`) | request/outcome/duration/error/context |
| Failures | not recorded (rejected op leaves no row) | drafts only | primary value: failures/denials/timeouts |
| Reads/exports | not recorded | not recorded | recorded (who exported what) |
| Retention | permanent | permanent | 90 days |
| Mutability | immutable by convention; corrections via reverse operation | DRAFT editable; APPLIED locked | append-only in practice; admin read-only |
| Legal/audit use | source of truth for stock | source of truth for inventory | **not** an audit record |

Why logs are not audit records:

1. Logs are lossy by design (sampling, caps, redaction, 90-day retention) and can be lost on DB/file failure; audit records must be complete and durable.
2. Logs have no transactional coupling to the business write: a committed `Operation` can exist without a log line and vice versa (especially before the post-commit fix).
3. Logs include operational noise (denials, retries, reads) that is irrelevant to financial/stock truth.
4. An admin can view/export logs; audit evidence must have a chain of custody.

Therefore: keep `Operation`/`AuditSession` as the audit trail; use `LogEvent` to explain *how* and *why* a record was or was not created. For 1C, continue to treat `OutboxEntry` and `RoomStatusEvent` as the durable integration journal (`schema.prisma:280-325`); logs add transport-level details (attempt, HTTP status, duration) that those tables do not store (they store only `attempts`, `lastError`).

## 12. Phased implementation

Effort assumes one developer familiar with the codebase; no new runtime dependencies (pino, Prisma, Playwright already present).

### Phase 0 — Logger core (0.5–1 day)

Files:

- new `app/src/server/logging/types.ts` — module/action/outcome constants, `LogEventInput`.
- new `app/src/server/logging/redact.ts` — allow-list + defensive scrub.
- new `app/src/server/logging/context.ts` — `AsyncLocalStorage`, `withRequestContext()`.
- new `app/src/server/logging/event.ts` — `logEvent()` facade, sink interface, file fallback.
- edit `app/src/lib/logger.ts` — fix per-stream level (use logger level or remove per-stream `level`), add `pid`/`instanceId` base, remove dead `exitHook`, local-day rotation (or document UTC), file retention hook.
- new `app/src/server/logging/retention.ts` + `retention-cli.ts`; `package.json` script `logs:cleanup`.
- docs: fix `server.log` naming and 14-day claim in `docs/DEPLOYMENT.md`, `docs/CONFIGURATION.md`, `docs/OPERATIONS.md`.

Tests: `tests/logging-redact.test.ts`, `tests/logging-schema.test.ts`, `tests/logging-retention.test.ts`.

### Phase 1 — Correlation + envelopes (1 day)

Files:

- edit `app/src/server/trpc/trpc.ts` — logging middleware on base procedure; capture path/type/user/duration/outcome/error; mark errors.
- edit `app/src/app/api/trpc/[trpc]/route.ts` — wrap with request context; `onError` only logs unmarked errors; response `x-request-id`.
- new `app/src/server/logging/with-api-logging.ts` — wrapper for non-tRPC routes.
- edit `app/src/lib/auth.ts` — `authOptions.events` for signIn/signOut/error; correlation id in `authorize`; remove `fullName` from user-update log.
- new `app/src/app/error.tsx`, `app/src/app/global-error.tsx` — show digest/request id, no stack.
- optional `app/src/middleware.ts` — propagate/generate `x-request-id` for page requests (edge-safe; no pino).
- edit `app/src/components/providers.tsx` and `app/src/lib/offline/queue.ts` — send `x-request-id` / offline correlation.

Tests: request-id validation, one-envelope-per-call with a fake sink, error logged once, no debug leak.

### Phase 2 — Domain events (1–1.5 days)

Files (edit unless noted):

- `app/src/server/services/operations.ts` — move success log after transaction; add `operation.rejected`, `operation.idempotent_hit`.
- `app/src/server/trpc/routers/audit.ts` — `session.started`, `session.draft_saved`, `session.applied`.
- `app/src/server/trpc/routers/cleaning.ts` — task created/assigned/status/changed, checklist answered, comment, shift start/end, room status; convert queue failure to domain warn.
- `app/src/app/api/cleaning/tasks/[taskId]/items/[itemId]/photo/route.ts` and `app/src/app/api/audit/[sessionId]/photo/route.ts` — `photo.uploaded` with ids/size/mime, no file name? file name is safe (UUID).
- `app/src/server/services/qr.ts` + `routers/qr.ts` + `app/src/app/api/qr/[id]/route.ts` — generate/resolve/download/missing-file.
- `app/src/app/api/reports/export/route.ts` — `report.exported` (report, period, rows, bytes, duration) and failure branch.
- `app/src/server/erp/worker.ts`, `sync.ts`, `room-status.ts`, `app/src/app/api/integrations/1c/room-status/route.ts`, `app/src/app/api/integration/worker/route.ts` — tick/attempt/outcome/HTTP status; log per-entry failures (currently swallowed).
- `app/src/server/trpc/routers/users.ts`, `settings.ts`, `roles.ts`, `catalog.ts`, `rooms.ts`, `app/src/app/api/admin/branding/logo/route.ts` — remaining admin/config changes.
- `app/src/app/api/audit/[sessionId]/photo/route.ts` — already logs; convert to `logEvent`.

Tests: action-emission tests with a fake sink; ensure no password/fullName in events; ensure one event per service call.

### Phase 3 — SQLite sink + retention (1–1.5 days)

Files:

- `app/prisma/schema.prisma` — add `LogEvent` model.
- new migration `app/prisma/migrations/<ts>_log_events/migration.sql`:

```sql
CREATE TABLE "LogEvent" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "level" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "userId" TEXT,
  "userLogin" TEXT,
  "roleCode" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "durationMs" INTEGER,
  "errorCode" TEXT,
  "httpMethod" TEXT,
  "httpPath" TEXT,
  "httpStatus" INTEGER,
  "message" TEXT,
  "metadata" TEXT,
  "appVersion" TEXT,
  "instanceId" TEXT
);
CREATE INDEX "LogEvent_ts_idx" ON "LogEvent"("ts");
CREATE INDEX "LogEvent_module_ts_idx" ON "LogEvent"("module", "ts");
CREATE INDEX "LogEvent_level_ts_idx" ON "LogEvent"("level", "ts");
CREATE INDEX "LogEvent_user_ts_idx" ON "LogEvent"("userId", "ts");
CREATE INDEX "LogEvent_entity_ts_idx" ON "LogEvent"("entityType", "entityId", "ts");
CREATE INDEX "LogEvent_request_idx" ON "LogEvent"("requestId");
```

- new `app/src/server/logging/sink-db.ts` — buffer/batch/retry/fallback.
- edit `app/src/server/logging/event.ts` — dual sink switch (`LOG_DB_ENABLED`).
- `.env.example` + `docs/CONFIGURATION.md` — `LOG_DB_ENABLED`, `LOG_RETENTION_DAYS`, `LOG_FILE_RETENTION_DAYS`, `LOG_IP_MODE`, `LOG_QUERY`.
- `docs/DEPLOYMENT.md` — maintenance/cleanup, backup size note.
- `docs/OPERATIONS.md` — where logs live, how to query.

Tests: cutoff math, batch size, busy retry (fake), fallback on DB error; a manual temp-DB migration check (documented as manual, since existing tests avoid a real DB).

### Phase 4 — Admin UI + permission (1.5–2 days)

Files:

- migration for `logs.view` (see 10.1); `rbac.ts`, `permission-labels.ts`, `seed.ts`.
- new `app/src/server/trpc/routers/logs.ts`; register in `app/src/server/trpc/root.ts`.
- new `app/src/app/admin/logs/page.tsx`, `app/src/components/logs-admin.tsx`.
- new `app/src/app/api/admin/logs/export/route.ts`.
- `app/src/app/admin/layout.tsx` nav; 5 locale JSONs; `docs/CONFIGURATION.md` permission table; `docs/OPERATIONS.md` admin section.
- `tests/logs-filter.test.ts`, extend `tests/rbac.test.ts`; Playwright `scripts/ui-logs.mjs`.

### Phase 5 — Verification/docs (0.5–1 day)

- Run `npm test`, `npm run build`; Playwright `ui-logs.mjs`.
- Scripted scenario: login fail/success, operation, rejected operation, audit apply, photo upload, export, 1C webhook success/fail, worker tick — then grep the log store for secrets/PII and verify one event per action.
- Update `README.md`, `CHANGELOG.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT.md`.
- Retention/capacity check: row count after scenario, 90-day projection.

### Effort summary

| Phase | Days | Risk |
|---|---|---|
| 0 logger core | 0.5–1 | low |
| 1 correlation/envelopes | 1 | low–medium |
| 2 domain events | 1–1.5 | medium (many files) |
| 3 SQLite sink | 1–1.5 | medium (DB contention) |
| 4 admin UI/permission | 1.5–2 | medium (security) |
| 5 verification/docs | 0.5–1 | low |
| **Total** | **5.5–8.5** | +20% contingency → **7–10 dev-days** |

MVP without SQLite (Phase 0+1+2 + a read-only "today's file" page) is ~2.5–3.5 days, but it does not satisfy 90-day filtering/pagination; recommended only as an interim.

## 13. Risks and mitigations

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| 1 | Secret/PII leak (password, token, 1C login, fullName, comments) | High | allow-list metadata; defensive redaction; tests with synthetic secrets; code review; no raw input/body/header logging |
| 2 | Log injection / XSS / CSV formula injection | High | strip control chars, cap lengths, React escaping, no HTML rendering, CSV prefix escaping |
| 3 | DB growth/backup bloat | Medium | 90-day retention, `LOG_DB_MAX_ROWS`, no query logging, no-op worker ticks skipped |
| 4 | SQLite write contention | Medium | batch outside transactions, busy retry, file fallback; never log inside `$transaction` |
| 5 | Double logging / inflated metrics | Medium | five anti-double rules, `__logged` marker, tests counting sink calls |
| 6 | False success on rollback | Medium | move `operations.ts:238-248` after commit; same for audit apply |
| 7 | Multi-process duplicates/interleaving | Low now / High if clustered | document single-node; `instanceId`; per-PID files; leader lock before scaling |
| 8 | Permission leak to MANAGER | Medium | dedicated `logs.view`; explicit MANAGER exclusion; rbac + Playwright tests |
| 9 | Logging overhead | Low | async batched sink, ≤2 KB metadata, no query logs, sampler for debug |
| 10 | Timezone/date-filter confusion | Low | store UTC, display local, label TZ, test DST-free Moscow |
| 11 | Retention vs investigation | Low | configurable retention, export before purge, meta-audit of exports |
| 12 | Windows file locks during cleanup/UI | Low | delete only files older than cutoff, try/catch, never tail current file from UI |

## 14. Recommendation (GO/NO-GO)

**GO** for the phased plan.

- **Immediate (Phase 0–2):** highest value per day; fixes false-success logging, missing 1C failure visibility, absent request correlation and the debug-level bug.
- **Phase 3–4:** approve the 90-day retention and ADMIN-only `logs.view`; accept that `app.db` grows (projected 20–80 MB at 90 days) and that backups include logs; then build the read-only UI.
- **Conditions:** single Node process remains the deployment model; no secrets/PII in events; no log writes inside business transactions; admin UI is GET-only; every log access/export is itself logged.
- **NO-GO:** logs as the legal audit trail (use `Operation`/`AuditSession`, or a separate append-only hash-chained store); file-only 90-day UI; logging all tRPC queries by default; storing request/response bodies wholesale.

## 15. Acceptance checklist (for implementation)

- [ ] `LOG_LEVEL=debug` actually writes debug lines; prod default `info`.
- [ ] Every tRPC mutation produces exactly one envelope event; no duplicate on error.
- [ ] Every API route (photos, QR, export, worker, webhook, logo) produces one envelope event.
- [ ] `Operation` success is logged only after commit; rollback produces no success event.
- [ ] 1C outbox/room-status per-entry failures are visible in the log store, not only `lastError`.
- [ ] A failed login, a forbidden tRPC call and a 500 each carry a `requestId` visible in the UI/response header.
- [ ] Redaction test proves password/hash/token/Authorization/cookie/fullName never appear.
- [ ] Retention deletes old files/rows; current file is never deleted; cleanup is logged.
- [ ] `/admin/logs` is ADMIN-only; MANAGER/MAID get 403 and no nav item.
- [ ] Filters (module/level/date/user/entity/requestId) + pagination + CSV/JSONL export work; max range/row caps enforced.
- [ ] No mutation/delete/purge control exists in `/admin/logs`.
- [ ] `npm test` and `npm run build` green; Playwright `ui-logs.mjs` green.
- [ ] Docs (`OPERATIONS`, `CONFIGURATION`, `DEPLOYMENT`, `README`) match actual file names and retention.

## 16. Open questions (need owner decision)

1. Retention: 90 days DB / 14 days files acceptable, or does the hotel need 180/365?
2. Is full IP acceptable for auth events, or should it be masked by default?
3. Should MANAGER see operational logs (without auth/security)? Recommendation: no in MVP; add a module-scoped `logs.view.operations` later if needed.
4. Is a 20–80 MB `app.db` growth and larger backups acceptable?
5. Do support staff need sanitized 1C response bodies on failure? If yes, store a bounded, redacted snippet (≤1 KB), not the full body.
6. Should logs survive a DB restore? File mirror does; document it.

## 17. Assumptions

- Single Node process, `next start`, SQLite, no external log service (matches `lib/rate-limit.ts:1-5` and deployment docs).
- Low traffic (one hotel, tens of users); volume numbers are projections.
- `TZ=Europe/Moscow` in production (`docs/DEPLOYMENT.md:60`), so local-time UI is expected.
- Current demo DB is not representative; baseline counts were read-only and are not used as traffic evidence.
