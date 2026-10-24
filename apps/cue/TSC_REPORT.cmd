@echo off
rem Cue PC check, run unattended by _auto\auto_start.ps1 after each new build.
rem Writes tsc-report.txt: 1) type check, 2) unit tests, 3) iOS bundle check.
cd /d "%~dp0"
if not exist node_modules call npm install
echo Cue verification report %DATE% %TIME% > tsc-report.txt
echo === 1/3 Type check: npx tsc --noEmit ===>> tsc-report.txt
call npx tsc --noEmit >> tsc-report.txt 2>&1
echo.>> tsc-report.txt
echo === 2/3 Tests: npm test ===>> tsc-report.txt
call npm test -- --ci >> tsc-report.txt 2>&1
echo.>> tsc-report.txt
echo === 3/3 Bundle check: npx expo export --platform ios ===>> tsc-report.txt
call npx expo export --platform ios --output-dir "%TEMP%\cue-export-check" >> tsc-report.txt 2>&1
if errorlevel 1 (echo EXPO EXPORT FAILED>> tsc-report.txt) else (echo EXPO EXPORT OK>> tsc-report.txt)
