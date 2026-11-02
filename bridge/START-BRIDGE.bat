@echo off
chcp 65001 >nul
title Cau Noi TikTok Live - Chua Linh Ung Online
cd /d "%~dp0"

echo ============================================================
echo   CAU NOI TIKTOK LIVE  --  Chua Linh Ung Online
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] Chua cai Node.js.
  echo Tai tai: https://nodejs.org  ^(chon ban LTS^) roi chay lai file nay.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    copy ".env.example" ".env" >nul
    echo [!] Da tao file .env tu mau.
    echo     Hay mo file .env dien TIKTOK_USER / VPS_RPC_URL / RPC_TOKEN roi chay lai.
    echo.
    notepad ".env"
    pause
    exit /b 1
  )
)

if not exist "node_modules" (
  echo [*] Lan dau chay - dang cai thu vien, vui long doi...
  call npm install
  if errorlevel 1 (
    echo [LOI] Cai thu vien that bai. Kiem tra ket noi mang.
    pause
    exit /b 1
  )
  echo.
)

echo [*] Dang khoi chay cau noi... (Nhan Ctrl+C de dung)
echo.

:restart
node bridge.js
echo.
echo [!] Cau noi da dung. Tu khoi chay lai sau 10 giay... (Ctrl+C de thoat)
timeout /t 10 >nul
goto restart
