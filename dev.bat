@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

echo ============================================
echo   my-toolbox
echo ============================================
echo.

:: 1. Kill stale processes from previous session


:: 2. Install dependencies


:: 3. Ensure artifacts directory exists


:: 4. Start Tauri dev
echo [4/4] Starting Tauri dev server...
echo.
set DISABLE_HMR=true
call npx tauri dev

pause
