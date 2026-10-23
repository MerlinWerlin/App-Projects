@echo off
setlocal
rem Couch PC verification (oversight D65-1): install, typecheck, tests, iOS bundle.
rem Writes verify-report.txt next to this file. Paste it into a comment on the Couch build page.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get the LTS version from https://nodejs.org and run this again.
  echo Node.js missing > "%~dp0verify-report.txt"
  pause
  exit /b 1
)

echo Couch verify: this takes a few minutes. Nothing on your phone is needed.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\verify.ps1"
echo.
echo Done. Open verify-report.txt, copy everything and paste it into a comment on the Couch build page.
pause
