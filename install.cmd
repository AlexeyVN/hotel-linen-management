@echo off
setlocal
chcp 65001 >nul
set "ROOT=%~dp0"

if /i "%~1"=="check" goto check
if /i "%~1"=="-check" goto check

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ROOT%deploy\install.ps1"
set "CODE=%ERRORLEVEL%"
if not "%CODE%"=="0" pause
exit /b %CODE%

:check
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ROOT%deploy\install.ps1" -Check
set "CODE=%ERRORLEVEL%"
exit /b %CODE%
