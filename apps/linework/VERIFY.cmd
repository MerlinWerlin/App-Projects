@echo off
rem Linework PC check: installs packages, checks the code, runs the tests and builds an iOS export.
rem It writes verify-report.txt next to this file. Paste that report into a comment on the Linework Build page.
rem Safe to run again any time; it only touches this folder (.verify and .verify-logs are scratch).
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org then run this again.
  pause
  exit /b 1
)
echo Checking Linework on this PC. This takes a few minutes...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\verify.ps1"
echo.
echo Report saved as verify-report.txt in this folder.
pause
