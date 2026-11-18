# Передача проекта — hotel-linen-management

Дата: 2026-11-18  
Релиз: **v2.3.6** (тег `v2.3.6`, релизный коммит `51ea0a2`; handoff-документация — `0fffb92`)  
Ветка: `main`  
Production: `https://hotel` — HTTP 200  
Текущая установка: **ru / RUB**  
Новая установка по умолчанию: **en / USD**

## 1. Что это за проект

Веб-приложение для отеля: учёт постельного белья, инвентаря и химии, склад, приёмка, раздача по номерам, возврат, списание, инвентаризация с фото, QR-метки, Excel, хаускипинг (задачи, чек-листы, горничные), роли/права, брендинг и интеграция с 1С.

Стек:

- Next.js 15 App Router, React 19, TypeScript strict;
- tRPC v11, Prisma 6 + SQLite, next-auth v4 JWT;
- Tailwind 3.4, PWA;
- `next-intl` 4.x — 5 языков: `ru`, `en`, `es`, `it`, `de`;
- pino + SQLite `LogEvent` для диагностического журнала;
- тесты: `node:test` через `tsx`; Playwright используется для runtime-аудитов.

### Офлайн-профиль отеля (10 комнат)

Готовое приложение работает **без интернета, без нейросетей/ИИ и без облака**, на локальном компьютере отеля. Все данные — локальная SQLite; 1С опциональна и работает только по локальной сети.

Минимальная инфраструктура:

- 1 локальный ПК: x86-64, 4 ядра, 8 ГБ ОЗУ, 128 ГБ SSD, Windows 11 Pro 64-bit;
- рекомендуется: 6 ядер / Intel i5, 16 ГБ ОЗУ, 256–512 ГБ SSD;
- 1 гигабитный роутер/коммутатор;
- 1 точка доступа Wi-Fi 5/6 (802.11ac/ax) с проводным uplink; 2 — при бетонных стенах;
- отдельный SSID персонала WPA2/WPA3, по возможности VLAN;
- ПК администратора, 2–4 смартфона/планшета горничных (10–20 устройств);
- UPS 600–1000 ВА для ПК, роутера и точки доступа;
- ежедневный backup SQLite/фото/QR/логов на USB или локальный NAS.

Ограничение: готовое приложение работает офлайн, но **первичная установка/обновление** требуют заранее подготовленного offline-пакета с `node_modules` и `.next` (или компьютера с интернетом для `npm ci`/build). Source-zip без зависимостей сам по себе не является полностью офлайн-установщиком.

Подробно на 5 языках: [`docs/OFFLINE-HOTEL.md`](OFFLINE-HOTEL.md).

## 2. Где что лежит

| Путь | Назначение |
|---|---|
| `app/src/app/admin` | серверная админка |
| `app/src/app/m` | мобильный кабинет горничной |
| `app/src/components` | UI и клиентские формы |
| `app/src/server/trpc` | tRPC-роутеры, middleware, права |
| `app/src/server/services` | операции, 1С, QR, logging |
| `app/src/i18n` | конфиг locale/currency, `messages/*.json`, `report-labels.ts` |
| `app/prisma/schema.prisma` | схема БД |
| `app/prisma/migrations` | 13 миграций |
| `app/tests` | 103 теста |
| `_audit` | отчёты аудита i18n и логирования |
| `_releases` | архивы релизов |
| `_checkpoints` | снапшоты проекта |

Ключевые документы:

- [`_audit/REPORT.md`](_audit/REPORT.md) — i18n-аудит, runtime-матрица, приоритеты;
- [`_audit/logging-implementation.md`](_audit/logging-implementation.md) — реализация логирования;
- [`_audit/logging-feasibility.md`](_audit/logging-feasibility.md) — исследование логирования;
- [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) — настройки;
- [`docs/INSTALL-OPEN-SERVER.md`](docs/INSTALL-OPEN-SERVER.md) — установка;
- [`FutureToDo.md`](../FutureToDo.md) — текущий backlog.

## 3. Состояние функциональности

### Готово

- Все административные страницы локализованы на 5 языков.
- Мобильный кабинет `/m*` локализован полностью; добавлен namespace `mobile` — 177 ключей × 5 языков.
- Глобальный выбор языка в Настройках; `<html lang>` и manifest следуют locale.
- Единая валюта RUB/USD/EUR без пересчёта; смена только до первой операции.
- 1С блокируется при валюте не RUB.
- Excel: locale/currency-aware заголовки, даты, подписи, типы/статусы; данные пользователя не переводятся.
- Журнал событий `/admin/logs`: pino + `LogEvent`, фильтры, request ID, 90 дней, redaction; право `logs.view` только ADMIN.
- Auth-события, tRPC mutations/errors, экспорт отчётов логируются.
- Тесты: **103/103**; build успешен.

### Числа

- 21 право, 3 роли, 13 миграций.
- 5 locale × ~700 ключей (точное число проверяется тестом).
- 103 теста.
- Runtime-аудит: 145 страниц (29 маршрутов × 5 языков), `html lang` совпал 145/145.

### Известные ограничения

1. **Серверные ошибки** tRPC/Zod/1С всё ещё отдают русский текст и показываются в любом locale. Нужны машиночитаемые `AppError`-коды и клиентский перевод.
2. **Логирование**:
   - успешные read-запросы не логируются;
   - 1С worker пишет в pino, но не во все доменные `LogEvent`;
   - retention БД вызывается при открытии `/admin/logs`, а не cron;
   - нет экспорта журнала CSV/JSON;
   - нет logout/смены пароля как отдельных событий.
3. **Offline mobile**:
   - старые записи IndexedDB сохраняют язык, на котором были созданы;
   - service worker может отдать кэшированный HTML другого locale;
   - `lib/offline/backoff.ts` использует русскую подстроку `"уже проведена"` для идемпотентности — менять только вместе с серверным контрактом.
4. **Данные**: текущая production-база — демо-состояние (`Operation=0`), в `LogEvent` лежат 2 проверочных события.
5. **Локальная копия и production** — разные базы; после изменений схемы обязательно `prisma migrate deploy` на production.

## 4. Как запустить и проверить

Проект: `C:\Users\DIGMA_PRO\Documents\deepseek-harness\Coding_workspace\hotel-linen-management\app`.

```powershell
cd C:\Users\DIGMA_PRO\Documents\deepseek-harness\Coding_workspace\hotel-linen-management\app
npm.cmd ci
npx.cmd prisma generate
npx.cmd prisma migrate deploy
npm.cmd test
npm.cmd run build
npm.cmd run start
```

Production-копия: `C:\OSPanel\home\hotel\app`; после обновления исходников:

1. остановить процесс на порту 3000;
2. скопировать `app/` без `node_modules`, `.next`, `data`, `.env`, `logs`;
3. **важно:** при использовании robocopy с `/XD logs` скопировать `src/app/admin/logs` отдельно — иначе страница `/admin/logs` не попадёт в сборку;
4. `npm.cmd ci`, `prisma generate`, `prisma migrate deploy`, `npm.cmd run build`;
5. запустить `npm.cmd run start` и проверить `https://hotel/login`.

Проверка production:

```powershell
curl.exe -sk -o NUL -w "%{http_code}" https://hotel/login
sqlite3 C:\OSPanel\home\hotel\app\data\app.db "SELECT key,value FROM Setting WHERE key IN ('ui.locale','ui.currency');"
```

## 5. Логирование — кратко

- Схема: `LogEvent` (13-я миграция), индексы по дате/модулю/уровню/пользователю.
- Админка: `/admin/logs`, право `logs.view`, фильтры module/level/date/search, пагинация.
- Запись: `app/src/server/services/logging.ts`; sanitization; pino + SQLite.
- tRPC middleware: `app/src/server/trpc/trpc.ts`.
- Auth: `app/src/lib/auth.ts`.
- Отчёты: `app/src/app/api/reports/export/route.ts`.
- Retention: файлы 14 дней, БД 90 дней.
- Проверено: `auth.login.success`, `reports.export`, `settings.setShowDates`; `/admin/logs` 200, ошибок нет.

## 6. Следующие задачи по приоритету

**P0**
1. Машиночитаемые коды серверных ошибок + перевод на клиенте.
2. Тест e2e на смену языка без перезагрузки и сохранение открытых групп меню.

**P1**
3. 1С-события `integration.sync.*` / `integration.push.*` в `LogEvent`.
4. Автоматический retention БД (cron/worker) и экспорт журнала.
5. Offline mobile: миграция старых подписей очереди и locale-aware SW-кэш.

**P2**
6. Расширить тесты Excel round-trip для всех 5 языков.
7. Добавить logout/session-события и аудит изменений ролей.
8. Проверить `logs.view` для MANAGER (сейчас только ADMIN).

## 7. Git / релизы

- Remote: `git@github.com:AlexeyVN/hotel-linen-management.git`
- Ветка: `main`
- Тег: `v2.3.6`
- Последний релизный коммит: `51ea0a2`
- CI: зелёный (GitHub Actions workflow `.github/workflows/ci.yml`)
- Архив: `_releases/hotel-linen-management-v2.3.6-open-server.zip`
- Снапшот: `_checkpoints/hotel-linen-management-20261118-071336` (1075 файлов; integrity_check=ok)
- Предыдущий pre-i18n архив: `_releases/hotel-linen-management-v2.2.0-pre-i18n.zip`

## 8. Правила продолжения

- Перед изменениями схемы — миграция + `prisma generate` + тест.
- Не коммитить `.env`, базы, `storage`, `logs`, `node_modules`, `.next`.
- Секреты и токены не выводить в отчёты.
- Для UI-изменений проверять 5 locale и `html lang`.
- Для логирования не писать пароли/токены/тела запросов; использовать `sanitizeMetadata`.
- После релиза: commit → tag → push → CI → архив → checkpoint.

## 9. Как быстро войти в контекст

1. Прочитать этот файл.
2. Прочитать `_audit/REPORT.md` (i18n) и `_audit/logging-implementation.md` (логирование).
3. Запустить `npm.cmd test` и `npm.cmd run build`.
4. Проверить `/admin/logs` и `/admin/settings`.
5. Начать с P0: серверные коды ошибок.
