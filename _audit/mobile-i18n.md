# Mobile i18n audit — hotel-linen-management v2.3.3

- Date: 2026-11-18 05:58 (+03:00), Europe/Moscow
- Project baseline: `hotel-linen-management/` at Git `9e121b1` ("Localize audit, cleaning, maids, checklists and QR; release v2.3.3"), `app/package.json` version `2.3.3`
- Scope: `/m`, `/m/tasks`, `/m/tasks/[id]`, `/m/rooms`, `/m/audit`, `/m/audit/[id]`, `/m/distribute`, `/m/more`, `/m/scan`, offline queue, shared mobile shell
- Locales: `ru`, `en`, `es`, `it`, `de` (`app/src/i18n/messages/*.json`)
- Nature: READ-ONLY source/JSON audit. No components, messages, DB, `.env`, deployment or production locale were modified by this audit.
- Method: static inspection of every mobile route/component and the i18n plumbing; key-set/placeholder parity across the 5 catalogs (Node v24.22.0 script); scan for Cyrillic string literals; cross-check against runtime captures in `_audit/runtime-i18n.jsonl` produced by the concurrent runtime audit (shared workspace — that file is not mine; I only read it).
- Snapshot caveat: at HEAD each catalog has 545 keys. While this audit ran, concurrent tasks changed the tree: at 05:55:41 `qrPrint.print` was added to all 5 catalogs (working tree: 546 keys), and at 05:57 a new `app/tests/i18n.test.ts` appeared. `git status` therefore shows all 5 message files modified plus untracked `_audit/` and `app/tests/i18n.test.ts`. Mobile findings are unaffected; missing-key and test-coverage findings are reported for both snapshots.

Path convention: all `file:line` references are relative to `hotel-linen-management/`.

## 1. Summary counts

| Metric | Value |
|---|---|
| Locales in scope | 5 (`ru`, `en`, `es`, `it`, `de`) |
| Catalog keys per locale | HEAD 545; working tree 546 |
| Missing keys between catalogs | 0 (HEAD and working tree) |
| Empty / non-string values | 0 |
| Placeholder (`{var}`) mismatches | 0 |
| Values identical to `en` (non-English locales) | ru 7 · es 21 · it 15 · de 24 (proper names/cognates, see §4.6) |
| Mobile page routes audited | 9 |
| Mobile routes using `next-intl` | **0 / 9** |
| `next-intl` calls in `components/mobile` + mobile shell | **0** (8/8 mobile components, tab bar, offline panel, PWA banner, logout) |
| Hardcoded Russian string literals in mobile scope | **≈225 across 18 files** (script count; includes label maps and error strings) |
| Hardcoded `ru-RU` date formatters | **3** |
| Hardcoded currency symbols/amounts in mobile UI | **0** (no prices on mobile screens) |
| Server messages shown raw (Russian) in mobile error paths | ≈14 display sites |
| i18n regression tests | 0 at HEAD; concurrent task added `app/tests/i18n.test.ts` at 05:57 (11/11 pass in working tree, see §4.7) |

Runtime confirmation (read from `_audit/runtime-i18n.jsonl`, 9 routes × 5 locales = 45 mobile captures):

- `<html lang>` **is correct** for every locale: `lang=ru` (lines 21–29), `lang=en` (50–58), `lang=es` (79–87), `lang=it` (108–116), `lang=de` (137–145).
- Mobile page content is **identical Russian in all 5 locales**: 10–31 Cyrillic strings per route in `ru`, `en`, `es`, `it` and `de` alike (e.g. `/m` = 29 in every locale).
- No page errors or console errors were captured on mobile routes (unlike `/admin/qr/print`, see §4.1). Non-`ru` captures still show Russian UI, and the Russian date format (`05.11.2026, 18:22`) under `en`/`es` — hardcoded `ru-RU` proof (runtime lines 54, 55, 83, 84).

Bottom line: the mobile maid app is **not localized at all**; the 5 catalogs are structurally complete but **no mobile screen consumes them**. `html lang` and the selected tab are correct; everything else on `/m*` is hardcoded Russian.

## 2. Route-by-route findings

Status legend: **Translated** = all static UI via `next-intl`; **Partial** = mix; **Untranslated** = static UI hardcoded Russian.

### 2.1 `/m` — main maid dashboard

**Status: Untranslated.** Component `app/src/components/mobile/dashboard.tsx` has no `useTranslations` (`grep`: 0 matches). Page wrapper `app/src/app/m/page.tsx` passes only user data (`fullName`).

Untranslated static examples:

- `app/src/components/mobile/dashboard.tsx:80` — `Здравствуйте!`
- `dashboard.tsx:67–73` — stat labels `Мои задачи`, `В работе`, `Выполнено`, `Грязные`, `Чистые`, `Проверено`, `В ремонте`
- `dashboard.tsx:97` — `Смена идёт` / `Смена не начата`; `:99` — `Начните день, чтобы видеть задачи`; `:108` — `Завершить` / `Начать смену`
- `dashboard.tsx:90` — `онлайн` / `офлайн`; `:51`, `:54` — `Смена завершена` / `Смена начата`
- `dashboard.tsx:128–130` — `Мои уборки`, `Активные задачи по приоритету`; `:143–145` — `Мои номера`, `Статусы: грязно · убрано · проверено`
- `dashboard.tsx:10–12` — quick actions `Инвентаризация`, `Раздача`, `Сканировать QR` (+ subtitles)
- `dashboard.tsx:156` — `Действия`
- Shell blocks rendered here: `app/src/components/offline-queue-panel.tsx` (§2.10) and `app/src/components/pwa-register.tsx` (§2.11)

Hardcoded date/currency:

- `dashboard.tsx:42` — `new Intl.DateTimeFormat("ru-RU", { timeStyle: "short" })` for shift start (shown as `с {time}` at `:99`). **Hardcoded `ru-RU`; no currency.**

### 2.2 `/m/tasks` — task list

**Status: Untranslated.** `app/src/components/mobile/tasks.tsx` (0 i18n calls).

- `app/src/components/mobile/tasks.tsx:17–19` — filters `Активные`, `Выполненные`, `Все`
- `tasks.tsx:65–66` — `Мои уборки`, `Задачи по приоритету и статусу`
- `tasks.tsx:94` — `Выполненных задач нет.` / `Активных задач нет.`
- `tasks.tsx:102` — `Номер {task.roomNumber}`; `:105` — `{floorLabel} этаж`
- `tasks.tsx:123` — `· план {plannedMinutes} мин`; `:132–134` — `Чек-лист «{name}»: {answered} из {total}`, `· готов`
- `tasks.tsx:148` — `Берём…` / `Взять в работу`; `:155` — `Открыть задачу`
- Status/type/priority labels come from Russian-only constants: `app/src/lib/domain/cleaning.ts:37–61` (`TASK_STATUS_LABELS`, `CLEANING_TYPE_LABELS`, `PRIORITY_LABELS`, `ROOM_STATUS_LABELS`), used at `tasks.tsx:105,117,122,126`

Hardcoded date/currency: none (only plan minutes). No currency.

### 2.3 `/m/tasks/[id]` — task detail + checklist

**Status: Untranslated.** `app/src/components/mobile/task-detail.tsx` (0 i18n calls).

- `app/src/components/mobile/task-detail.tsx:169` — `Загружаем задачу…`; `:175` — `Задача не найдена`; `:178`, `:190` — `← К задачам`
- `task-detail.tsx:194–201` — `Номер {n}`, `{floor} этаж`, `· план {n} мин`
- `task-detail.tsx:219` — `Офлайн: отметки чек-листа и фото недоступны`
- `task-detail.tsx:260` — `· фото`; `:305` — `alt="Фото пункта"`; `:308` — `Фото не загружено`; `:312` — `Загружаем…` / `Добавить фото`
- `task-detail.tsx:335` — `Комментарий`; `:340` — placeholder `Например: нужен мелкий ремонт, забытые вещи`; `:344` — `Сохранить комментарий`
- `task-detail.tsx:352` — `Взять в работу`; `:361` — `Заполните чек-лист ({answered}/{total})`; `:362` — `Уборка выполнена`; `:371` — `Отказ от уборки`; `:375–376` — `Задача закрыта. Статус «…».`
- Toasts/errors: `task-detail.tsx:94–97` (`Уборка выполнена: номер чистый`, `Отказ от уборки зафиксирован`, `Задача в работе`), `:109`, `:118–119` (`Чек-лист заполнен — можно завершать уборку`, `Отмечено N из M`), `:132`, `:147`, `:161`
- Checklist answers hardcoded: `app/src/lib/domain/checklist.ts:14–18` — `Да`, `Нет`, `Н/П`, rendered at `task-detail.tsx:276`

Hardcoded date/currency: none. No currency.

### 2.4 `/m/rooms` — room status board

**Status: Untranslated.** `app/src/components/mobile/rooms.tsx` (0 i18n calls).

- `app/src/components/mobile/rooms.tsx:16–20` — filters `Все`, `Грязно`, `Убрано`, `Проверено`, `Ремонт`
- `rooms.tsx:48` — `Мои номера`; `:50` — `{n} из {m}`
- `rooms.tsx:73` — `Номеров с таким статусом нет.`
- `rooms.tsx:80–82` — `Номер {number}`, `{floorLabel} этаж`
- `rooms.tsx:105` — `· срочно`; `:109` — `· назначена другой горничной`; `:116` — `Открыть задачу`; `:121` — `Активной задачи нет.`
- Status/type/priority via Russian constants `app/src/lib/domain/cleaning.ts:37–61` (used `rooms.tsx:96,103,104,108`)

Hardcoded date/currency: none. No currency.

### 2.5 `/m/audit` — inventory count list

**Status: Untranslated.** `app/src/components/mobile/audit-list.tsx` (0 i18n calls).

- `app/src/components/mobile/audit-list.tsx:84` — `Инвентаризация`; `:85` — `Мои номера: {n}`
- `audit-list.tsx:96` — `Номер`; `:102` — `— выберите —`; `:111` — `Создаём…` / `Начать инвентаризацию`
- `audit-list.tsx:116` — `Мои сессии`; `:118` — `Пока нет инвентаризаций.`
- `audit-list.tsx:129` — `Номер {roomNumber}`; `:132` — `проведена` / `черновик`
- Errors: `audit-list.tsx:61` — `Выберите номер`; `:65` — `Начать инвентаризацию можно только при наличии сети`; `:76` — `Не удалось начать инвентаризацию`

Hardcoded date/currency:

- `audit-list.tsx:133–136` — `new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" })`. **Hardcoded `ru-RU`** (runtime `en` line 54 shows `05.11.2026, 18:22`). No currency.

### 2.6 `/m/audit/[id]` — inventory count session

**Status: Untranslated.** `app/src/components/mobile/audit-session.tsx` (0 i18n calls).

- `app/src/components/mobile/audit-session.tsx:91` — `Загружаем инвентаризацию…`; `:97` — `Инвентаризация не найдена`; `:100`, `:222` — `← К списку`
- `audit-session.tsx:224` — `Номер {n}`; `:226` — `Черновик` / `Проведена`; `:230` — `Применена {date}`
- `audit-session.tsx:234` — `Офлайн: сохранение и применение уйдут в очередь`
- `audit-session.tsx:256` — `учёт: {expectedQty} {unit}`; `:260` — `· расхождение {delta}` (numbers only in `:260`, label Russian)
- `audit-session.tsx:289` — `Проводим…` / `Применить инвентаризацию`; `:297` — `Сохранить черновик`
- `audit-session.tsx:302` — `Правки запрещены. Исправление — новой инвентаризацией.`
- `audit-session.tsx:307` — `Фото (необязательно)`; `:321` — `alt="Фото инвентаризации"`; `:328` — `Фото нет.`; `:333` — `Снять фото камерой (только при наличии сети)`; `:348` — `Загружаем…`
- Errors/success: `:114` — `«{item}»: нужно целое число ≥ 0`; `:137`, `:141`, `:165` — offline/queue notices; `:147` — `Не удалось сохранить черновик`; `:172–173` — `Проведено. Расхождений: {n} (излишек {x}, недостача {y})`; `:182` — `Не удалось применить инвентаризацию`; `:194`, `:207`, `:209`, `:212` — photo errors/notices

Hardcoded date/currency:

- `audit-session.tsx:38–43` — module-level `formatDate()` uses `new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" })`; used at `:227`, `:230`. **Hardcoded `ru-RU`** (runtime `en` line 55 / `es` line 84). No currency (differences are quantities; `totalValue`/`Value Δ` exist in message catalog but are not rendered on mobile).

### 2.7 `/m/distribute` — distribute from warehouse

**Status: Untranslated.** `app/src/components/mobile/distribute.tsx` (0 i18n calls).

- `app/src/components/mobile/distribute.tsx:139` — `Раздача`; `:141` — `Бельё и химия со склада в номер` / `Офлайн: раздача уйдёт в очередь`
- `distribute.tsx:153` — `Номер`; `:159` — `— выберите —`; `:169` — `Позиция`; `:175` — `— выберите —`; `:184` — `на складе: {qty} {unit}`; `:190` — `Количество`
- `distribute.tsx:221` — `Проводим…` / `Раздать` / `Поставить в очередь`
- Errors: `:88` — `Выберите номер`; `:92` — `Выберите позицию`; `:96` — `Количество — целое число больше нуля`; `:109` — `Нет сети: раздача в очереди, уйдёт при появлении сети`; `:121` — `Раздача проведена`; `:129` — `Не удалось провести раздачу`
- Queued label (UI text persisted into IndexedDB): `:105` — `Раздача: {item} × {qty}`

Hardcoded date/currency: none. No currency (quantities/units only; units are DB data).

### 2.8 `/m/more` — more menu + queue + logout

**Status: Untranslated.** Server component `app/src/app/m/more/page.tsx` (hardcoded literals) + client children.

- `app/src/app/m/more/page.tsx:7–9` — links `Инвентаризация`, `Раздача`, `Сканировать QR` and subtitles (`Остатки и расхождения по номеру`, `Бельё и химия со склада`, `Номер или позиция по метке`)
- `more/page.tsx:18` — `Ещё`; `:45` — footer `Учёт белья · версия 1.3`
- `app/src/components/logout-button.tsx:13` — `Выйти`
- `app/src/components/offline-queue-panel.tsx` — see §2.10

Hardcoded date/currency: none.

Note: footer version `1.3` is stale vs `app/package.json` `2.3.3` — user-visible wrong version, and it is also untranslatable as written.

### 2.9 `/m/scan` — QR scanner

**Status: Untranslated.** `app/src/components/mobile/qr-scanner.tsx` (0 i18n calls).

- `app/src/components/mobile/qr-scanner.tsx:103` — `Сканировать QR`; `:105` — `Метка номера откроет инвентаризацию или раздачу; метка позиции — раздачу.`
- `qr-scanner.tsx:124–125` — `Камера выключена`, `Включить камеру`; `:134` — `Остановить камеру`
- `qr-scanner.tsx:146` — `Ручной ввод кода`; `:150` — placeholder `101, /r/101, HOTEL:ROOM:101 или JSON`; `:155` — `Проверяем…` / `Проверить код`
- `qr-scanner.tsx:162` — `Номер` / `Позиция`; `:172` — `Инвентаризация номера`; `:178` — `Раздача в этот номер`; `:187` — `Раздача этой позиции`
- Errors: `:46` — `Код не распознан`; `:88` — camera-unavailable message

Hardcoded date/currency: none. No currency.

### 2.10 Offline queue / status

**Status: Untranslated.** Panel `app/src/components/offline-queue-panel.tsx` (rendered on `/m` and `/m/more`) + persistence layer.

- `offline-queue-panel.tsx:9–11` — statuses `ждёт отправки`, `конфликт — нужен разбор`, `не отправлено`
- `offline-queue-panel.tsx:31` — `Отправлено: {n}. Конфликтов: {c}, ожидают повтора: {r}.`
- `offline-queue-panel.tsx:73` — `Сеть есть` / `Офлайн — операции копятся в очереди`; `:77` — `Отправляем…` / `Отправить сейчас`
- `offline-queue-panel.tsx:83` — `Очередь пуста.`; `:87` — `В очереди: {p} · конфликтов: {c} · неотправленных: {f}`; `:97` — `· попыток: {n}`; `:120` — `Повторить`
- Queue labels are Russian UI strings composed at enqueue time and persisted in IndexedDB: `app/src/components/mobile/audit-session.tsx:133` (`Черновик номера {n}`), `:161` (`Инвентаризация номера {n}`), `app/src/components/mobile/distribute.tsx:105` (`Раздача: …`)
- Persistence-layer Russian errors surface here via `lastError`: `app/src/lib/offline/db.ts:37` (`IndexedDB не открылся`), `:44` (`IndexedDB недоступен`), `app/src/lib/offline/queue.ts:80` (`Неизвестная ошибка`)

Hardcoded date/currency: none. No currency.

### 2.11 Shared mobile shell

**Status: Untranslated** (shell chrome), with two things that already work correctly.

- Tab bar `app/src/components/tab-bar.tsx:8–11` — `Главная`, `Уборки`, `Номера`, `Ещё` (labels are the only shell strings)
- PWA update banner `app/src/components/pwa-register.tsx:46` — `Доступно обновление приложения`; `:52` — `Обновить`
- `app/src/app/m/layout.tsx` — no text; verifies auth only
- `app/src/components/queue-flusher.tsx` — no visible text
- **[correct] `html lang`**: `app/src/app/layout.tsx:58` — `<html lang={locale}>` with locale from `getConfiguredLocale()` (`app/src/i18n/get-locale.ts:24–33`); runtime confirms `lang=ru/en/es/it/de` on `/m*`
- **[correct] selected tab**: `app/src/components/tab-bar.tsx:21–27` — active state from `usePathname()` + `aria-current="page"`; locale-independent, stays selected (source-verified, not visually verified)
- **[correct] PWA manifest**: `app/src/app/api/manifest/route.ts:18` — `name` uses localized `meta.housekeeping`, `:21` — `lang: locale`, `:22` — `start_url: "/m"`. Manifest is localized even though the shell content is not.
- `dir` attribute is absent; none of the 5 locales is RTL, so no current risk (would matter only if an RTL locale is added)

Hardcoded date/currency: none. No currency.

## 3. User-data strings to keep untranslated

These are DB/branding values, not UI chrome. They should stay as entered, but note that in this installation they are Russian (`prisma/seed.ts:54–56` room types, `:88–89` item names, `:126` maid name, `:339` checklist template), so an `en/es/it/de` UI will still mix in Russian data until an operator renames it.

- Person names: `user.fullName` (`app/src/app/m/page.tsx:6`, `dashboard.tsx:81`, `more/page.tsx:19`), audit `userFullName` / `author` (`audit-session.tsx:226`), `checklist.items[].answeredByName`
- Hotel/branding: `branding.hotelName` (root layout title, login heading), logo/alt
- Rooms: `room.number`, `room.floorLabel`, `room.roomTypeName`, room floor free text
- Catalog: `item.name`, `item.unit` (DB unit values `шт`, `компл`, `л`), item category names, item notes
- Checklists: `checklist.name`, `checklist.items[].text`, `extraOptionText`, per-item `comment`
- Task/audit comments: `task.comment`, audit session comments, photo files/URLs
- QR resolve label: `result.label` returned by `qr.resolve` (`qr-scanner.tsx:164`) is the room number or item name (data)
- Offline queue payload fields are data; the queue **label** is not data (see §2.10 — it is composed UI text and currently frozen in the language used at enqueue time)

## 4. Missing-key / fallback / locale-reset findings

### 4.1 Confirmed missing-key incident (production)

`app/src/components/print-button.tsx:10` calls `t("print")` in namespace `qrPrint`. At HEAD (`9e121b1`) **no locale** defined `qrPrint.print`; the catalog had only `payloadFormat/title/rooms/noPermission/items`. Production (`https://hotel/admin/qr/print`) logs `MISSING_MESSAGE: qrPrint.print (<locale>)` for ru/en/es (runtime lines 15, 44, 73) and renders the raw key path in the Print button. During this audit a concurrent task added `"print"` to all 5 catalogs (working tree 546 keys) — the fix is present locally. Whether production has been rebuilt/redeployed since that capture is unverified (see Appendix C); the live capture taken during this audit still showed the error.

At HEAD there was no catalog/code parity check, so a key used in code could be absent from all catalogs with no build-time error; the test added concurrently at 05:57 now covers literal `t()` keys (§4.7) and would have caught this specific case.

### 4.2 Fallback behavior

- `app/src/i18n/request.ts:5–12` has **no `onError`/`fallback`** handling. With next-intl defaults, a missing key logs `MISSING_MESSAGE` and returns the key path (observed in production), so pages keep rendering but show `namespace.key`.
- There is no per-locale fallback chain (e.g. es→en); a key present only in `en` is "missing" for the other four.
- The 5 catalogs are otherwise in sync: 0 key diffs, 0 placeholders mismatched, 0 empty values (checked at HEAD and in the working tree). The missing key was in code, not between catalogs.

### 4.3 Offline queue logic depends on Russian server text

- `app/src/lib/offline/backoff.ts:38–39` — `isAlreadyApplied()` returns true only when the error message contains the Russian substring `"уже проведена"`.
- That substring comes from `app/src/server/trpc/routers/audit.ts:50` (`Инвентаризация уже проведена — правки запрещены`).
- Any attempt to localize server messages (or an operator/1C integration changing wording) silently breaks offline idempotency for `APPLY_AUDIT`: a repeated apply would be retried as a failure instead of being treated as success. Fix: classify by tRPC/error code (or a dedicated `AUDIT_ALREADY_APPLIED` code), never by localized text.

### 4.4 Locale reset / persistence findings

- **No mobile locale reset found.** `html lang` and message loading come from `getConfiguredLocale()` (`app/src/i18n/get-locale.ts:24–33`: Setting → `NEXT_LOCALE` cookie → `APP_DEFAULT_LOCALE` → `en`). No mobile file writes `NEXT_LOCALE` or `ui.locale`. Mobile captures show the selected locale respected at document level on every route.
- Locale is **installation-global**, not per user/device: there is no `[locale]` URL segment and no per-user preference (`CHANGELOG.md:32`). All maids share the locale chosen in `/admin/settings`. Changing it does not reset, but an already-open PWA updates only after reload/re-navigation; since the locale is not in the URL, a soft client-side navigation can keep stale client messages until a hard refresh. No auto-refresh/polling exists.
- **Cookie fallback can mask a reset**: if `Setting.ui.locale` disappears (DB restore/reset, manual deletion), the cookie wins only on browsers that have `NEXT_LOCALE`; otherwise the installation silently falls back to `APP_DEFAULT_LOCALE` (default `en`). Documented (`docs/CONFIGURATION.md:43`), but it means a DB restore can switch a `ru` install to `en` with no in-app signal. Seed does not write `ui.locale` (`prisma/seed.ts:269–274`), and the installer does not reset it — good.
- **Offline cache freezes the locale**: `public/sw.js:3–9,40–55` caches documents per URL (no locale in URL/cache key). If the locale changes, offline navigations can serve old-locale HTML from cache until the next online load. Cached pages are also currently fully Russian, so this is moot until mobile is localized — but the cache key strategy must be addressed with the fix.
- **IndexedDB freezes queue labels** (`audit-session.tsx:133,161`, `distribute.tsx:105`): a label enqueued in Russian stays Russian; a later localization cannot retranslate already-queued rows. Store `kind` + data and render the label with `t()` at display time.

### 4.5 Server messages surface untranslated in mobile

Mobile displays raw tRPC error text in ~14 places: `tasks.tsx:56`; `task-detail.tsx:101,123,150,164,175`; `audit-list.tsx:74–76`; `audit-session.tsx:97,144–147,179–183,207,212`; `distribute.tsx:127`; `qr-scanner.tsx:46`. Routers return Russian-only messages (`server/trpc/routers/audit.ts:35,42,50,66,70,196–198`, `cleaning.ts:246,273,279–288,370–374,441–455,484–487`, `operations.ts:81,98,124–127`, `qr.ts:76,95,107,138–140`). Client-side translation of these requires server-side error codes; the UI currently cannot localize them even after the screens are translated.

### 4.6 Untranslated values that are *not* a problem

The `identical to en` sets (`ru` 7, `es` 21, `it` 15, `de` 24) are overwhelmingly proper names (`locale.*`, `Excel`, `JSON …`), correct cognates (`Status`, `Total`, `General`, `Checklist`, `Plan`, `Manager`), or intentionally identical terms (`Password` in it, `Branding`). They are on admin screens, not mobile. No action needed; do not "fix" by machine-translating brand terms.

### 4.7 Test coverage gap

At HEAD `9e121b1`, `app/tests` had no catalog-completeness test, no key-usage scan and no check that mobile components use `useTranslations`; `money.test.ts:15` was the only locale-aware test. That is how `qrPrint.print` shipped, and how the mobile gap survived a v2.3.3 changelog that claims localization work.

During this audit a concurrent task added `app/tests/i18n.test.ts` (11 tests, run read-only: 11/11 pass in the working tree). It covers catalog key parity, empty values, required namespaces/keys, placeholders, Cyrillic-in-non-ru values, money formatting/parsing, namespaces used by `src`, and every **literal** `t("…")` key — i.e. it would have caught `qrPrint.print` at HEAD. It does **not** cover:

- mobile UI strings that bypass `next-intl` entirely (nothing fails when `task-detail.tsx` hardcodes `Да`/`Нет`, because there is no `t()` call to check);
- hardcoded `ru-RU` date formatters (`dashboard.tsx:42`, `audit-list.tsx:133`, `audit-session.tsx:39`);
- dynamically indexed keys (`t(noticeKey)` in `language-currency-settings.tsx:105`, `tLocale(value)`, `STATUS_LABELS[...]`) — only literal keys are scanned;
- server error message localization and the Russian-substring idempotency dependency (§4.3).

Recommended extension: a Cyrillic-literal scan over `app/src/components/mobile`, `app/src/app/m` and the shared shell (allowlist comments/data), plus a date-format assertion per locale.

## 5. Priority fix list

### P0 — foundation (blocks all other mobile work)

1. **Add `next-intl` to every mobile screen**: `useTranslations` in the 8 `app/src/components/mobile/*.tsx` client components and `app/src/components/tab-bar.tsx`, `offline-queue-panel.tsx`, `pwa-register.tsx`, `logout-button.tsx`; `getTranslations` in `app/src/app/m/more/page.tsx`; pass the locale/room data through props or add a small `MobileIntlProvider` where needed.
2. **Add a `mobile.*` namespace to all 5 catalogs at once** (dashboard greeting/stats/shift, tasks/rooms/audit/distribute/scan/more/menu, offline queue, PWA banner, tab labels, version footer). Reuse existing namespaces where they already fit: `common.*` (save/saving/cancel/close/loading/error/logout), `cleaning.*` (taskNew/taskInProgress/taskDone/taskCancelled, daily/onDemand/general, low/medium/urgent, clean/dirty/inspected/outOfOrder, tasks, room, minutesShort, empty, checklist), `audit.*` (title/start/continue/draft/appliedStatus/sessions/empty/photos/choose/author/room/errorRoom/errorStart/creating/draftHint), `auditSession.*` (loading/fact/book/difference/saveDraft/apply/applying/appliedLocked/appliedSummary/photo*/invalidQty/back/applyWarning), `nav.*` where the label matches exactly. Add ICU plurals for counts (e.g. `{answered} of {total}`, `N из M`) — Russian/German need plural forms; the existing catalogs do not use ICU plurals, so this is new territory.
3. **Replace all 3 hardcoded `ru-RU` formatters** with `useLocale()` / `getLocale()`: `dashboard.tsx:42`, `audit-list.tsx:133–136`, `audit-session.tsx:38–43`. This directly contradicts `CHANGELOG.md:10` ("Даты и время форматируются по выбранному locale") for mobile.
4. **Extend the new i18n regression test** (concurrent task added `app/tests/i18n.test.ts`; 11/11 pass): it already enforces catalog parity, placeholders and literal `t()` keys — add (a) a Cyrillic-literal scan over `app/src/components/mobile`, `app/src/app/m` and the shared shell, and (b) a per-locale date-format assertion, so this gap cannot regress.

### P1 — route localization

5. Localize the 9 routes in this order: `/m/tasks` + `/m/tasks/[id]` (most used), `/m` (dashboard), `/m/rooms`, `/m/audit` + `/m/audit/[id]`, `/m/distribute`, `/m/scan`, `/m/more`.
6. Localize the shared shell and offline surfaces (§2.10, §2.11): tab labels, PWA update banner, library-level errors in `lib/offline/db.ts:37,44` and `lib/offline/queue.ts:80`, queue statuses/messages.
7. Fix the stale `/m/more` footer: `more/page.tsx:45` hardcodes `версия 1.3` while the product is `2.3.3`. Use the package version/build constant, or drop the line; localize the product name if kept.
8. Stop persisting localized queue labels: store structured kind+params and render via `t()` at display (`audit-session.tsx:133,161`, `distribute.tsx:105`).

### P1 — server/error channel

9. Replace the Russian-substring idempotency check `lib/offline/backoff.ts:38–39` with an error code (`audit.ts:50`) — otherwise localizing server messages breaks offline apply.
10. Return machine-readable error codes from tRPC routers and translate them on the client (or localize centrally in the error formatter used by both admin and mobile). Today every mobile mutation/query error is Russian-only (§4.5).

### P2 — offline/locale propagation

11. Address the service-worker document cache vs locale: either include locale in the cache key, purge `navigate` caches on locale change, or accept and document stale-locale offline HTML (`public/sw.js:40–55`).
12. On locale change, force affected clients to reload/refresh (e.g. broadcast via `BroadcastChannel`/SW message, or `router.refresh()` after settings save) — currently a maid's open PWA keeps old client messages until reload.
13. Decide and document the data-language policy: seeded rooms/types/items/checklists are Russian (`prisma/seed.ts:54–56,88–89,126,339`); an `en/es/it/de` UI will still show Russian data. Either provide a localized demo seed / rename tooling, or document that user data is not translated (`CHANGELOG.md:11` already states this for names — extend it to units/categories).

### Verification after fixes

- `node <parity script>`: 5 catalogs, same key set, no empty values, no placeholder mismatch (current baseline 546/546/546/546/546 at working tree).
- Static scan for Cyrillic literals in mobile scope: target 0 (excluding comments/seed/test fixtures).
- Runtime: repeat the 9-route × 5-locale capture; expect `cyrillicCount` ≈ 0 for en/es/it/de except user data, and localized dates (`11/5/26` style for en, `05.11.2026` for ru, etc.).
- Re-check `<html lang>` stays equal to the selected locale and `aria-current` tab selection is unchanged (already correct today).

## Appendix A — hardcoded string inventory (script count)

| File | Cyrillic literals |
|---|---|
| `app/src/components/mobile/audit-session.tsx` | 34 |
| `app/src/components/mobile/task-detail.tsx` | 35 |
| `app/src/components/mobile/dashboard.tsx` | 29 |
| `app/src/components/mobile/tasks.tsx` | 16 |
| `app/src/components/mobile/distribute.tsx` | 19 |
| `app/src/components/mobile/qr-scanner.tsx` | 16 |
| `app/src/components/mobile/audit-list.tsx` | 14 |
| `app/src/components/mobile/rooms.tsx` | 14 |
| `app/src/components/offline-queue-panel.tsx` | 12 |
| `app/src/components/tab-bar.tsx` | 4 |
| `app/src/components/pwa-register.tsx` | 2 |
| `app/src/components/logout-button.tsx` | 1 |
| `app/src/app/m/more/page.tsx` | 8 |
| `app/src/lib/domain/cleaning.ts` | 14 |
| `app/src/lib/domain/checklist.ts` | 3 |
| `app/src/lib/offline/db.ts` | 2 |
| `app/src/lib/offline/queue.ts` | 1 |
| `app/src/lib/offline/backoff.ts` | 1 (locale-coupled message check, not UI) |
| **Total** | **≈225** |

Counts include repeated label maps and non-UI error strings; route wrapper files (`page.tsx`, `layout.tsx` except `more/page.tsx`) contain no literals.

## Appendix B — commands used (reproducible)

- `node --version` → `v24.22.0`; `git -C hotel-linen-management rev-parse --short HEAD` → `9e121b1`
- Locale parity: Node script flattening the 5 JSONs → key sets, missing keys, empty values, `identical to en`, `{placeholder}` diff (outputs in §1/§4).
- Literal scan: Node script over mobile scope → Cyrillic string literals per file (Appendix A).
- Key-usage scan: Node script mapping `useTranslations`/`getTranslations` namespaces + literal `t("…")` calls against `en.json` → confirmed `qrPrint.print` missing at HEAD (the only literal key not in the catalog, though `print-button.tsx` is admin, not mobile).
- Test run (read-only): `node --import tsx --test tests/i18n.test.ts` in `app/` → 11/11 pass on the working tree (this test file was added concurrently at 05:57; it does not exist at HEAD).
- Runtime evidence: read-only cross-check of `hotel-linen-management/_audit/runtime-i18n.jsonl` (45 mobile captures). I did **not** access `https://hotel` myself and did **not** change production locale, settings, DB or deployment.

## Appendix C — not verified

- Visual layout/bidi rendering after translation (no browser screenshots taken by this audit; runtime captures are text-only).
- Whether production is redeployed with the concurrent `qrPrint.print` fix (production still showed `MISSING_MESSAGE` when the runtime audit captured it).
- Translation quality of existing es/it/de admin strings (out of mobile scope; owned by the admin i18n task).
- Actual auth-gated mobile behavior for a real maid session after localization (would require a test login; not performed — destructive/credentialed checks were out of scope).
