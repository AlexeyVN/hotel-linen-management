# Настройки и конфигурация

Справочник переменных окружения, параметров интерфейса, прав и интеграций.

---

## 1. Переменные `.env`

Файл: `app/.env`, шаблон — `app/.env.example`. В репозиторий не коммитится.

| Переменная | Обязательна | Назначение | Пример |
|---|---|---|---|
| `DATABASE_URL` | да | SQLite; путь от `prisma/` | `file:../data/app.db` |
| `NEXTAUTH_URL` | да | внешний URL приложения; база QR-ссылок | `https://hotel.example.com` |
| `NEXTAUTH_SECRET` | да | подпись JWT + ключ шифрования пароля 1С | 32+ случайных байта |
| `TZ` | нет | часовой пояс | `Europe/Moscow` |
| `LOG_LEVEL` | нет | уровень pino | `info`, `debug`, `warn` |
| `INTEGRATION_WORKER_TOKEN` | нет | Bearer для внешнего запуска воркера 1С | длинный случайный токен |
| `APP_DEFAULT_LOCALE` | нет | язык чистой установки | `en` |
| `APP_DEFAULT_CURRENCY` | нет | валюта чистой установки | `USD` |

`NEXTAUTH_URL` должен точно совпадать с адресом, по которому открывается сайт (схема, домен, порт). Смена URL делает сохранённые QR-метки «устаревшими» — их нужно перегенерировать.

---

## 2. Настройки в интерфейсе

### 2.1 Общие настройки

`/admin/settings` (ADMIN; менеджеру доступны только общие параметры без брендинга):

| Параметр | Ключ `Setting` | Значение |
|---|---|---|
| Язык интерфейса | `ui.locale` | `ru` / `en` / `es` / `it` / `de` |
| Валюта учёта | `ui.currency` | `RUB` / `USD` / `EUR` |
| Показывать даты | `ui.showDates` | `true` / `false` |
| Акцентный цвет | `ui.accentColor` | HEX, например `#2563eb` |
| Название отеля | `branding.hotelName` | строка |
| Ответственный: ФИО | `print.responsibleName` | строка |
| Ответственный: должность | `print.responsiblePosition` | строка |
| Логотип | `branding.logoVersion/Width/Height` | метаданные файла |

Язык и валюта — глобальные. Новая установка без `Setting` использует `APP_DEFAULT_LOCALE=en` и `APP_DEFAULT_CURRENCY=USD`; существующая установка сохраняет `ru`/`RUB`. Валюта меняется только до первой операции (`Operation`), после этого блокируется. Пересчёта и курсов нет.

Логотип хранится в `storage/branding/logo.png`. Цвет применяется через CSS-переменную `--primary`; сервер отклоняет цвета с контрастом к белому < 4.5:1.

### 2.2 Палитра

`#2563eb` синий (по умолчанию), `#4f46e5` индиго, `#7c3aed` фиолетовый, `#0f766e` бирюзовый, `#047857` изумрудный, `#b45309` янтарный, `#be123c` розовый, `#334155` графит. Можно ввести свой HEX.

### 2.3 Меню

- «Склад»: Справочник, Склад.
- «Документы»: Приёмка, Раздача, Возврат, Списание, Инвентаризация, QR-коды.
- «Уборка»: Уборка, Горничные, Чек-листы.
- «Настройки»: Общие настройки, Номера и типы комнат, Пользователи, Роли, Интеграция 1С.

---

## 3. Права

20 прав, 3 роли. ADMIN — все; MANAGER — все, кроме `users.manage`, `roles.manage`, `rooms.write`, `rooms.manage`, `settings.branding`; MAID — `rooms.read`, `audit.create`, `photos.view`, `distribution.create`, `cleaning.execute`.

| Право | Что открывает |
|---|---|
| `rooms.read` | номера, QR-раздел |
| `rooms.write` | устаревшее право; маршруты используют `rooms.manage` |
| `rooms.manage` | создание/редактирование/удаление номеров и типов (ADMIN) |
| `warehouse.read` | склад |
| `warehouse.receive` | приёмка |
| `catalog.manage` | справочник |
| `distribution.create` | раздача |
| `return.create` | возврат |
| `writeoff.create` | списание |
| `audit.create` | инвентаризация |
| `cleaning.manage` | уборка, горничные, чек-листы |
| `cleaning.execute` | выполнение своих задач |
| `reports.view` | отчёты и Excel |
| `users.manage` | пользователи |
| `roles.manage` | роли |
| `settings.integration` | 1С |
| `settings.minstock` | минимальные остатки |
| `settings.ui` | общие настройки |
| `settings.branding` | логотип, цвет, печатные реквизиты |
| `photos.view` | фотофиксация |

Права проверяются на сервере; скрытие пункта меню — только UX. Роль ADMIN нельзя лишить `users.manage`/`roles.manage`; нельзя деактивировать себя.

---

## 4. Интеграция 1С

Настройки: `/admin/settings/1c` (ADMIN/MANAGER с `settings.integration`).

| Ключ | Назначение |
|---|---|
| `integration.enabled` | включена/выключена |
| `integration.mode` | `stub` / `onec` |
| `integration.baseUrl` | базовый URL HTTP-сервиса 1С |
| `integration.login` | логин Basic |
| `integration.password` | зашифрованный пароль (AES-256-GCM) |
| `integration.syncIntervalMinutes` | интервал синхронизации номенклатуры |
| `integration.lastSyncAt` | последняя синхронизация |
| `integration.lastError` | последняя ошибка |
| `integration.roomStatusEnabled` | включён обмен статусами номеров |
| `integration.roomStatusPath` | путь SetRoomStatus (по умолчанию `/hs/Housekeeping/v1/SetRoomStatus`) |
| `integration.roomStatusMethod` | `POST` / `PUT` |
| `integration.roomStatusToken` | зашифрованный `X-Webhook-Token` |

Протокол номенклатуры: `GET /hs/hotel/ping`, `GET /hs/hotel/items`, `POST /hs/hotel/operations` (Basic). Точный формат зависит от 1С; при отличии меняется `src/server/erp/adapters/onec.ts`.

### 4.1 Статусы номеров

Входящий webhook: `POST /api/integrations/1c/room-status`, заголовок `X-Webhook-Token`. Канонический JSON:

```json
{
  "eventId": "1c-2026-11-05-000123",
  "roomNumber": "101",
  "status": "DIRTY",
  "occurredAt": "2026-11-05T16:20:00+03:00"
}
```

Поддерживаются алиасы `number`, `cleaningStatus`, `timestamp`. Статусы: `CLEAN`/`DIRTY`/`INSPECTED`/`OUT_OF_ORDER` и русские варианты. Повтор `eventId` игнорируется; событие старше локального `cleaningStatusUpdatedAt` — `IGNORED`.

Исходящий: `{base}{roomStatusPath}` (метод POST/PUT), Basic Auth, JSON `{eventId, roomNumber, status, occurredAt, source:"hotel-linen"}`. Очередь `RoomStatusEvent`; 5xx/таймаут — ретраи до 8, 4xx — `FAILED`. Воркер отправляет статусы вместе с операциями.

Важно: точный путь/поля/наличие webhooks в релизе «1С:Отель» не подтверждены публичной документацией; параметры настраиваются, перед включением проверьте на тестовом контуре.

Воркер: стартует с `instrumentation.ts`, раз в минуту отправляет `PENDING` из `OutboxEntry` и `RoomStatusEvent`; ретраи до 8 попыток. Внешний запуск — `POST /api/integration/worker` с `Authorization: Bearer <INTEGRATION_WORKER_TOKEN>`; без токена требуется сессия с `settings.integration`.

---

## 5. Файлы и хранилища

| Путь | Что | В git |
|---|---|---|
| `app/data/app.db` | SQLite | нет |
| `app/storage/photos/` | фотофиксация | нет |
| `app/storage/qr/<room|item>/<id>/` | QR PNG/SVG | нет |
| `app/storage/branding/logo.png` | логотип | нет |
| `app/logs/server.log` | pino | нет |
| `app/backups/` | бэкапы | нет |
| `app/public/` | `sw.js`, иконки; webmanifest — динамический `/api/manifest` | да |

Файлы вне `public` отдаются только через API с проверкой прав (кроме публичного логотипа).

---

## 6. Ограничения и лимиты

- Фото: JPEG/PNG/WebP до 5 МБ.
- Логотип: PNG до 2 МБ, 16–2000 px; клиент уменьшает до 1600 px.
- Пароль: 8–100 символов; логин: 4–32, `[a-z0-9._-]`.
- Сессия: 8 часов; блокировка после 10 ошибок на 15 минут.
- Один экземпляр Node на SQLite.
- QR: одна активная метка на объект; удаляется только при удалении объекта.
- PWA: HTTPS обязателен.

---

## 7. Резервные копии

`deploy/backup.cmd` (Windows) / `sqlite3 ... VACUUM INTO` (Linux). Хранить БД и `storage/`; проверять `PRAGMA integrity_check`; тестировать восстановление. Перед обновлением схемы — обязательный бэкап.
