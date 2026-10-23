@echo off
rem Linework: sends a quick over-the-air update to the TestFlight app (production channel).
rem Use it for text, layout, screens, templates and translations. See docs\RELEASING.md.
rem Native changes (permissions, icon, new native packages, version bump) need a new build instead.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org then run this again.
  pause
  exit /b 1
)
echo.
set "NOTE="
set /p NOTE=Short note for this update: 
if "%NOTE%"=="" set "NOTE=Linework update"
set "NOTE=%NOTE:"=%"
echo.
echo Sending the update to the production channel. This takes a few minutes...
call npx eas-cli@latest update --channel production --message "%NOTE%"
if errorlevel 1 goto failed
echo.
echo Done. Open Linework on your iPhone, close it fully, then open it again to get the update.
goto end
:failed
echo.
echo The update did not go through. Read the messages above.
echo If it says you are not logged in or the project is not set up, follow the one-time setup in docs\RELEASING.md.
:end
pause
