@echo off
rem Linework trial kit: runs the app from this PC so you can open it on your iPhone with Expo Go.
rem See docs\TRIAL.md. Safe to run again any time; it only touches this folder.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org then run this again.
  pause
  exit /b 1
)
if not exist package.json (
  echo This build has no app code yet. Check the Linework Build page for progress.
  pause
  exit /b 1
)
echo Installing packages (first time takes a few minutes)...
call npm install
if errorlevel 1 goto failed
echo Matching package versions to the Expo Go app on your phone...
call npx expo install --fix
echo.
echo Starting Linework. When the QR code appears, scan it with your iPhone Camera app.
echo (Install "Expo Go" from the App Store first. Press Ctrl+C here to stop.)
call npx expo start --go --tunnel
goto end
:failed
echo Something went wrong installing packages. Copy the messages above into the build page comments.
:end
pause
