@echo off
setlocal
rem Restore the SQLite database from a backup created by backup.cmd (VACUUM INTO).
rem Usage: restore.cmd <backup-file.db>
rem The Node server must be stopped first.
set "APP=%~dp0..\app"
set "SQLITE=C:\OSPanel\bin\sqlite3.exe"
if "%~1"=="" (
  echo Usage: restore.cmd ^<backup-file.db^>
  exit /b 1
)
if not exist "%~1" (
  echo Backup not found: %~1
  exit /b 1
)
if not exist "%SQLITE%" (
  echo sqlite3.exe not found: %SQLITE%
  exit /b 1
)
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if not errorlevel 1 (
  echo The Node server is running - stop it before restore.
  exit /b 1
)
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%i"
if not exist "%APP%\backups" mkdir "%APP%\backups"
copy /Y "%APP%\data\app.db" "%APP%\backups\pre-restore-%STAMP%.db" >nul
copy /Y "%~1" "%APP%\data\app.db" >nul
if errorlevel 1 (
  echo Failed to copy the backup into place
  exit /b 1
)
echo Integrity check:
"%SQLITE%" "%APP%\data\app.db" "PRAGMA integrity_check;"
echo Restore finished. Previous database saved as backups\pre-restore-%STAMP%.db
