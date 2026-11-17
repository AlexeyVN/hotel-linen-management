@echo off
setlocal
rem SQLite backup via VACUUM INTO (copying the .db file with WAL enabled is unsafe).
set "APP=%~dp0..\app"
set "SQLITE=C:\OSPanel\bin\sqlite3.exe"
if not exist "%SQLITE%" (
  echo sqlite3.exe not found: %SQLITE%
  exit /b 1
)
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%i"
if not exist "%APP%\backups" mkdir "%APP%\backups"
"%SQLITE%" "%APP%\data\app.db" "VACUUM INTO '%APP%\backups\app-%STAMP%.db'"
if errorlevel 1 (
  echo Backup failed
  exit /b 1
)
echo Backup created: %APP%\backups\app-%STAMP%.db
