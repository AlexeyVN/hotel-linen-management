#requires -Version 5.1
<#
  Интерактивный установщик «Белая пристань» для Windows + Open Server Panel.
  Запуск: install.cmd (из корня архива).
  Сценарий ничего не делает молча: каждый шаг подтверждается пользователем.
#>

param(
  [switch]$Check
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LogPath = Join-Path $ProjectRoot "install.log"
$script:StepNumber = 0
$script:Started = $false

function Write-Header {
  param([string]$Text)
  $script:StepNumber++
  Write-Host ""
  Write-Host ("=" * 72) -ForegroundColor DarkCyan
  Write-Host ("ШАГ " + $script:StepNumber + ". " + $Text) -ForegroundColor Cyan
  Write-Host ("=" * 72) -ForegroundColor DarkCyan
}

function Ask-Text {
  param([string]$Question, [string]$Default = "")
  if ($Default) {
    $value = Read-Host ($Question + " [" + $Default + "]")
  } else {
    $value = Read-Host $Question
  }
  if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
  return $value.Trim()
}

function Ask-YesNo {
  param([string]$Question, [bool]$Default = $true)
  if ($Default) {
    $suffix = " [Y/n]"
  } else {
    $suffix = " [y/N]"
  }
  while ($true) {
    $answer = Read-Host ($Question + $suffix)
    if ([string]::IsNullOrWhiteSpace($answer)) { return $Default }
    switch ($answer.Trim().ToLowerInvariant()) {
      "y" { return $true }
      "yes" { return $true }
      "д" { return $true }
      "да" { return $true }
      "n" { return $false }
      "no" { return $false }
      "н" { return $false }
      "нет" { return $false }
      default { Write-Host "Ответьте Y (да) или N (нет)." -ForegroundColor Yellow }
    }
  }
}

function Pause-Step {
  param([string]$Message = "Нажмите Enter, чтобы продолжить...")
  [void](Read-Host $Message)
}

function Run-Command {
  param(
    [string]$Title,
    [string]$File,
    [string[]]$Arguments,
    [string]$WorkingDirectory
  )
  Write-Host ""
  Write-Host ("→ " + $Title) -ForegroundColor Yellow
  Push-Location $WorkingDirectory
  try {
    & $File @Arguments
    $code = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  if ($code -ne 0) {
    throw ("Команда завершилась с ошибкой (код " + $code + "): " + $File + " " + ($Arguments -join " "))
  }
}

function Set-EnvValue {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Value
  )
  $lines = @(Get-Content -LiteralPath $Path -Encoding UTF8)
  $found = $false
  $result = New-Object System.Collections.Generic.List[string]
  foreach ($line in $lines) {
    if ($line -match ("^" + [regex]::Escape($Key) + "=")) {
      $result.Add($Key + '="' + $Value + '"')
      $found = $true
    } else {
      $result.Add($line)
    }
  }
  if (-not $found) { $result.Add($Key + '="' + $Value + '"') }
  $text = ($result -join "`r`n") + "`r`n"
  [IO.File]::WriteAllText($Path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

function Test-Node {
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $node -or -not $npm) { return $false }
  return $true
}

function Test-Port3000 {
  $connection = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  return [bool]$connection
}

function Copy-ProjectFiles {
  param([string]$Source, [string]$Target)
  New-Item -ItemType Directory -Path $Target -Force | Out-Null
  $excludeDirs = @(
    (Join-Path $Source "app\node_modules"),
    (Join-Path $Source "app\.next"),
    (Join-Path $Source "app\.playwright-browsers"),
    (Join-Path $Source "app\screenshots"),
    (Join-Path $Source "app\.tmp"),
    (Join-Path $Source "app\data"),
    (Join-Path $Source "app\storage"),
    (Join-Path $Source "app\logs"),
    (Join-Path $Source "app\backups"),
    (Join-Path $Source "app\.npm-cache")
  )
  $arguments = @($Source, $Target, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/R:1", "/W:1")
  foreach ($dir in $excludeDirs) { $arguments += @("/XD", $dir) }
  $arguments += @("/XF", ".env", "install.log", "*.db", "*.db-journal", "*.db-wal", "*.db-shm", "*.sqlite", "*.sqlite3")
  & robocopy @arguments | Out-Host
  if ($LASTEXITCODE -ge 8) { throw "Не удалось скопировать файлы проекта." }
}

try {
  if (-not $Check) {
    try {
      Start-Transcript -LiteralPath $LogPath -Append | Out-Null
      $script:Started = $true
    } catch {
      Write-Host "Не удалось начать лог установки; продолжаю без него." -ForegroundColor Yellow
    }
  }

  Clear-Host
  Write-Host "============================================================" -ForegroundColor DarkCyan
  Write-Host "  БЕЛАЯ ПРИСТАНЬ — установка на Windows + Open Server Panel" -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor DarkCyan
  Write-Host ""
  Write-Host "Скрипт проведёт по шагам и будет спрашивать перед каждым действием." -ForegroundColor Gray
  Write-Host "Можно прервать в любой момент: Ctrl+C." -ForegroundColor Gray
  Write-Host ""

  $isAdmin = $false
  try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    $isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  } catch { }

  Write-Header "Проверка прав и окружения"
  if ($isAdmin) {
    Write-Host "Права администратора: есть." -ForegroundColor Green
  } elseif ($Check) {
    Write-Host "Права администратора: нет (для проверки окружения это не блокирует)." -ForegroundColor Yellow
  } else {
    Write-Host "Права администратора: НЕТ." -ForegroundColor Yellow
    Write-Host "Для создания junction-ссылок и правил брандмауэра нужен администратор." -ForegroundColor Yellow
    if (-not (Ask-YesNo "Продолжить без прав администратора?" $false)) {
      Write-Host "Запустите install.cmd от имени администратора." -ForegroundColor Yellow
      exit 1
    }
  }

  if (-not (Test-Node)) {
    if ($Check) {
      Write-Host "Node.js не найден. Установите Node.js 24 LTS и повторите проверку." -ForegroundColor Red
      exit 1
    }
    Write-Host ""
    Write-Host "Node.js не найден." -ForegroundColor Yellow
    Write-Host "Открою страницу загрузки Node.js 24 LTS. Установите его с настройками по умолчанию." -ForegroundColor Yellow
    Start-Process "https://nodejs.org/en/download"
    Pause-Step "После установки Node.js нажмите Enter, чтобы проверить снова..."
    if (-not (Test-Node)) {
      throw "Node.js не найден в PATH. Перезапустите компьютер и запустите install.cmd снова."
    }
  }
  Write-Host ("Node.js: " + (& node -v).Trim()) -ForegroundColor Green
  Write-Host ("npm: " + (& npm.cmd -v).Trim()) -ForegroundColor Green

  if ($Check) {
    Write-Host ""
    Write-Host "Проверка окружения завершена. Установка не выполнялась." -ForegroundColor Green
    exit 0
  }

  Write-Header "Где находится Open Server Panel"
  $osPanel = Ask-Text "Папка Open Server Panel" "C:\OSPanel"
  if (-not (Test-Path -LiteralPath $osPanel)) {
    throw ("Папка OSPanel не найдена: " + $osPanel + ". Установите OSPanel и запустите скрипт снова.")
  }
  $defaultTarget = Join-Path $osPanel "home\hotel"
  Write-Host ("Папка OSPanel: " + $osPanel) -ForegroundColor Green

  Write-Header "Куда установить проект"
  $target = Ask-Text "Папка установки" $defaultTarget
  $target = [IO.Path]::GetFullPath($target)
  $source = [IO.Path]::GetFullPath($ProjectRoot)

  if ($source -ne $target) {
    Write-Host ""
    Write-Host ("Проект будет скопирован из: " + $source) -ForegroundColor Gray
    Write-Host ("в:                        " + $target) -ForegroundColor Gray
    Write-Host "Существующие .env, база, фото и backup в целевой папке не перезаписываются." -ForegroundColor Gray
    if (-not (Ask-YesNo "Скопировать файлы проекта?" $true)) {
      throw "Установка отменена пользователем."
    }
    Copy-ProjectFiles -Source $source -Target $target
    $ProjectRoot = $target
  } else {
    Write-Host "Проект уже находится в целевой папке; копирование не нужно." -ForegroundColor Green
  }

  $appDir = Join-Path $ProjectRoot "app"
  if (-not (Test-Path -LiteralPath (Join-Path $appDir "package.json"))) {
    throw ("В папке установки нет app\package.json: " + $ProjectRoot)
  }

  Write-Header "Настройки .env"
  $envPath = Join-Path $appDir ".env"
  $envExample = Join-Path $appDir ".env.example"
  if (-not (Test-Path -LiteralPath $envExample)) {
    throw "Не найден app\.env.example. Архив повреждён или неполный."
  }

  if (Test-Path -LiteralPath $envPath) {
    Write-Host "Файл .env уже существует — он будет сохранён." -ForegroundColor Green
    $envText = Get-Content -LiteralPath $envPath -Raw -Encoding UTF8
    if ($envText -notmatch 'NEXTAUTH_SECRET="[^"]+"') {
      Write-Host "В .env нет секрета. Добавлю новый NEXTAUTH_SECRET." -ForegroundColor Yellow
      $secret = (& node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))").Trim()
      Set-EnvValue -Path $envPath -Key "NEXTAUTH_SECRET" -Value $secret
    }
    $publicUrl = "http://localhost:3000"
    if ($envText -match 'NEXTAUTH_URL="([^"]*)"') { $publicUrl = $Matches[1] }
  } else {
    Copy-Item -LiteralPath $envExample -Destination $envPath
    $secret = (& node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))").Trim()
    $publicUrl = Ask-Text "Адрес, по которому будете открывать систему" "http://localhost:3000"
    Set-EnvValue -Path $envPath -Key "NEXTAUTH_SECRET" -Value $secret
    Set-EnvValue -Path $envPath -Key "NEXTAUTH_URL" -Value $publicUrl
    Set-EnvValue -Path $envPath -Key "DATABASE_URL" -Value "file:../data/app.db"
    Write-Host "Создан app\.env. Секрет сгенерирован." -ForegroundColor Green
  }

  Write-Host ""
  Write-Host "Сейчас будет установка зависимостей. Это может занять несколько минут." -ForegroundColor Gray
  if (-not (Ask-YesNo "Начать npm ci?" $true)) {
    throw "Установка отменена пользователем."
  }
  Run-Command -Title "npm ci" -File "npm.cmd" -Arguments @("ci") -WorkingDirectory $appDir

  Write-Header "База данных"
  $dbPath = Join-Path $appDir "data\app.db"
  $freshDatabase = -not (Test-Path -LiteralPath $dbPath)
  Write-Host ("База данных: " + $(if ($freshDatabase) { "будет создана с нуля" } else { "существующая, данные сохраняются" })) -ForegroundColor Gray

  Run-Command -Title "Prisma generate" -File "npx.cmd" -Arguments @("prisma", "generate") -WorkingDirectory $appDir

  if (-not (Ask-YesNo "Применить миграции базы данных?" $true)) {
    throw "Установка отменена пользователем перед миграциями."
  }
  Run-Command -Title "Prisma migrate deploy" -File "npx.cmd" -Arguments @("prisma", "migrate", "deploy") -WorkingDirectory $appDir

  if ($freshDatabase) {
    if (Ask-YesNo "Заполнить базу демонстрационными данными (10 номеров, пользователи, склад)?" $true) {
      Run-Command -Title "Prisma db seed" -File "npx.cmd" -Arguments @("prisma", "db", "seed") -WorkingDirectory $appDir
    }
  } else {
    Write-Host "Seed пропущен: существующая база не должна получать демо-данные." -ForegroundColor Yellow
  }

  Write-Header "Сборка приложения"
  if (-not (Ask-YesNo "Собрать production-версию (npm run build)?" $true)) {
    throw "Установка отменена перед сборкой."
  }
  Run-Command -Title "npm run build" -File "npm.cmd" -Arguments @("run", "build") -WorkingDirectory $appDir

  Write-Header "Статические файлы для OSPanel"
  Write-Host "OSPanel/Apache отдаёт .js/.css/.png из DocumentRoot, а не через Node." -ForegroundColor Gray
  Write-Host "Создадим ссылки _next, icons и обновим sw.js." -ForegroundColor Gray

  $nextLink = Join-Path $ProjectRoot "_next"
  $nextTarget = Join-Path $appDir ".next"
  if (-not (Test-Path -LiteralPath $nextLink)) {
    New-Item -ItemType Junction -Path $nextLink -Target $nextTarget | Out-Null
    Write-Host "Создана ссылка _next." -ForegroundColor Green
  } else {
    Write-Host "_next уже существует — пропускаю." -ForegroundColor Yellow
  }

  $iconsLink = Join-Path $ProjectRoot "icons"
  $iconsTarget = Join-Path $appDir "public\icons"
  if (-not (Test-Path -LiteralPath $iconsLink)) {
    New-Item -ItemType Junction -Path $iconsLink -Target $iconsTarget | Out-Null
    Write-Host "Создана ссылка icons." -ForegroundColor Green
  } else {
    Write-Host "icons уже существует — пропускаю." -ForegroundColor Yellow
  }

  Copy-Item -LiteralPath (Join-Path $appDir "public\sw.js") -Destination (Join-Path $ProjectRoot "sw.js") -Force
  $oldManifest = Join-Path $ProjectRoot "manifest.webmanifest"
  if (Test-Path -LiteralPath $oldManifest) {
    Remove-Item -LiteralPath $oldManifest -Force
    Write-Host "Удалён устаревший статический manifest.webmanifest." -ForegroundColor Green
  }
  Write-Host "sw.js обновлён; manifest — динамический /api/manifest." -ForegroundColor Green

  Write-Header "Домен в Open Server Panel"
  $domain = Ask-Text "Имя локального домена" "hotel"
  Write-Host ""
  Write-Host "Откройте OSPanel и настройте домен:" -ForegroundColor Yellow
  Write-Host ("  1. Домен: " + $domain + " (например, " + $domain + ".local)")
  Write-Host ("  2. Корневая папка: " + $ProjectRoot)
  Write-Host "  3. Включите HTTPS, если нужна установка PWA на телефон."
  Write-Host "  4. Включите backend/proxy на 127.0.0.1:3000."
  Write-Host ""
  Write-Host "Для Apache в конфигурации домена:" -ForegroundColor Gray
  Write-Host "  ProxyPreserveHost On"
  Write-Host "  ProxyPass        / http://127.0.0.1:3000/ retry=0"
  Write-Host "  ProxyPassReverse / http://127.0.0.1:3000/"
  Write-Host ""
  Pause-Step "После настройки домена нажмите Enter..."

  $newUrl = Ask-Text "Адрес системы (Enter — оставить текущий)" $publicUrl
  if ($newUrl -ne $publicUrl) {
    Set-EnvValue -Path $envPath -Key "NEXTAUTH_URL" -Value $newUrl
    $publicUrl = $newUrl
    Write-Host "NEXTAUTH_URL обновлён." -ForegroundColor Green
  }

  Write-Header "Запуск приложения"
  if (Test-Port3000) {
    Write-Host "Порт 3000 уже занят." -ForegroundColor Yellow
    Write-Host "Остановите старый Node-процесс, иначе новый не запустится." -ForegroundColor Yellow
    Pause-Step "После освобождения порта нажмите Enter..."
  } else {
    if (Ask-YesNo "Запустить приложение сейчас в фоне?" $true) {
      $logDir = Join-Path $appDir "logs"
      New-Item -ItemType Directory -Path $logDir -Force | Out-Null
      $serverLog = Join-Path $logDir "server.log"
      $startCmd = Join-Path $ProjectRoot "deploy\start.cmd"
      Start-Process -FilePath "cmd.exe" -ArgumentList "/c", ('"' + $startCmd + '" > "' + $serverLog + '" 2>&1') -WorkingDirectory $ProjectRoot -WindowStyle Hidden
      Write-Host "Сервер запускается в фоне..." -ForegroundColor Gray
      Start-Sleep -Seconds 4
      if (Test-Port3000) {
        Write-Host "Сервер слушает порт 3000." -ForegroundColor Green
      } else {
        Write-Host "Сервер ещё не ответил. Проверьте лог:" -ForegroundColor Yellow
        Write-Host ("  " + $serverLog)
      }
    }
  }

  Write-Header "Готово"
  Write-Host "Откройте систему:" -ForegroundColor Green
  Write-Host ("  " + $publicUrl) -ForegroundColor Cyan
  Write-Host ""
  Write-Host "Первый вход: admin / Admin123!" -ForegroundColor Yellow
  Write-Host "Сразу смените пароли в «Настройки → Пользователи»." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Полезные файлы:" -ForegroundColor Gray
  Write-Host ("  Инструкция: " + (Join-Path $ProjectRoot "docs\INSTALL-OPEN-SERVER.md"))
  Write-Host ("  Лог сервера: " + (Join-Path $appDir "logs\server.log"))
  Write-Host ("  Лог установки: " + $LogPath)
  Write-Host ""
  Write-Host "Резервная копия: deploy\backup.cmd" -ForegroundColor Gray
  Write-Host "Остановка: Ctrl+C в окне сервера или завершите Node-процесс." -ForegroundColor Gray
  Write-Host ""
  Pause-Step "Нажмите Enter, чтобы закрыть установщик..."
} catch {
  Write-Host ""
  Write-Host "УСТАНОВКА ОСТАНОВЛЕНА" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host ""
  Write-Host ("Подробности: " + $LogPath) -ForegroundColor Yellow
  Write-Host "Исправьте ошибку и запустите install.cmd снова." -ForegroundColor Yellow
  Pause-Step "Нажмите Enter..."
  exit 1
} finally {
  if ($script:Started) {
    try { Stop-Transcript | Out-Null } catch { }
  }
}
