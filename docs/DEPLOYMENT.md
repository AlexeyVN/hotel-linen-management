# Развёртывание

Практическое руководство: от чистой машины до `https://<домен>` с HTTPS, PWA и резервными копиями.

**Если вы ставите систему впервые и не хотите разбираться в терминах — начните с [пошаговой инструкции для Open Server Panel](INSTALL-OPEN-SERVER.md).** Ниже — полное техническое руководство для всех вариантов.

---

## 1. Архитектура

```
Браузер / телефон
      │ HTTPS
      ▼
Nginx / Apache / OSPanel  (reverse proxy, TLS)
      │ http://127.0.0.1:3000
      ▼
Next.js (npm start, Node 24)
      ├── Prisma → SQLite: app/data/app.db
      ├── storage/photos/  (фотофиксация)
      ├── storage/qr/      (QR-метки)
      ├── storage/branding/(логотип)
      └── logs/server.log
```

- Один экземпляр Node на SQLite: **не запускайте несколько процессов** на одну БД.
- Node слушает `0.0.0.0:3000` (или `127.0.0.1` за прокси).
- PWA и установка на телефон требуют HTTPS.

---

## 2. Требования

| Компонент | Версия |
|---|---|
| Node.js | 24+ |
| npm | 11+ (поставляется с Node) |
| SQLite | не требуется отдельно (Prisma bundled) |
| ОС | Linux (рекомендуется) / Windows 11 |
| Прокси | Nginx, Apache или OSPanel |
| Память | от 1 ГБ, диск — по объёму фото |

---

## 3. Установка приложения

```bash
cd hotel-linen-management/app
npm ci
cp .env.example .env        # Windows: copy .env.example .env
```

Заполнить `.env` (см. [CONFIGURATION.md](CONFIGURATION.md)):

```dotenv
DATABASE_URL="file:../data/app.db"
NEXTAUTH_URL="https://hotel.example.com"
NEXTAUTH_SECRET="<32+ случайных байта>"
TZ="Europe/Moscow"
LOG_LEVEL="info"
```

Сгенерировать секрет:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

База и seed:

```bash
mkdir -p data
npx prisma generate
npx prisma migrate deploy
npx prisma db seed          # только первый запуск
```

Seed создаёт 3 демо-пользователя, роли, права, номера и демо-номенклатуру. Повторный запуск идемпотентен, но на production его не нужно выполнять после каждого обновления.

Сборка и запуск:

```bash
npm run build
npm start
```

Проверка:

```bash
curl -I http://127.0.0.1:3000/login
```

---

## 4. systemd (Linux)

`/etc/systemd/system/hotel-linen.service`:

```ini
[Unit]
Description=Hotel linen management
After=network.target

[Service]
Type=simple
User=hotel
WorkingDirectory=/opt/hotel-linen/app
EnvironmentFile=/opt/hotel-linen/app/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now hotel-linen
sudo systemctl status hotel-linen
```

Права: каталоги `data`, `storage`, `logs`, `backups` должны быть доступны пользователю `hotel` на запись.

---

## 5. Reverse proxy

### 5.1 Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name hotel.example.com;

    ssl_certificate     /etc/letsencrypt/live/hotel.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hotel.example.com/privkey.pem;

    client_max_body_size 10m;   # фото до 5 МБ, логотип до 2 МБ

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
    }
}
```

`NEXTAUTH_URL` должен совпадать с внешним URL (`https://hotel.example.com`), иначе QR-ссылки будут вести не туда.

### 5.2 Apache

Нужны `mod_proxy`, `mod_proxy_http`, `mod_ssl`, `mod_headers`.

```apache
<VirtualHost *:443>
    ServerName hotel.example.com
    SSLEngine on
    SSLCertificateFile    /etc/ssl/certs/hotel.crt
    SSLCertificateKeyFile /etc/ssl/private/hotel.key

    ProxyPreserveHost On
    ProxyPass        / http://127.0.0.1:3000/ retry=0
    ProxyPassReverse / http://127.0.0.1:3000/
    RequestHeader set X-Forwarded-Proto "https"
</VirtualHost>
```

### 5.3 Текущая установка на Windows + OSPanel

Фактическая конфигурация этой машины:

| Параметр | Значение |
|---|---|
| OSPanel | 6.5.1, домен `https://hotel` (alias `hotel.local`) |
| Проект | `C:\OSPanel\home\hotel` (приложение — `app`) |
| Apache | reverse proxy на `http://127.0.0.1:3000` |
| Node | `npm start`, `0.0.0.0:3000` |
| Конфиг домена | `C:\OSPanel\home\hotel\.osp\project.ini` |
| Сертификат | `C:\OSPanel\data\ssl\projects\hotel\cert.*` (OSPanel Root CA) |
| hosts | `127.0.1.11 hotel`, `127.0.1.11 hotel.local` |
| Автозапуск | Startup `hotel-linen-autostart.cmd` (OSPanel + Node) |
| Лог | `C:\OSPanel\home\hotel\app\logs\server.log` |

**Статика Next за OSPanel.** Apache шаблона OSPanel отдаёт файлы с расширениями (`.js`, `.css`, `.png`) из `DocumentRoot`, а не через прокси, поэтому в `C:\OSPanel\home\hotel` созданы junction'ы и копии:

```cmd
mklink /J C:\OSPanel\home\hotel\_next  C:\OSPanel\home\hotel\app\.next
mklink /J C:\OSPanel\home\hotel\icons  C:\OSPanel\home\hotel\app\public\icons
copy C:\OSPanel\home\hotel\app\public\sw.js C:\OSPanel\home\hotel\sw.js
if exist C:\OSPanel\home\hotel\manifest.webmanifest del C:\OSPanel\home\hotel\manifest.webmanifest
```

После `npm run build` junction'ы обновлять не нужно; `sw.js` копировать заново, если он менялся. Webmanifest динамический (`/api/manifest`) и не копируется в DocumentRoot.

Запуск/остановка:

```cmd
deploy\start.cmd
:: остановить: завершить процесс node.exe, слушающий 3000
```

Проверка:

```cmd
curl.exe -kI https://hotel/login
```

**Брандмауэр.** Для доступа с телефона по HTTPS нужно разрешить 80/443 в elevated PowerShell (UAC):

```powershell
New-NetFirewallRule -DisplayName "Hotel Apache 80/443" -Direction Inbound `
  -Protocol TCP -LocalPort 80,443 -Action Allow -Profile Private,Public
```

До этого телефон может открывать `http://10.0.2.111:3000` напрямую (без установки PWA).

**HTTPS и телефоны.** Сертификат OSPanel Root CA должен быть доверенным на устройстве. Иначе браузер покажет предупреждение, а service worker/PWA не установятся. Установите корневой сертификат один раз вручную.

---

## 6. PWA

- Работает только по HTTPS (secure context).
- После входа откройте сайт на телефоне → «Добавить на главный экран».
- Service worker кэширует оболочку; данные — из сети. Офлайн-очередь хранится в IndexedDB.
- При обновлении приложения может понадобиться кнопка «Обновить» / перезагрузка, чтобы получить новый `sw.js`.

---

## 6.1. Обмен статусами номеров с 1С

1. Применить миграцию `20261105163336_room_status_sync`.
2. В `/admin/settings/1c` включить интеграцию (режим 1С/HTTP для боевого контура), затем блок «Статусы номеров»:
   - скопировать URL `https://<домен>/api/integrations/1c/room-status` и передать внедренцу 1С;
   - сгенерировать `X-Webhook-Token` и передать его в настройки webhook 1С;
   - указать путь SetRoomStatus (по умолчанию `/hs/Housekeeping/v1/SetRoomStatus`) и метод POST/PUT;
   - сохранить и проверить тестовым событием.
3. Сетевой доступ:
   - 1С → приложение: HTTPS POST на webhook; прокси должен пропускать метод и тело JSON без авторизации приложения (авторизация — заголовок токена);
   - приложение → 1С: HTTP(S) к опубликованному HTTP-сервису, Basic Auth пользователя с правами Housekeeping/Rooms.
4. Проверить, что 1С умеет отправлять webhooks в вашем релизе. Если нет — нужен polling/агент на стороне 1С; текущий endpoint принимает только входящие события.
5. Токен хранится зашифрованным; при замене старый токен перестаёт работать — обновите 1С.
6. Точный контракт (путь, JSON, коды статусов) не подтверждён публичной документацией; тестируйте на копии 1С, затем включайте в production.

Диагностика: 401 — неверный токен; 503 — обмен/токен выключен; 400 — номер/статус/дата; статусы в очереди — проверить «Отправить статусы» и лог.

---

## 7. Резервное копирование

SQLite нельзя копировать «на горячую» при WAL; используйте `VACUUM INTO`.

Windows:

```cmd
deploy\backup.cmd
```

Linux:

```bash
sqlite3 app/data/app.db "VACUUM INTO 'backups/app-$(date +%Y%m%d-%H%M%S).db'"
```

Рекомендуется ежедневный cron/Task Scheduler и хранение копий вне сервера. Вместе с БД полезно архивировать `app/storage/` (фото, QR, логотип).

Восстановление: остановить Node → сохранить текущую БД → скопировать бэкап в `data/app.db` → проверить `PRAGMA integrity_check` → запустить. Windows: `deploy\restore.cmd <backup.db>`.

---

## 8. Обновление и откат

1. Сделать бэкап БД и `storage/`.
2. Остановить сервис.
3. Обновить исходники.
4. `npm ci && npx prisma generate && npx prisma migrate deploy`
5. `npm run build`
6. Запустить, проверить `/login`, логи, тестовый вход.
7. При ошибке — вернуть предыдущую папку приложения и БД из бэкапа.

Миграции применяются только вперёд; перед обновлением с изменением схемы обязателен бэкап.

---

## 9. После установки (обязательно)

- [ ] Сменить пароли `admin/manager/maid` или удалить демо-пользователей.
- [ ] Задать длинный `NEXTAUTH_SECRET`, не публиковать `.env`.
- [ ] Включить HTTPS и доверенный сертификат.
- [ ] Ограничить доступ к `app/data`, `app/storage`, `app/backups` на файловой системе.
- [ ] Настроить ежедневный бэкап и проверить восстановление.
- [ ] Проверить `NEXTAUTH_URL` и QR-ссылку с телефона.
- [ ] Заполнить логотип, название отеля, ответственного, цвет в «Настройках».
- [ ] Настроить 1С или оставить интеграцию выключенной.
- [ ] Проверить права ролей: менеджер/горничная не видят лишнего.

---

## 10. Диагностика

| Симптом | Что проверить |
|---|---|
| 502/503 от прокси | Node слушает 3000, `npm start`, лог |
| Статика 404 в OSPanel | junction `_next`, копии `sw.js`/`manifest` |
| QR ведёт на localhost | `NEXTAUTH_URL` и перегенерация метки |
| Не ставится PWA | HTTPS, сертификат, `sw.js`, manifest |
| «Требуется вход» по кругу | `NEXTAUTH_URL`, cookie, системное время |
| Фото/логотип не грузится | права на `storage`, размер файла, прокси-лимит |
| 1С не отправляет | настройки интеграции, воркер, `INTEGRATION_WORKER_TOKEN` |
| БД заблокирована | не запущено ли несколько Node-процессов |

Логи: `app/logs/server.log` (pino JSON). Проверка БД: `sqlite3 app/data/app.db "PRAGMA integrity_check;"`.
