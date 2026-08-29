@echo off
setlocal

rem Double-click this file to start the Tauri development app.
cd /d "%~dp0"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Please install Node.js first.
  pause
  exit /b 1
)

call npm.cmd run tauri:dev
set "exit_code=%errorlevel%"

echo.
if "%exit_code%"=="0" (
  echo The development app has closed.
) else (
  echo The development app exited with code %exit_code%.
)
pause
exit /b %exit_code%
