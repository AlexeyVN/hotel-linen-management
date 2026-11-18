# Офлайн-работа отеля / Offline hotel deployment

Версия: **2.3.6**  
Назначение: отель на **10 номеров**, локальная установка на компьютере отеля.

> **Коротко:** готовое приложение работает **без интернета**, **без нейросетей и внешних AI-сервисов**, **на локальном компьютере** отеля. Все данные — в локальной SQLite; 1С подключается только опционально и только по локальной сети. Интернет не требуется для работы смены, склада, уборки, QR, отчётов и журнала событий.

---

## 1. Минимальные системные требования

| Компонент | Минимум | Рекомендуется |
|---|---|---|
| Компьютер | x86-64, 4 ядра | 6 ядер / Intel i5 или аналог |
| ОЗУ | 8 ГБ | 16 ГБ |
| Диск | 128 ГБ SSD | 256–512 ГБ SSD |
| ОС | Windows 11 Pro 64-bit | Windows 11 Pro 64-bit + актуальные обновления |
| Сеть | Ethernet 1 Гбит/с | Ethernet 1 Гбит/с + статический IP / DHCP reservation |
| Питание | бытовая сеть | UPS 600–1000 ВА для ПК, роутера и точки доступа |
| ПО | Node.js 24 LTS, SQLite (встроена), браузер Chrome/Edge/Safari | то же + локальный антивирус и ежедневный backup |
| Монитор | 1366×768 | 1920×1080 |

Приложение обслуживает 10 номеров, 1–3 администраторов/менеджеров, 2–4 горничных и 10–20 одновременных клиентских устройств. Отдельный сервер и интернет не нужны.

## 2. Инфраструктура для отеля на 10 комнат

- **1 локальный компьютер отеля** — одновременно сервер приложения и рабочее место администратора.
- **1 роутер/коммутатор** с гигабитными портами.
- **1 точка доступа Wi-Fi 5/6 (802.11ac/ax)** с проводным uplink; при бетонных стенах — 2 точки доступа.
- **Отдельный SSID для персонала**: WPA2/WPA3, изолированный VLAN (по возможности), покрытие всех 10 номеров и служебных помещений.
- **Статический IP или DHCP reservation** для компьютера отеля; локальное имя `hotel` / запись в DNS или hosts.
- **Клиенты**: компьютер администратора, 2–4 смартфона/планшета горничных, при необходимости принтер для QR/Excel.
- **Backup**: ежедневная копия SQLite, фото, QR и журналов на внешний USB-диск или локальный NAS; хранить вне компьютера.
- **Питание**: UPS для ПК, роутера и точки доступа; скачки питания не должны прерывать запись операций.

Схема:

```text
10 rooms / staff phones
        │ Wi-Fi 5/6, WPA2/3, staff SSID
        ▼
 [Access point] ── Ethernet ── [Router/Switch]
                                      │
                                      ▼
                         [Hotel PC: app + SQLite]
                                      │
                              optional local 1C
```

## 3. Что работает без интернета

- вход и роли;
- номера, склад, приёмка, раздача, возврат, списание;
- инвентаризация и фото;
- уборка, горничные, чек-листы;
- QR и печатные формы;
- отчёты и Excel;
- журнал событий `/admin/logs`;
- резервное копирование.

Внешние API, облака, телеметрия и AI не используются. 1С — **опциональный локальный** HTTP-сервис; без 1С приложение работает полностью автономно.

## 4. Установка и обновление без интернета

Готовое приложение после установки работает без интернета. Первичная сборка/обновление выполняются **заранее** на компьютере с интернетом:

1. на подготовительном компьютере: `npm ci`, `prisma generate`, `npm run build`;
2. перенести каталог `app` с `node_modules` и `.next` (или подготовленный offline-пакет) на компьютер отеля;
3. перенести `.env.example` → `.env`, выполнить `prisma migrate deploy`;
4. запустить приложение;
5. на объекте интернет не требуется.

Стандартный source-zip без `node_modules` требует npm-реестра при установке; для полностью офлайн-монтажа используйте заранее подготовленный пакет с зависимостями и сборкой. Это важно учитывать при передаче дистрибутива.

---

# English

**Ready hotel app runs without internet, without neural networks/AI, on the hotel's local computer.** All data is stored in local SQLite; 1C is optional and local-only. No cloud, telemetry or external API is required for hotel operations.

## Minimum requirements

| Component | Minimum | Recommended |
|---|---|---|
| PC | x86-64, 4 cores | 6 cores / Intel i5 or similar |
| RAM | 8 GB | 16 GB |
| Disk | 128 GB SSD | 256–512 GB SSD |
| OS | Windows 11 Pro 64-bit | Windows 11 Pro + updates |
| Network | 1 Gbps Ethernet | 1 Gbps Ethernet + static IP/reservation |
| Power | mains | 600–1000 VA UPS for PC/router/AP |
| Software | Node.js 24 LTS, SQLite, current Chrome/Edge/Safari | plus local antivirus and daily backup |

## Infrastructure for 10 rooms

- one hotel PC running the app and SQLite;
- one gigabit router/switch;
- one Wi-Fi 5/6 access point with wired uplink (two for thick concrete walls);
- separate staff SSID with WPA2/WPA3 and, if possible, VLAN;
- static IP or DHCP reservation for the hotel PC;
- admin PC, 2–4 maid phones/tablets, optional local printer;
- daily backup to USB disk or local NAS; UPS for PC/router/AP.

```text
10 rooms / staff phones
        │ staff Wi-Fi SSID
        ▼
 [Access point] ── Ethernet ── [Router/Switch]
                                      │
                                      ▼
                         [Hotel PC: app + SQLite]
                                      │
                              optional local 1C
```

**Offline installation:** the finished app runs offline. Initial build/update is prepared on an internet-connected computer (`npm ci`, `prisma generate`, `npm run build`), then the app with `node_modules` and `.next` (or a prepared offline package) is transferred to the hotel. The plain source ZIP needs npm registry access; use an offline bundle for a fully disconnected installation.

---

# Español

**La aplicación lista para el hotel funciona sin internet, sin redes neuronales/IA y en el ordenador local del hotel.** Todos los datos se guardan en SQLite local; 1C es opcional y solo local. No se necesitan nube, telemetría ni API externas.

## Requisitos mínimos

| Componente | Mínimo | Recomendado |
|---|---|---|
| PC | x86-64, 4 núcleos | 6 núcleos / Intel i5 o similar |
| RAM | 8 GB | 16 GB |
| Disco | SSD 128 GB | SSD 256–512 GB |
| SO | Windows 11 Pro 64 bits | Windows 11 Pro + actualizaciones |
| Red | Ethernet 1 Gbps | Ethernet 1 Gbps + IP fija/reserva DHCP |
| Alimentación | red eléctrica | SAI 600–1000 VA para PC/router/AP |
| Software | Node.js 24 LTS, SQLite, Chrome/Edge/Safari actual | + antivirus local y copia diaria |

## Infraestructura para 10 habitaciones

- un PC del hotel con la aplicación y SQLite;
- un router/switch gigabit;
- un punto de acceso Wi-Fi 5/6 con uplink por cable (dos si hay muros de hormigón);
- SSID separado para el personal con WPA2/WPA3 y VLAN si es posible;
- IP fija o reserva DHCP para el PC del hotel;
- PC de administración, 2–4 móviles/tabletas de gobernantas, impresora local opcional;
- copia diaria a USB/NAS local; SAI para PC, router y AP.

**Instalación sin internet:** la aplicación terminada funciona sin conexión. La compilación/actualización inicial se prepara en un ordenador con internet (`npm ci`, `prisma generate`, `npm run build`) y luego se transfiere la app con `node_modules` y `.next` (o un paquete offline). El ZIP de fuentes necesita acceso a npm; para una instalación totalmente desconectada use el paquete offline.

---

# Italiano

**L'app pronta per l'hotel funziona senza internet, senza reti neurali/IA e sul computer locale dell'hotel.** Tutti i dati sono in SQLite locale; 1C è opzionale e solo locale. Non servono cloud, telemetria o API esterne.

## Requisiti minimi

| Componente | Minimo | Consigliato |
|---|---|---|
| PC | x86-64, 4 core | 6 core / Intel i5 o simile |
| RAM | 8 GB | 16 GB |
| Disco | SSD 128 GB | SSD 256–512 GB |
| SO | Windows 11 Pro 64-bit | Windows 11 Pro + aggiornamenti |
| Rete | Ethernet 1 Gbps | Ethernet 1 Gbps + IP statico/prenotazione DHCP |
| Alimentazione | rete elettrica | UPS 600–1000 VA per PC/router/AP |
| Software | Node.js 24 LTS, SQLite, Chrome/Edge/Safari aggiornati | + antivirus locale e backup giornaliero |

## Infrastruttura per 10 camere

- un PC dell'hotel con app e SQLite;
- un router/switch gigabit;
- un access point Wi-Fi 5/6 con uplink cablato (due con muri in cemento);
- SSID separato per il personale con WPA2/WPA3 e, se possibile, VLAN;
- IP statico o prenotazione DHCP per il PC;
- PC amministratore, 2–4 smartphone/tablet delle governanti, stampante locale opzionale;
- backup giornaliero su USB/NAS locale; UPS per PC, router e AP.

**Installazione offline:** l'app finita funziona senza connessione. La build/aggiornamento iniziale si prepara su un computer con internet (`npm ci`, `prisma generate`, `npm run build`) e poi si trasferisce l'app con `node_modules` e `.next` (o un pacchetto offline). Il pacchetto sorgente richiede npm; per un'installazione completamente isolata usare il pacchetto offline.

---

# Deutsch

**Die fertige Hotel-App läuft ohne Internet, ohne neuronale Netze/KI und auf dem lokalen Computer des Hotels.** Alle Daten liegen in lokalem SQLite; 1C ist optional und nur lokal. Cloud, Telemetrie und externe APIs sind nicht erforderlich.

## Mindestanforderungen

| Komponente | Minimum | Empfohlen |
|---|---|---|
| PC | x86-64, 4 Kerne | 6 Kerne / Intel i5 oder ähnlich |
| RAM | 8 GB | 16 GB |
| Datenträger | 128 GB SSD | 256–512 GB SSD |
| OS | Windows 11 Pro 64 Bit | Windows 11 Pro + Updates |
| Netzwerk | 1-Gbit-Ethernet | 1-Gbit-Ethernet + statische IP/DHCP-Reservierung |
| Strom | Netzstrom | USV 600–1000 VA für PC/Router/AP |
| Software | Node.js 24 LTS, SQLite, aktuelles Chrome/Edge/Safari | + lokaler Virenschutz und tägliches Backup |

## Infrastruktur für 10 Zimmer

- ein Hotel-PC mit App und SQLite;
- ein Gigabit-Router/Switch;
- ein Wi-Fi-5/6-Access-Point mit kabelgebundenem Uplink (zwei bei Betonwänden);
- separates Mitarbeiter-SSID mit WPA2/WPA3 und möglichst VLAN;
- statische IP oder DHCP-Reservierung für den Hotel-PC;
- Admin-PC, 2–4 Smartphones/Tablets der Zimmermädchen, optional lokaler Drucker;
- tägliches Backup auf USB/NAS; USV für PC, Router und AP.

**Offline-Installation:** Die fertige App läuft ohne Internet. Build/Update werden vorab auf einem internetfähigen Computer erstellt (`npm ci`, `prisma generate`, `npm run build`) und dann mit `node_modules` und `.next` (oder als Offline-Paket) ins Hotel übertragen. Das Quell-ZIP benötigt npm-Registry-Zugriff; für eine vollständig getrennte Installation das Offline-Paket verwenden.
