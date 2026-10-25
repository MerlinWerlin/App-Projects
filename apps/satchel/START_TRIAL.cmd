@echo off
rem Satchel trial kit: runs the app from this PC so you can open it on your iPhone with Expo Go.
rem See docs\TRIAL.md. Safe to run again any time; it only touches this folder.
rem Everything the install steps print is also saved to trial-log.txt next to this file.
cd /d "%~dp0"
set "LOG=%~dp0trial-log.txt"
> "%LOG%" echo Satchel trial log, %date% %time%
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org then run this again.
  >> "%LOG%" echo Node.js not installed.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do >> "%LOG%" echo node %%v
if not exist package.json (
  echo This build has no app code yet. Check the Satchel Build page for progress.
  pause
  exit /b 1
)
echo Installing packages (first time takes a few minutes)...
call :logged npm install
if errorlevel 1 goto failed
echo Matching package versions to the Expo Go app on your phone...
call :logged npx expo install --fix
echo Checking the app code for errors (a quick check; the app still starts if it finds some)...
call :logged npx tsc --noEmit
if errorlevel 1 echo The code check found errors. Please paste trial-log.txt into a comment on the Satchel Build page, then carry on testing.
echo.
echo Starting Satchel. When the QR code appears, scan it with your iPhone Camera app.
echo (Install "Expo Go" from the App Store first. Press Ctrl+C here to stop.)
echo If anything below is red, paste trial-log.txt and these messages into a comment on the Satchel Build page.
>> "%LOG%" echo.
>> "%LOG%" echo ^> npx expo start --go --tunnel --port 8098 [interactive; output stays in this window]
call npx expo start --go --tunnel --port 8098
goto end
:failed
echo.
echo Something went wrong installing packages.
echo Open trial-log.txt in this folder and paste it into a comment on the Satchel Build page.
goto end
:logged
rem Runs the command, shows its output here and appends it to trial-log.txt; keeps its exit code.
>> "%LOG%" echo.
>> "%LOG%" echo ^> %*
powershell -NoProfile -ExecutionPolicy Bypass -Command "cmd /c '%* 2>&1' | ForEach-Object { $_; Add-Content -LiteralPath $env:LOG -Value $_ }; exit $LASTEXITCODE"
exit /b %errorlevel%
:end
pause
