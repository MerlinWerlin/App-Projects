@echo off
rem Glaze: send a JS-only fix to the TestFlight / App Store build over the air (EAS Update).
rem See docs\RELEASING.md first. Changes to native code, permissions, icon or splash need a new build instead.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org then run this again.
  pause
  exit /b 1
)
set NOTE=
set /p NOTE=Short note for this update:
if "%NOTE%"=="" set NOTE=Glaze update
echo.
echo Publishing "%NOTE%" to the production channel...
call npx eas-cli@latest update --channel production --message "%NOTE%"
echo.
echo Done. Phones get it the next time Glaze is opened (or via Settings, Check for updates).
pause
