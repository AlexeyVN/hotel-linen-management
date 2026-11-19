# Описание проекта и решения для дальнейшей работы

Дата: 2026-11-19  
Версия: **2.3.6**  
Репозиторий: <https://github.com/AlexeyVN/hotel-linen-management>  
Production: `https://hotel`  
Текущая установка: ru / RUB (текущее явное значение); при первой установке язык интерфейса администратора и горничных — **English**.

## 1. Что это

Локальное веб-приложение для отеля: учёт постельного белья, инвентаря и химии, склад, приёмка, раздача, возврат, списание, инвентаризация с фото, QR, Excel, уборка, горничные, чек-листы, роли, брендинг и журнал событий.

Стек:

- Next.js 15 App Router, React 19, TypeScript strict;
- tRPC v11, Prisma 6 + SQLite, next-auth v4;
- `next-intl`, Tailwind, PWA;
- pino + `LogEvent`;
- 103 теста, 13 миграций.

## 2. Для кого и какой диапазон

- Малые отели **5–100 комнат**.
- Европа: **Apaleo** — один опциональный коннектор.
- Россия: **1С + Excel**.
- Работа **без интернета, AI и облака** — основная ценность.
- Apaleo — только при наличии интернета и желания; локальное ядро не зависит от него.

## 3. Языки

По умолчанию для всех — **English**. Встроенные языки:

```text
en (default) → ru → it → es → de → fr
```

- **При первой установке и у администратора, и у горничных язык — English.**
- После входа каждый пользователь может выбрать свой язык; выбор хранится в `User.locale`.
- Пример предпочтений после настройки: администратор **de**, горничные **it/es**.
- English — fallback и дефолт для новых пользователей без явного выбора.
- Существующая установка может сохранять явно выбранный locale.
- Тесты: **6 языков для администратора и горничных** (12 role/locale сценариев), плюс placeholders/fallback.
- `es-MX` — возможный отдельный pack позже.
- Французский каталог должен проверить носитель.

## 4. Устройства

| Устройство | Минимум |
|---|---|
| Android | **Android 9 (API 28)** |
| iPad | **iPad 7-го поколения** (iPadOS 15) |
| iPhone | iOS 15+ |
| Браузер | актуальный Chrome/Safari |

Проверить реальные iPad 7 и Android 9: login, задачи, QR, offline queue, PWA. Не обещать поддержку более старых устройств без теста.

Тестовое окружение: [docs/TESTING-ENV.md](TESTING-ENV.md) — Android 9 emulator установлен и проверен; iPhone/iPad — WebKit-эмуляция, нативного iOS Simulator на Windows нет.

## 5. Производительность

Замеры 100 комнат:

- normal admin pages p50 30–40 мс;
- low-stock 640 мс server / 1.46 с browser;
- 10 одновременных low-stock — 5.6 с;
- SQLite/Prisma не бутылочное горлышко; проблема — HTML 3 000 строк.

Обязательные улучшения:

- low-stock pagination (100 строк);
- WAL + `busy_timeout`;
- индекс `Operation(documentDate)`;
- ограничение параллельных Excel-экспортов.

5–50 комнат — комфортно; 100 — после этих улучшений.

## 6. Apaleo — решение

- **Simple client + client credentials**, одно property.
- **Fine-grained** minimal permissions: property/unit inventory read, unit housekeeping update.
- Без reservations/rates/folios/payments/PII.
- **PII: Omit all**.
- Polling first; webhooks только при публичном HTTPS.
- Секреты: `id_client_apaleo.txt` в корне проекта или env; не БД/UI.
- Публичный API key для Apaleo **не делать**.
- Бюджет: **€100 / 5 000 ₽** за one-time connector.
- Marketplace/certification не входит.

### Файл ключей

`id_client_apaleo.txt`:

```text
The client id is: <client_id>
The client secret is: <client_secret>
```

- добавлен в `.gitignore`;
- не входит в архив/checkpoint;
- читается только server-side;
- не логируется и не отправляется в чат;
- `property_id` получается через API после успешного токена.

## 7. Stage 0.5 — текущий статус

**READ-ONLY PASS.**

- Токен получен: `Bearer`, `expires_in=3600`, fine-grained (`scope=identity:permissions`).
- Property: `LND` («Hotel London»), статус **Test**, 51 unit.
- Отдельного `housekeeping`-объекта нет. Поле условия:
  ```json
  { "status": { "isOccupied": false, "condition": "Clean" } }
  ```
- Допустимые значения `status.condition`:
  ```text
  Clean
  CleanToBeInspected
  Dirty
  ```
- Обновление: `PATCH /inventory/v1/units/{id}` (JSON Patch), permission
  `core.units.status.condition.modify` или `core.units.modify`.
- Запись **не выполнялась**. Нужно отдельное разрешение на no-op PATCH.
- `LND` — тестовый отель; для production нужен реальный `property_id`.
- Секреты не попали в git/архив.

Подробно: [docs/plans/apaleo-spike.md](plans/apaleo-spike.md).

## 8. Дорожная карта

| Этап | Содержание |
|---|---|
| Stage 0.5 | Apaleo token/property/units/condition discovery; **read-only pass** |
| Stage 1 | 6 языков, English при первой установке, per-user locale, device baseline, performance fixes |
| Stage 2 | Apaleo connector MVP: pull/push `status.condition`, polling, outbox, UI |
| Stage 3 | acceptance, e2e, device tests, release |
| Later | dependency evaluation, custom `es-MX`, optional webhooks |

После Stage 0.5 — остановка и согласование дальнейших шагов с пользователем.

## 9. Принципы

- Не переписывать в микросервисы.
- Не строить marketplace.
- Не добавлять публичный API key для Apaleo.
- Не хранить секреты в БД/UI/логах.
- Локальное ядро работает всегда.
- Один PMS-коннектор по запросу.
- Любой релиз: тесты, build, device checks, backup, archive.

## 10. Ссылки

- [Handoff 2026-11-19](HANDOFF-2026-11-19.md)
- [План Apaleo](plans/apaleo-connector.md)
- [Stage 0.5 результат](plans/apaleo-spike.md)
- [Планы этапов](plans/README.md)
- [Reliability checklist](plans/reliability-checklist.md)
- [Performance baseline](plans/performance-baseline.md)
- [Handoff](CONTINUATION.md)
