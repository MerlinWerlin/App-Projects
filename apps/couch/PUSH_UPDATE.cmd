@echo off
setlocal
rem Couch: push an over-the-air (OTA) update with EAS Update.
rem This publishes JavaScript, text, translation and image changes to phones that already run a
rem production / TestFlight build of Couch with the SAME app version ("version" in app.json).
rem Phones download it quietly the next time Couch is opened and use it from the following cold start.
rem Native changes (new native module, permission text, icon, splash, Expo SDK upgrade, version bump)
rem need a new TestFlight build instead. See docs\RELEASING.md.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get the LTS version from https://nodejs.org and run this again.
  pause
  exit /b 1
)

set NOTE=
set /p NOTE=Short note for this update (what changed):
if "%NOTE%"=="" (
  echo No note entered, so nothing was published. Run this again and type a short note.
  pause
  exit /b 1
)

echo.
echo Publishing the update to the production channel...
call npx --yes eas-cli@latest update --channel production --message "%NOTE%"
if errorlevel 1 (
  echo.
  echo The update was NOT published. Read the red text above; if it mentions login, run: npx eas-cli@latest login
) else (
  echo.
  echo Done: the update is published. Phones running the same Couch version get it after opening Couch twice.
)
pause
