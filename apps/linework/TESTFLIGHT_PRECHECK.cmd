@echo off
rem Linework TestFlight pre-check: run this BEFORE TESTFLIGHT_LINEWORK.cmd.
rem It installs packages, type-checks and makes an iOS export, and writes testflight-precheck.txt.
rem If it fails, paste testflight-precheck.txt into a comment on the Linework Build page.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org then run this again.
  pause
  exit /b 1
)
echo Checking Linework before the TestFlight build. This takes a few minutes...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\testflight-precheck.ps1"
echo.
echo Report saved as testflight-precheck.txt in this folder.
pause
