# Публикация на GitHub

Пошаговая подготовка репозитория: состав, секреты, CI, лицензия, первый push и релиз.

---

## 1. Карточка репозитория

**Название:** `hotel-linen-management`
**Бренд:** «Белая пристань» / White Harbor
**Версия:** `v2.2.0` (M1–M14 + 1С-статусы + гибкие номера, ТЗ v3.2)
**Лицензия:** Apache License 2.0 (`LICENSE`, `NOTICE`)
**Автор идеи:** Vlasevskii Aleksei Nikolaevich
**Разработчик:** DeepSeek Harness (AI-разработчик)
**About:**
> Учёт белья и инвентаря отеля «Белая пристань»: склад, инвентаризация с фото, QR, Excel, 1С (номенклатура и статусы номеров), гибкие номера и типы, PWA горничной, чек-листы, навигация и брендинг.

**Topics:** `hotel`, `housekeeping`, `linen`, `inventory`, `nextjs`, `typescript`, `prisma`, `sqlite`, `trpc`, `pwa`, `playwright`, `exceljs`, `apache-2.0`.

**Стек:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind, tRPC v11, Prisma 6 + SQLite, next-auth v4, PWA, ExcelJS, Playwright.

---

## 2. Структура репозитория

```
hotel-linen-management/
├── README.md
├── LICENSE
├── NOTICE
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
├── install.cmd
├── .gitignore
├── .gitattributes
├── .github/
│   ├── workflows/ci.yml
│   ├── dependabot.yml
│   ├── pull_request_template.md
│   └── ISSUE_TEMPLATE/
├── app/                      # приложение
│   ├── package.json / package-lock.json
│   ├── .env.example
│   ├── prisma/               # schema, migrations, seed
│   ├── src/
│   ├── scripts/              # Playwright, mock 1С, иконки
│   └── tests/
├── brand/                    # «Белая пристань»: SVG/PNG, lockup, PWA-иконки
├── deploy/                   # start/backup/restore + install.ps1 + Windows-заметки
└── docs/
    ├── DEPLOYMENT.md
    ├── INSTALL-OPEN-SERVER.md
    ├── OPERATIONS.md
    ├── CONFIGURATION.md
    ├── GITHUB.md
    ├── README.md
    ├── hotel-linen-TZ-v3.2.md
    ├── plan-*.md
    └── screenshots/
```

`app/package.json` — манифест приложения; CI работает с `working-directory: app`.

---

## 3. Что коммитить

- `app/src/`, `app/prisma/`, `app/scripts/`, `app/tests/`, `app/public/`.
- `install.cmd`, `deploy/install.ps1` — интерактивная установка Windows/OSPanel.
- `app/package.json`, `app/package-lock.json`, конфиги Next/Tailwind/TS/PostCSS.
- `app/.env.example` — только шаблон.
- `brand/` — логотип, lockup, палитра, PWA-иконки.
- `deploy/`, `docs/` (ТЗ, планы, скриншоты, инструкции).
- `README.md`, `LICENSE`, `NOTICE`, `CHANGELOG.md`, `SECURITY.md`, `.gitignore`, `.github/`.

## 4. Что исключить

| Исключается | Причина |
|---|---|
| `.env`, `.env.local` | секреты |
| `app/data/*.db*` | локальная/реальная БД |
| `app/storage/` | фото, QR, логотип |
| `app/backups/`, `app/logs/`, `app/screenshots/`, `app/.tmp/` | артефакты |
| `node_modules/`, `.next/`, `.npm-cache/`, `.playwright-browsers/` | зависимости/сборка |
| `next-env.d.ts`, `*.tsbuildinfo` | генерируется |
| `*.log` | отладочные логи |

Витринные изображения для README лежат в `docs/screenshots/` и **коммитятся**.

---

## 5. Проверка перед push

```bash
cd hotel-linen-management

# секреты и ключи (Linux/macOS)
grep -RIn --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.playwright-browsers \
  -E "NEXTAUTH_SECRET=|BEGIN (RSA|OPENSSH|PRIVATE)|password\s*=|token\s*=" . | head -50

# артефакты
find . -maxdepth 4 \( -name node_modules -o -name .next -o -name "*.db" -o -name ".env" \) -print
```

PowerShell (Windows):

```powershell
Get-ChildItem -Recurse -File -Force |
  Where-Object { $_.FullName -notmatch '\\(node_modules|\.next|\.playwright-browsers)\\' } |
  Select-String -Pattern "NEXTAUTH_SECRET=|BEGIN PRIVATE KEY|password\s*=|token\s*=" |
  Select-Object -First 50
Get-ChildItem -Recurse -Force -Include .env,*.db,node_modules,.next | Select-Object FullName
```

Обязательные проверки:

```bash
cd app
npm ci
npm test          # 88/88
npm run build
```

Демо-пароли в README (`Admin123!` и т.д.) — **не секреты**, но при публичном репозитории обязательно предупредите о смене при развёртывании.

---

## 6. Первый push

В текущей среде Git **установлен** (2.56.1, user-scope). Локальный репозиторий проекта уже инициализирован, ветка `main`, первый коммит создан. Осталось создать пустой репозиторий на GitHub и добавить remote.

GitHub CLI не установлен. Создайте пустой репозиторий через веб-интерфейс GitHub: **без README, LICENSE и .gitignore** (иначе первый push потребует merge).

```bash
cd hotel-linen-management

git status --short          # глазами: нет .env, *.db, node_modules
git remote add origin https://github.com/<OWNER>/<REPO>.git
git push -u origin main
```

При первом push Git Credential Manager откроет браузер для входа в GitHub. Пароль от GitHub в терминале вводить не нужно.

Если репозиторий ещё не инициализирован (например, на другой машине):

```bash
git init -b main
git add .
git commit -m "Release v2.2.0"
git remote add origin https://github.com/<OWNER>/<REPO>.git
git push -u origin main
```

GitHub CLI:

```bash
gh repo create <OWNER>/<REPO> --private --source=. --remote=origin --push
```

Перед публикацией решите, будет репозиторий приватным или публичным. При публичном — проверьте лицензию и отсутствие реальных данных.

---

## 7. Настройки GitHub

1. **About** — описание и topics из §1.
2. **Actions → General** — разрешить Actions (CI уже в `.github/workflows/ci.yml`).
3. **Code security** — Dependabot alerts, secret scanning, push protection; конфиг обновлений — `.github/dependabot.yml` (npm + actions).
4. **Branches** — защитить `main`: PR + прохождение CI.
5. **Environments** — не требуются: CI использует фиктивные переменные.
6. **Releases** — после стабилизации тег `v2.2.0`.

Бейдж CI (замените `<OWNER>/<REPO>`):

```markdown
[![CI](https://github.com/<OWNER>/<REPO>/actions/workflows/ci.yml/badge.svg)](https://github.com/<OWNER>/<REPO>/actions/workflows/ci.yml)
```

---

## 8. CI

`.github/workflows/ci.yml`:

- Ubuntu, Node 24, кэш npm по `app/package-lock.json`;
- `npm ci` → `prisma generate` → `prisma migrate deploy` на пустой SQLite → `npm test` → `npm run build`;
- фиктивные `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`;
- секреты не нужны.

Если CI упадёт на БД — проверьте `mkdir -p data` и `DATABASE_URL=file:../data/ci.db`.

Деплой из GitHub Actions **не настроен**: развёртывание описано в [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 9. Лицензия

Проект распространяется по **Apache License, Version 2.0**:

- [LICENSE](../LICENSE) — полный текст;
- [NOTICE](../NOTICE) — Copyright 2026 Vlasevskii Aleksei Nikolaevich и авторство идеи;
- `app/package.json` — `"license": "Apache-2.0"`;
- README — раздел «Лицензия».

При распространении сохраняйте `LICENSE` и `NOTICE`, а изменённые файлы отмечайте. Сторонние npm-зависимости сохраняют свои лицензии; перед публикацией можно проверить их перечень через `npm ls --all`.

Apache 2.0 выбран за патентную оговорку и совместимость с открытым использованием. Юридические вопросы — к владельцу проекта.

---

## 10. Секреты

- `NEXTAUTH_SECRET` — только `.env`/секреты CI/CD.
- Пароль 1С хранится в БД зашифрованным (AES-256-GCM, ключ из `NEXTAUTH_SECRET`); не публикуйте дампы БД.
- `INTEGRATION_WORKER_TOKEN` — только в окружении.
- Production: HTTPS, `NEXTAUTH_URL`, смена демо-паролей.
- Если секрет попал в git — смените его и очистите историю (`git filter-repo`), одного удаления файла недостаточно.

---

## 11. Релизный чек-лист

- [ ] `npm test` — 88/88, `npm run build` — успешно, CI зелёный
- [ ] `.env`, `*.db`, `node_modules`, `storage/` не в индексе
- [ ] README: версия, быстрый старт, демо-учётки, ТЗ, скриншоты, ссылки на docs
- [ ] Пошаговая инструкция `docs/INSTALL-OPEN-SERVER.md` проверена на чистой установке
- [x] `install.cmd` проверен в режиме `install.cmd check`
- [ ] `CHANGELOG.md` обновлён
- [x] лицензия Apache-2.0: `LICENSE`, `NOTICE`, `package.json`
- [x] бренд «Белая пристань»: `brand/`, PWA-иконки, название в приложении
- [ ] в GitHub указаны автор идеи (Vlasevskii Aleksei Nikolaevich) и разработчик (DeepSeek Harness)
- [ ] CI badge заменён на реальный URL
- [ ] тег `v2.2.0` и GitHub Release
- [ ] проверено развёртывание по [DEPLOYMENT.md](DEPLOYMENT.md)
