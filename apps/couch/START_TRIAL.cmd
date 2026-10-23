@echo off
setlocal
rem Couch trial: installs, aligns Expo to the version Expo Go supports, starts a tunnel.
rem Everything is also written to trial-log.txt next to this file.
cd /d "%~dp0"
set LOG=%~dp0trial-log.txt
echo Couch trial started %DATE% %TIME% > "%LOG%"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get the LTS version from https://nodejs.org and run this again.
  echo Node.js missing >> "%LOG%"
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node --version') do echo Node %%v
node --version >> "%LOG%"

echo.
echo [1/4] Installing packages (first time takes a few minutes)...
powershell -NoProfile -Command "npm install 2>&1 | Tee-Object -FilePath '%LOG%' -Append"

echo.
echo [2/4] Updating Expo to the latest SDK (Expo Go on the App Store only opens the latest)...
powershell -NoProfile -Command "npx --yes expo install expo@latest 2>&1 | Tee-Object -FilePath '%LOG%' -Append"

echo.
echo [3/4] Aligning package versions with that SDK...
powershell -NoProfile -Command "npx --yes expo install --fix 2>&1 | Tee-Object -FilePath '%LOG%' -Append"

echo.
echo [4/4] Starting Couch for Expo Go. Scan the QR code with your iPhone camera.
echo If anything is red, paste trial-log.txt (and a photo of this window) into a comment on the Couch build page.
echo Starting expo (output stays on screen so the QR code and key menu work) >> "%LOG%"
call npx expo start --go --tunnel
echo expo start exited with code %ERRORLEVEL% >> "%LOG%"

pause
