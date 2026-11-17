# deploy — эксплуатация (Windows, OSPanel)

Канонические руководства: [INSTALL-OPEN-SERVER.md](../docs/INSTALL-OPEN-SERVER.md) (пошагово для новичка), [DEPLOYMENT.md](../docs/DEPLOYMENT.md) (развёртывание), [OPERATIONS.md](../docs/OPERATIONS.md) (эксплуатация), [CONFIGURATION.md](../docs/CONFIGURATION.md) (настройки). Этот файл — краткая шпаргалка для текущей установки.

## 0. Фактическое развёртывание на этой машине (2026-11-05)

| Параметр | Значение |
|---|---|
| OSPanel | 6.5.1, GUI `C:\OSPanel\bin\ospanel.exe`, API CLI работает только вне PowerShell |
| Проект | `C:\OSPanel\home\hotel\app` (исходники скопированы в `C:\OSPanel\home\hotel`) |
| Домен | `https://hotel` (alias `hotel.local`), Apache reverse proxy на `127.0.0.1:3000` |
| Конфиг проекта | `C:\OSPanel\home\hotel\.osp\project.ini`: `backend_enabled=on`, `backend_port=3000`, `tls_enabled=on` |
| Сертификат | `C:\OSPanel\data\ssl\projects\hotel\cert.*`, выписан OSPanel Root CA; корень импортирован в `Cert:\CurrentUser\Root`, цепочка валидна |
| hosts | `127.0.1.11 hotel hotel.local` (Apache слушает только loopback `127.0.1.11`) |
| Node-сервис | `npm start` из `app`, слушает `0.0.0.0:3000`, лог `app\logs\server.log` |
| Автозапуск | `%APPDATA%\...\Startup\hotel-linen-autostart.cmd` (OSPanel + Node) |
| LAN | `http://10.0.2.111:3000` (правило брандмауэра для `node.exe` уже разрешено, профиль Public) |

**Важный нюанс статики.** Шаблон OSPanel для proxy-vhost не проксирует файлы с расширениями (`.js`, `.css`, `.png` и т.п.), а отдаёт их из `DocumentRoot = C:\OSPanel\home\hotel`. Поэтому в корне проекта сделаны junction'ы на артефакты Next:

```cmd
mklink /J C:\OSPanel\home\hotel\_next  C:\OSPanel\home\hotel\app\.next
mklink /J C:\OSPanel\home\hotel\icons  C:\OSPanel\home\hotel\app\public\icons
copy C:\OSPanel\home\hotel\app\public\sw.js C:\OSPanel\home\hotel\sw.js
if exist C:\OSPanel\home\hotel\manifest.webmanifest del C:\OSPanel\home\hotel\manifest.webmanifest
```

При пересборке приложения junction не нужно пересоздавать (он ведёт на каталог), копию `sw.js` — обновлять вручную, если менялась. Webmanifest динамический (`/api/manifest`), статический файл в корне не нужен.

**Брандмауэр (требует администратора).** Правило для Apache добавить нельзя из-под обычного пользователя. Для доступа с телефона по домену/HTTPS выполнить в elevated PowerShell:

```powershell
New-NetFirewallRule -DisplayName "Hotel Apache 80/443" -Direction Inbound -Protocol TCP -LocalPort 80,443 -Action Allow -Profile Private,Public
```

До этого телефон тестируется напрямую через Node: `http://10.0.2.111:3000` (без установки PWA — нужен HTTPS).

---

## 1. Запуск приложения

```cmd
deploy\start.cmd
```

Node-сервис слушает `0.0.0.0:3000`. Автозапуск — Startup `hotel-linen-autostart.cmd` (запускает OSPanel при необходимости и Node, если порт 3000 не занят).

## 2. Домен OSPanel как reverse proxy

`Document Root` для домена **не задаётся**: Next.js исполняется Node-процессом, Apache только проксирует.

**Apache (OSPanel → домен → Apache config):**

```apache
ProxyPreserveHost On
ProxyPass        / http://127.0.0.1:3000/ retry=0
ProxyPassReverse / http://127.0.0.1:3000/
```

Нужны модули `mod_proxy`, `mod_proxy_http`.

**Nginx (модуль OSPanel):**

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

После включения — `NEXTAUTH_URL="https://hotel"` в `.env` и перезапуск сервиса.

## 3. HTTPS для телефонов (вариант A из ТЗ §9.4)

Service Worker и установка PWA требуют secure context: по `http://<LAN-IP>` они не работают.

1. Выпустить самоподписанный сертификат на имя домена (PowerShell, без UAC):

```powershell
$cert = New-SelfSignedCertificate -DnsName "hotel", "hotel.local" `
  -CertStoreLocation "Cert:\LocalMachine\My" -NotAfter (Get-Date).AddYears(3)
$pwd = ConvertTo-SecureString -String "<пароль-pfx>" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath deploy\hotel.pfx -Password $pwd
```

Экспорт сертификата в PEM для Apache/Nginx — через `openssl` или `certutil`; OSPanel ожидает `cert.pem`/`key.pem` в конфигурации домена.

2. Установить **корневой** сертификат на каждом телефоне один раз (Android: «Настройки → Безопасность → Установить сертификат»).
3. Открыть `https://hotel` → «Добавить на главный экран». `NEXTAUTH_URL` переключить на `https://`.

> Сертификат и `.pfx` в репозиторий и снапшоты не попадают (секреты).

## 4. Бэкап и восстановление

```cmd
deploy\backup.cmd                              :: VACUUM INTO -> app\backups\
deploy\restore.cmd app\backups\app-<штамп>.db  :: сервер должен быть остановлен
```

`restore.cmd` сам сохраняет текущую БД в `backups\pre-restore-<штамп>.db`, затем копирует бэкап и печатает `PRAGMA integrity_check`.

## 5. Интеграция с 1С

Фоновый воркер стартует вместе с сервисом (`instrumentation.ts`) и раз в минуту:

- отправляет `OutboxEntry` со статусом `PENDING` (ретраи 1 с → 30 мин, максимум 8 попыток);
- обновляет номенклатуру, если прошёл `integration.syncIntervalMinutes`.

Ручные действия — в админке «Настройки → Интеграция 1С»: проверка соединения, синхронизация, отправка очереди, полное отключение.
Протокол HTTP-сервиса 1С: `GET /hs/hotel/ping`, `GET /hs/hotel/items`, `POST /hs/hotel/operations` (Basic-авторизация).

## 6. Проверка UI

```cmd
node app\scripts\ui-check.mjs
```

Требует запущенный сервер на `http://127.0.0.1:3000`; Chromium лежит в `app\.playwright-browsers`.
