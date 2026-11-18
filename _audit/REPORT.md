# i18n audit and logging research — consolidated report

Date: 2026-11-18 (Europe/Moscow)  
Baseline: `hotel-linen-management` v2.3.3, git `9e121b1`  
Scope: admin/server and mobile UI, locales `ru,en,es,it,de`

## 1. Method

The work was split across four agents and one runtime audit:

| Task | Owner | Result |
|---|---|---|
| Admin/server i18n audit | admin-i18n-auditor | `_audit/admin-i18n.md` |
| Mobile i18n audit | mobile-i18n-auditor | `_audit/mobile-i18n.md` |
| i18n regression tests | i18n-test-engineer | `app/tests/i18n.test.ts` |
| Per-module logging research | logging-researcher | `_audit/logging-feasibility.md` |
| Runtime audit, 5 locales × 29 routes | Lead | `_audit/runtime-i18n.jsonl` |

Runtime audit: **145 page captures** (20 admin routes + 9 mobile routes, each in `ru,en,es,it,de`), including detail pages and the QR print sheet. Each capture recorded `<html lang>`, title, visible text, Cyrillic lines, page errors and console errors.

## 2. Runtime result

| Metric | Result |
|---|---|
| `html lang` matches selected locale | **145 / 145** |
| Page crashes | 0 |
| Console errors | 1 unique issue: `MISSING_MESSAGE: qrPrint.print` in all 5 locales |
| Locale reset while navigating | **not reproduced** |
| Mobile translated content | **0 / 9 routes** |
| Admin fully translated | **12 / 20 routes** |
| Admin partial | **4 / 20** |
| Admin untranslated | **4 / 20** |

All Cyrillic found on already-translated admin routes is user data (item/room/type/employee names) and must stay as entered. It is not a language-reset bug.

## 3. Admin/server

Detailed route table: `_audit/admin-i18n.md`.

- Fully translated (12): dashboard, warehouse, receive, distribute, return, writeoff, audit list, audit detail, QR admin, cleaning, checklists, rooms.
- Partial (4): settings/branding, catalog, maids, QR print.
- Untranslated (4): **reports, users, roles, settings/1c**.
- `qrPrint.print` is missing in v2.3.3; the working tree now adds it, and the regression suite asserts it.
- Nav group state is keyed by translated labels (`admin-shell.tsx:45-62,98-101`), so a language switch can collapse open groups. Source-verified; recommended fix.
- Other systemic issues: no `onError`/`getMessageFallback`; unguarded `tRoles(user.roleCode)`; ~111 Russian server errors surface verbatim; Excel export hardcodes `ru-RU`/`₽`; four translated namespaces are unused (`reports`, `permissions`, `statuses`, `errors`).

## 4. Mobile

Detailed report: `_audit/mobile-i18n.md`.

- **0 / 9 routes localized**; 0 `next-intl` calls in 8 mobile components and the shared shell.
- ~225 hardcoded Russian literals across 18 files.
- Runtime content is identical Russian under `ru,en,es,it,de`; only `<html lang>`, PWA manifest and tab selection are locale-correct.
- Three hardcoded `Intl.DateTimeFormat("ru-RU")` sites: `dashboard.tsx:42`, `audit-list.tsx:133`, `audit-session.tsx:38-43`.
- No currency symbols on mobile screens.
- Offline risks: service worker may cache locale-specific HTML; IndexedDB queue labels freeze at enqueue language; `lib/offline/backoff.ts:39` detects idempotency by the Russian substring `"уже проведена"`, so localizing server errors must preserve a stable code/idempotency contract.

## 5. Automated tests

`app/tests/i18n.test.ts` adds 11 `node:test` cases; full suite:

```text
tests 100
pass 100
fail 0
```

Coverage:
- identical key sets across all 5 catalogs (546 keys each, no extras/missing);
- no empty values;
- required namespaces and UI keys;
- interpolation placeholders and static brace groups equal per key;
- money formatting for all 15 locale × currency combinations (RUB/USD/EUR), separator checks and parse round-trips;
- Cyrillic guard for non-ru locales, with only `locale.ru = "Русский"` allowlisted;
- source scan: 19 namespaces and 474 literal `t()` references resolve in every locale.

The suite protects catalog integrity. It does **not** prove that every screen is wired: an untranslated component with no `t()` calls is invisible to a catalog test. Runtime audit closes that gap; a future e2e test should assert a non-ru UI contains no known static Russian strings.

## 6. Logging feasibility

Detailed report: `_audit/logging-feasibility.md`.

Recommendation: **GO, phased**.

- **Phase 0–2, ~2.5 dev-days:** fix pino logger (debug level unreachable; no retention cleanup; no pid), add request IDs, tRPC/API envelope logging, and domain events **after** transaction commit. This fixes the current false-success log in `operations.ts` (logged inside the transaction), invisible 1C outbox failures, and missing correlation.
- **Phase 3–4, ~4.5 more days:** SQLite `LogEvent` table with 90-day retention and read-only `/admin/logs` using a new ADMIN-only `logs.view` permission; filters by module, level, date, user and entity, pagination and export.
- **NO-GO:** logs as a legal audit trail; Operation/AuditSession remain the audit source. Do not log secrets, request bodies, full PII or every read query. Do not build a file-only 90-day UI.

Module split recommended: auth/users, catalog/warehouse, operations, audit, cleaning, maids/checklists, QR, reports/Excel, 1C, settings. Expected volume 0.2–0.5 MB/day, 18–45 MB per 90 days.

## 7. Priority list

**P0**
1. Localize `/admin/reports`, `/admin/users`, `/admin/roles`, `/admin/settings/1c`.
2. Add mobile `mobile.*` namespace and wire all `/m*` routes; replace 3 `ru-RU` date formatters.

**P1**
3. Keep `qrPrint.print` in all 5 catalogs and deploy the rebuilt bundle.
4. Fix nav group state to use stable IDs, not translated labels.
5. Remove raw enum leak in `maids-admin.tsx:191`; finish branding block.
6. Add `onError`/`getMessageFallback`.

**P2**
7. Localize Excel export and server error codes.
8. Add an e2e runtime translation guard for admin/mobile.
9. Implement logging Phase 0–2; then decide on `/admin/logs`.

## 8. Artifacts

- `_audit/admin-i18n.md`
- `_audit/mobile-i18n.md`
- `_audit/logging-feasibility.md`
- `_audit/runtime-i18n.jsonl`
- `app/tests/i18n.test.ts`

## 9. Known limitations

- Runtime audit used the demo installation with currency RUB; currency formatting is separately covered by tests.
- Audit reports baseline v2.3.3; `qrPrint.print` was added in the working tree after that baseline and needs a rebuild/deploy.
- Mobile was intentionally not modified by this audit; the report is a fix plan, not an implementation.
