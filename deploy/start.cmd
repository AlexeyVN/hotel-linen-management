@echo off
rem Start the Next.js service. Spec v2.3 section 13: Node listens on 0.0.0.0:3000,
rem the OSPanel domain proxies to this port (no Document Root).
cd /d "%~dp0..\app"
call npm.cmd run start
