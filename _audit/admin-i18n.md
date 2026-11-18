# Admin/server i18n audit — hotel-linen-management v2.3.3

Baseline: git `9e121b1` (“release v2.3.3”), `app/package.json` version `2.3.3`.
Scope: every route under `app/src/app/admin` (20 pages) + their components, 5 locales (`ru,en,es,it,de`), 545 message keys/locale.
Method: source + JSON analysis; read-only. No source/message/DB/env change, no deploy, no runtime setting change. Existing runtime capture `_audit/runtime-i18n.jsonl` (145 records, 29 routes, 5 locales, read-only) used as supporting evidence only.
Note: while this audit ran, an uncommitted working-tree change added `qrPrint.print` to all five catalogs (`app/src/i18n/messages/*.json:598`). It is not part of v2.3.3/HEAD and was not authored by this audit (`git diff` verified). All other findings are against committed v2.3.3.

## 1. Executive summary

| Metric | Count |
|---|---|
| Admin routes audited | 20 |
| Fully translated | 12 (60%) |
| Partial | 4 (20%) |
| Untranslated | 4 (20%) |
| Catalogs | 5 × 545 keys, identical key sets, identical placeholders, no Cyrillic leaked into non-ru |
| Translated namespaces never consumed by the UI | 4 (`reports` 10 keys, `permissions` 20, `statuses` 4, `errors` 3) |
| Missing literal key in v2.3.3 | 1 (`qrPrint.print`) |

Verdict: the JSON catalogs are healthy; the gap is component wiring. `reports`, `users`, `roles`, `settings/1c` are still Russian-only; `settings` (branding block), `catalog`, `maids`, `qr/print` have residual defects. Runtime confirms `html lang` and nav labels follow the selected locale; all remaining Cyrillic on translated admin routes is user data, except the four untranslated routes and the branding `Удалить` button.

## 2. Route-by-route table

Status: **T** = translated (all visible static UI via `next-intl`; residual rare `errorText` fallback noted), **P** = partial, **U** = untranslated. Evidence paths relative to `hotel-linen-management/`.

| # | Route | Page / component | Status | Static untranslated examples (evidence) | Missing keys / hardcoded locale-currency |
|---|---|---|---|---|---|
| 1 | `/admin` | `app/src/app/admin/page.tsx` | T | none; dates use `Intl.DateTimeFormat(locale,…)` (`page.tsx:81-84`) | none |
| 2 | `/admin/catalog` | `components/catalog-admin.tsx` | P | default unit `"шт"` (`:22`, `:134`, `:153`); price placeholder `"0,00"` (`:215`); fallback `"Неизвестная ошибка"` (`:16`) | `"0,00"` is comma-decimal for every locale |
| 3 | `/admin/warehouse` | `app/src/app/admin/warehouse/page.tsx` | T | none (`:19-20`, locale dates `:141`) | none |
| 4 | `/admin/receive` | `receive/page.tsx` + `components/operation-form.tsx` | T | header translated (`receive/page.tsx:5-11`); residual fallback `"Неизвестная ошибка"` (`operation-form.tsx:35`) | none |
| 5 | `/admin/distribute` | `distribute/page.tsx` + `operation-form.tsx` | T | as above (`distribute/page.tsx:5-11`) | none |
| 6 | `/admin/return` | `return/page.tsx` + `operation-form.tsx` | T | as above (`return/page.tsx:5-11`) | none |
| 7 | `/admin/writeoff` | `writeoff/page.tsx` + `operation-form.tsx` | T | as above (`writeoff/page.tsx:5-11`) | none |
| 8 | `/admin/audit` | `components/audit-admin.tsx` | T | none; locale dates (`:126-137`) | none |
| 9 | `/admin/audit/[id]` | `components/audit-session.tsx` | T | residual fallback `"Неизвестная ошибка"` (`:16`); raw server error shown verbatim (`:144`) | none |
| 10 | `/admin/qr` | `components/qr-admin.tsx` | T | none; raw `URL/JSON/TEXT` technical codes (`:238-239`) | none |
| 11 | `/admin/qr/print` | `qr/print/page.tsx` + `components/print-button.tsx` | P | print button label `t("print")` has no key in v2.3.3 (`print-button.tsx:7-9`) | **`qrPrint.print` missing in all 5 catalogs at HEAD**; runtime `MISSING_MESSAGE: qrPrint.print` in ru/en/es/it/de (`_audit/runtime-i18n.jsonl:15,44`); payload format printed raw (`qr/print/page.tsx:87`) |
| 12 | `/admin/cleaning` | `components/cleaning-admin.tsx` | T | residual fallback `"Неизвестная ошибка"` (`:21`) | none |
| 13 | `/admin/maids` | `components/maids-admin.tsx` | P | raw enum appended after translated label: `{maid.currentTask.type}` renders `DAILY/ON_DEMAND/GENERAL` (`:190-192`) | duplicate type token (`:191`) |
| 14 | `/admin/checklists` | `components/checklists-admin.tsx` | T | residual fallback `"Неизвестная ошибка"` (`:14`) | none |
| 15 | `/admin/reports` | `app/src/app/admin/reports/page.tsx` | U | `TYPE_LABELS` Russian (`:12-17`); `TABS` Russian (`:20-25`); H1/intro (`:66-70`); “Скачать Excel” (`:91`); table heads (`:129-134`, `:226-230`, `:324-331`, `:384-386`); empty states (`:221`, `:319`, `:379`); “склад” (`:245`) | no `getTranslations`; `reports.*` namespace unused; dates hardcoded `ru-RU` (`:28`, `:32`) |
| 16 | `/admin/settings` | `settings/page.tsx`, `language-currency-settings.tsx`, `show-dates-toggle.tsx`, `branding-settings.tsx` | P | page + language/currency translated (`settings/page.tsx:18`, `language-currency-settings.tsx:14-17`); branding block: errors/confirm/alt/delete hardcoded (`branding-settings.tsx:16,29,33,87,91,98,109-110,120,126,154,156,180,212`) and accent labels from Russian-only `ACCENT_COLORS` (`:233`) | `branding.delete` key exists but unused (`branding-settings.tsx:212` vs `messages/ru.json` `branding.delete`); fallback `"Error"` (`language-currency-settings.tsx:55`) |
| 17 | `/admin/settings/1c` | `components/integration-admin.tsx` | U | H1/intro (`:104-107`); status cards (`:125-128`); labels/buttons (`:145,154,159,167-168,173,182,198,206,235,254,268,281`); webhook block (`:302-431`) | no namespace; only `settings.integrationCurrencyGuard` translated (`:119`); `toLocaleString("ru-RU")` (`:288`) |
| 18 | `/admin/rooms` | `components/rooms-admin.tsx` | T | residual fallback `"Неизвестная ошибка"` (`:15`); floor sort `localeCompare(a,"ru")` (`:68`) | none user-visible |
| 19 | `/admin/users` | `components/users-admin.tsx` | U | no `next-intl` at all; ROLE_LABELS Russian (`:10-14`); H1/intro (`:135-138`); all form labels/buttons (`:150-196`, `:216`, `:225`, `:263`, `:275`, `:311-314`, `:332`, `:352-356`, `:363-383`, `:401`, `:418-422`, `:431-446`) | notices hardcoded (`:88`, `:124`) |
| 20 | `/admin/roles` | `components/roles-admin.tsx` | U | no `next-intl`; H1/intro (`:51-54`); permission labels from Russian-only `PERMISSION_LABELS` (`lib/permission-labels.ts:3-25` used at `roles-admin.tsx:92`); save button (`:97`); role name from DB (`:72`) | `permissions` namespace unused; `Права сохранены`/`Не удалось сохранить права` (`:36`, `:43`) |

Shell/nav (applies to all routes): `components/admin-shell.tsx:44,70` — logout translated, brand fallback `"Учёт белья"` hardcoded (`:70`); `components/brand-mark.tsx:23` — `alt="Логотип отеля"` hardcoded. Nav labels themselves are translated from the `nav` namespace (`app/src/app/admin/layout.tsx:66-82`; all 22 label keys present in all 5 locales).

## 3. User-data strings that must NOT be translated

Confirmed by runtime capture (English pages contain these in Cyrillic and that is correct):

- Item names, categories, units, notes (`Бельё`, `Инвентарь`, `Химия`, `компл`, `л`, `Хлопок 100%, белый`).
- Room numbers, room type names, floor labels/custom floor names (`101`, `Стандарт`, `Улучшенный`, `Люкс`).
- User full names and logins (`Администратор системы`, `Горничная (демо)`); demo seed data.
- Checklist template names, checklist item texts, extra option texts (`Стандартная уборка номера`).
- Operation comments, write-off reason text, document references, QR payload/codes.
- Branding: hotel name, logo, responsible name/position (`My hotel`).
- Integration credentials/URLs/tokens: `baseUrl`, `login`, password, webhook URL, `SetRoomStatus` path, revealed token.
- Exported files: item/room/category/employee names.

Do translate by code (not user data): role display names (`ADMIN/MANAGER/MAID` are seeded Russian in `app/prisma/seed.ts:47-51` but the `roles` namespace exists and nav already uses it), permission labels (`permissions` namespace exists), operation/status/priority/type codes (labels already translated).

## 4. Missing translation-key / fallback risks

1. **`qrPrint.print` missing in v2.3.3** — `print-button.tsx:7-9`; absent from all 5 catalogs at HEAD; production runtime logged `MISSING_MESSAGE: qrPrint.print` for all 5 locales (`_audit/runtime-i18n.jsonl:15,44`). next-intl renders the key path/logs in production and can throw in dev. An uncommitted working-tree edit now adds it (`messages/*.json:598`); rebuild + regression test required for the production bundle.
2. **No fallback handler** — `app/src/i18n/request.ts:5-11` has no `onError`/`getMessageFallback`, so any future missing key silently degrades to a key path; no key-existence check in the shipped build.
3. **Unguarded dynamic role lookups** — `admin/layout.tsx:87` and `admin/page.tsx:45` call `tRoles(user.roleCode)`; a DB role code outside `ADMIN/MANAGER/MAID` yields `MISSING_MESSAGE`. Operation types are guarded (`admin/page.tsx:7,76`), roles are not.
4. **`permissions` namespace is unusable as-is** — keys are literal dotted strings (`messages/ru.json` `permissions."rooms.read"`), so a future `useTranslations("permissions")` + `t("rooms.read")` resolves `permissions.rooms.read` by path and fails. Needs nesting (`permissions.rooms.read` as nested objects) or root-level full-key access.
5. **Dead translated namespaces** — `reports` (10), `permissions` (20), `statuses` (4), `errors` (3) are never referenced by `useTranslations`/`getTranslations` (grep over `app/src`). They create false coverage signal; `reports` keys exactly match the untranslated reports screen.
6. **Russian server errors surface verbatim in every locale** — `errorText()` returns `TRPCClientError.message` (`catalog-admin.tsx:16`, `operation-form.tsx:35`, `audit-session.tsx:16`, `cleaning-admin.tsx:21`, `rooms-admin.tsx:15`, `checklists-admin.tsx:14`, `branding-settings.tsx:16`, `integration-admin.tsx:14`, `warehouse-add.tsx:27`); ~111 Russian error strings exist under `app/src/server` + `app/src/lib` (scan).
7. **Excel export is Russian/₽-only** — `app/src/server/reports/excel.ts:26,87,98,103,177` hardcode `ru-RU`; headers/“склад”/signature labels Russian (`:13-17`, `:131`, `:237`, `:311-319`, `:342-375`) and `₽` in headers regardless of currency setting. Triggered from `/admin/reports`, `/admin/cleaning`, `/admin/maids`.
8. Catalog-level drift risk is currently low: 5×545 keys, identical key sets, zero placeholder mismatches, zero unexpected Cyrillic in non-ru (verified). Drift protection exists only as an uncommitted test (`app/tests/i18n.test.ts`, not in v2.3.3).

## 5. Priority-ordered fix list

**P0 — untranslated screens (majority of remaining work)**
1. `/admin/reports`: wire `reports`/`operations` namespaces (keys already translated); replace `ru-RU` with `getUiSettings().locale`; fix `"склад"` and Excel link. `reports/page.tsx:12-33,51,66-70,91,121-146,201-230,245,314-331,375-386`.
2. `/admin/users`: add `users` (or reuse `nav.users`/`permissions.*` + `common`) namespace, replace `ROLE_LABELS` with `roles` translations. `users-admin.tsx:10-14,88,124,135-446`.
3. `/admin/roles`: add translations for H1/intro/save; use `permissions` translations instead of `PERMISSION_LABELS`; use `roles` namespace instead of DB `role.name`. `roles-admin.tsx:36,43,51-54,72,92,97`; `lib/permission-labels.ts:3-25`.
4. `/admin/settings/1c`: add an `integration` namespace and replace all literals; replace `toLocaleString("ru-RU")` with `useLocale()`. `integration-admin.tsx:104-431`, especially `:288`.

**P1 — broken/incorrect UI**
5. `qrPrint.print`: keep the working-tree key in all 5 catalogs, rebuild, re-check runtime console (currently MISSING_MESSAGE ×5). Verify dev mode does not throw.
6. Maids enum leak: remove `maid.currentTask.type` after the interpolated `t("currentTask", …)` (`maids-admin.tsx:191`).
7. Nav reset on locale switch: make `openGroups` use stable group IDs, not translated labels (`admin-shell.tsx:45-62,98-101`).
8. Branding block: use existing `branding` keys for delete/confirm/errors/alt and translate `ACCENT_COLORS` labels (`branding-settings.tsx:16,29,33,87,91,98,109-110,120,126,154,156,180,212,233`).

**P2 — polish / systemic**
9. Catalog: locale-aware unit default (drop `"шт"`) and decimal placeholder (`catalog-admin.tsx:22,134,153,215`).
10. Shared `errors.unknown` for the nine `errorText` fallbacks; map server errors to codes and translate client-side.
11. Brand fallback/alt: `admin-shell.tsx:70`, `brand-mark.tsx:23`.
12. Excel export locale/currency (`server/reports/excel.ts`), including headers with `₽`.
13. Remove or wire dead namespaces (`reports`, `permissions`, `statuses`, `errors`); nest `permissions` keys; add a shipped key-usage test (the uncommitted test is a good start).

## 6. Locale/nav reset bug

**Found (code-level): nav group expansion resets on locale change.**
`AdminShell` stores expanded groups as **translated label strings**: `activeGroup = …?.label` (`admin-shell.tsx:45-47`), `useState([activeGroup])` (`:49`), `toggleGroup(label)` with `openGroups.includes(entry.label)` (`:58-62`, `:98`). On a language switch, server nav labels change, but the client component keeps its state; old label keys no longer match any group, so every group collapses except the currently active one (added by the effect at `:50-56`). Group React keys are also translated labels (`:101`), forcing remounts.
Evidence: `components/admin-shell.tsx:45-62` and `:98-101`. Reproduce: open `/admin/catalog`, expand “Склад”, switch language in `/admin/settings`, return to a page whose group is not active — groups are closed. Not exercised by the existing runtime capture (no locale-switch flow recorded); source-verified, not runtime-verified.

**Not a bug:** `html lang` and nav labels track the selected locale on all five (runtime `_audit/runtime-i18n.jsonl`); `Русский` in the language selector is the intentional native label (`locale.ru`). The v2.3.1 “notice stays in old language” fix is present (`language-currency-settings.tsx:105` resolves `noticeKey` at render time).

## 7. Limitations

- No runtime locale-switch test was performed (settings must not be changed); runtime evidence is the existing pre-existing capture, not re-generated.
- Concurrent uncommitted workspace edits are possible; all counts/lines are against `git show HEAD` unless explicitly marked as working tree.
