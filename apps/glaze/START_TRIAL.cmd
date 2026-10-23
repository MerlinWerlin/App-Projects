@echo off
rem Glaze trial kit: runs the app from this PC so you can open it on your iPhone with Expo Go.
rem See docs\TRIAL.md. Safe to run again any time; it only touches this folder.
rem Install and version-fix output is also written to trial-log.txt next to this file.
cd /d "%~dp0"
set LOG=%~dp0trial-log.txt
echo Glaze trial %DATE% %TIME% > "%LOG%"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org then run this again.
  echo Node.js not installed >> "%LOG%"
  pause
  exit /b 1
)
if not exist package.json (
  echo This build has no app code yet. Check the Glaze Build page for progress.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo node %%v >> "%LOG%"
echo Installing packages (first time takes a few minutes)...
call :logged "npm install"
if errorlevel 1 goto failed
echo Matching package versions to the Expo Go app on your phone...
call :logged "npx expo install expo@latest"
call :logged "npx expo install --fix"
echo.
echo Starting Glaze. When the QR code appears, scan it with your iPhone Camera app.
echo (Install "Expo Go" from the App Store first. Press Ctrl+C here to stop.)
echo If red errors appear below, copy this window's text into a build page comment too.
echo --- expo start --go --tunnel (output shown in the window only) >> "%LOG%"
call npx expo start --go --tunnel
goto end

:logged
rem Runs %1, showing its output here and appending it to trial-log.txt.
echo --- %~1 >> "%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "%~1 2>&1 | ForEach-Object { $l = $_.ToString(); Write-Host $l; Add-Content -LiteralPath '%LOG%' -Value $l -Encoding UTF8 }; exit $LASTEXITCODE"
exit /b %errorlevel%

:failed
echo.
echo Something went wrong installing packages.
echo Open trial-log.txt in this folder and paste its contents into a Glaze Build page comment.
:end
pause
