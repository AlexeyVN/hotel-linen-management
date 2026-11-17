# Документация

Проект: учёт постельного белья и инвентаря отеля **«Белая пристань» / White Harbor**. Идея и постановка — Vlasevskii Aleksei Nikolaevich. Разработчик — DeepSeek Harness. Лицензия — Apache 2.0.

Карта документов проекта.

| Документ | Для кого | Содержание |
|---|---|---|
| [README](../README.md) | все | возможности, быстрый старт, тесты, структура |
| [DEPLOYMENT](DEPLOYMENT.md) | DevOps/администратор | установка, env, systemd, Nginx/Apache, OSPanel, HTTPS, PWA, бэкапы, обновление |
| [INSTALL-OPEN-SERVER](INSTALL-OPEN-SERVER.md) | новичок/администратор | пошаговая установка на Windows + OSPanel «с нуля» |
| [OPERATIONS](OPERATIONS.md) | администратор/менеджер/горничная | ежедневные операции, уборка, QR, отчёты, настройки, типовые проблемы |
| [CONFIGURATION](CONFIGURATION.md) | администратор/разработчик | env, `Setting`, права, 1С, файлы, лимиты |
| [GITHUB](GITHUB.md) | владелец репозитория | состав, секреты, публикация, CI, лицензия, релиз |
| [ТЗ v3.2](hotel-linen-TZ-v3.2.md) | заказчик/разработчик | требования, архитектура, статусы M1–M14 + обмен статусами 1С |
| [1С: статусы номеров](plan-1c-room-status-2026-11-05.md) | интегратор/разработчик | webhook, SetRoomStatus, маппинг, очередь, mock-проверка |
| [Гибкие номера](plan-rooms-custom-fields-2026-11-17.md) | администратор/разработчик | этаж числом/названием, новый тип, `rooms.manage`, read-only менеджера |
| [CHANGELOG](../CHANGELOG.md) | все | история версий |
| [LICENSE](../LICENSE) / [NOTICE](../NOTICE) | все | Apache 2.0 и авторство |
| [Бренд](../brand/README.md) | дизайн/маркетинг | «Белая пристань»: знак, lockup, палитра, иконки |
| [SECURITY](../SECURITY.md) | владелец/DevOps | модель безопасности, сообщения об уязвимостях |
| [deploy/README](../deploy/README.md) | администратор Windows | шпаргалка OSPanel/бэкап |
| `plan-*.md` | разработчик | планы и результаты этапов |
| `analysis-housekeeping-market-2026-11-05.md` | продукт | анализ рынка |
| `screenshots/` | все | витринные скриншоты |

Начинать с README, затем DEPLOYMENT (установка) и OPERATIONS (работа).
