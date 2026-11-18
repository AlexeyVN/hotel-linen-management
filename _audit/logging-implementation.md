# Реализация логирования — отчёт

Дата: 2026-11-18  
Проект: `hotel-linen-management`  
Статус: **реализовано** для P2 (Phase 0–2 + базовый Phase 3–4); коды серверных ошибок остаются отдельным остатком.

## 1. Что сделано

### 1.1 Файловый логгер

Файл: `app/src/lib/logger.ts`.

Исправлено:

- уровень `LOG_LEVEL` теперь реально работает: sinks больше не прибиты к `info`;
- в base добавлены `pid` и `hostname`;
- ротация по **локальной** дате, а не UTC;
- автоматическая очистка файлов старше `LOG_RETENTION_DAYS` (по умолчанию 14) при старте и смене суток;
- удалён мёртвый `exitHook`.

Файлы: `logs/app-YYYY-MM-DD.log` + stdout.

### 1.2 Таблица `LogEvent`

Prisma model: `LogEvent`  
Миграция: `prisma/migrations/20261118070000_log_events/migration.sql`

Поля:

| Поле | Назначение |
|---|---|
| `createdAt` | время события |
| `level` | debug/info/warn/error |
| `module` | auth/users/catalog/warehouse/operations/audit/cleaning/checklists/qr/reports/integration/settings/system |
| `action` | tRPC path или доменное действие |
| `outcome` | success/failure/denied/skipped |
| `message` | краткое описание |
| `userId`, `userLogin`, `userRole` | автор |
| `requestId` | корреляция запроса |
| `entityType`, `entityId` | объект |
| `durationMs` | длительность |
| `errorCode` | код ошибки |
| `metadata` | безопасный JSON, до 4 КБ |

Индексы: `createdAt`, `(module, createdAt)`, `(level, createdAt)`, `(userId, createdAt)`.

Миграция также добавляет право `logs.view` и назначает его роли `ADMIN`.

### 1.3 Сервис логирования

Файл: `app/src/server/services/logging.ts`.

- `logEvent()` пишет одновременно в pino и `LogEvent`;
- ошибка записи в БД не ломает запрос;
- `sanitizeMetadata()` рекурсивно вырезает `password`, `token`, `secret`, `authorization`, `cookie`, `csrf`, API-ключи и webhook-токены;
- значения строк ограничены 300 символами, metadata — 4 КБ;
- `moduleForPath()` стабильно раскладывает tRPC paths по модулям;
- `cleanupOldLogEvents(90)` удаляет старые записи БД.

### 1.4 Автоматические события

**tRPC** (`app/src/server/trpc/trpc.ts`):

- middleware на всех процедурах;
- успешные **mutations** пишут `outcome=success`, path, user, duration, request ID;
- ошибки любых процедур пишут `level=error`, `outcome=failure`, TRPC code;
- queries успешно не логируются (иначе журнал забивается шумом).

**Auth** (`app/src/lib/auth.ts`):

- `login.success`;
- `login.failed`;
- `login.locked`;
- `login.disabled`;
- `login.rate_limit`.

**Reports** (`app/src/app/api/reports/export/route.ts`):

- `reports.export` с report/period/size/duration.

### 1.5 Админский просмотр

Страница: `/admin/logs` (`app/src/app/admin/logs/page.tsx`).

- право `logs.view` — только ADMIN;
- фильтры: module, level, date range, свободный поиск по user/action/message/entity;
- пагинация по 100;
- поля: время, level, module, action, outcome, user, duration, message, error code, entity, request ID, metadata (раскрывается);
- удаление записей старше 90 дней при открытии страницы;
- интерфейс локализован (namespace `logs`, 5 языков).

## 2. Защита и ограничения

- **НЕ является** юридическим audit trail. Источник истины — `Operation` и `AuditSession`.
- Не пишутся: пароли, токены, cookie, тела запросов, полные PII.
- `userId/login/role` пишутся для диагностики; это осознанно.
- Успешные read-запросы не логируются.
- Файлы: 14 дней; БД: 90 дней.
- Multi-process: файлы разделяются по дате, но не по pid; для диагностики в записи есть pid.
- Старые IndexedDB-очереди мобильного клиента могут содержать старые подписи — это не относится к серверному журналу.

## 3. Проверка

### Тесты

```text
tests 103
pass 103
fail 0
```

Добавлены `app/tests/logging.test.ts`:

- redaction секретов на всех уровнях;
- ограничение размера metadata;
- маппинг tRPC paths на модули.

### Сборка

```text
✓ Compiled successfully
✓ Generating static pages (30/30)
BUILD_EXIT_CODE=0
```

### Production

- миграция применена: 13 migrations, `LogEvent` создана, `logs.view` назначен ADMIN;
- вход admin создал:

```text
info | auth | login.success | success | admin
```

- переключение настройки создало две записи:

```text
info | settings | settings.setShowDates | success | 6 ms
```

- `/admin/logs` — HTTP 200, `html lang=en`, ошибок консоли нет, данные отображаются;
- текущая установка после проверки возвращена в `ru` / `RUB`.

## 4. Что осталось

1. **Коды серверных ошибок.** tRPC-ошибки логируются, но клиент всё ещё показывает русские сообщения сервера. Нужен `AppError`/error code mapping и перевод на клиенте.
2. **1С worker** пишет в pino, но не во все доменные события `LogEvent`; стоит добавить `integration.sync.*` и `integration.push.*` с request/tick ID.
3. **Retention БД** вызывается при открытии `/admin/logs`; для полностью автоматической очистки нужен cron/worker.
4. **Доменные события** audit/cleaning/QR/operations сейчас покрываются tRPC middleware; отдельные бизнес-события (например, «инвентаризация применена») можно добавить в сервисы для более точной диагностики.
5. **Экспорт журнала** в CSV/JSON пока не реализован; страница поддерживает просмотр и фильтры.

## 5. Итог

Логирование работает end-to-end: событие → pino → SQLite → фильтруемая admin-страница. Оно пригодно для диагностики действий, ошибок и 1С-проблем, но не заменяет аудит бухгалтерских операций и пока не закрывает локализацию серверных ошибок.
