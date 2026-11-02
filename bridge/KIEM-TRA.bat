@echo off
chcp 65001 >nul
title Kiem Tra Duong Day - Chua Linh Ung Online
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] Chua cai Node.js. Tai ban LTS tai https://nodejs.org roi chay lai.
  echo.
  pause
  exit /b 1
)

node check-setup.js
echo.
pause
