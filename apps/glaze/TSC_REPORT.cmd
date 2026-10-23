@echo off
rem Glaze: PC verification report. Writes tsc-report.txt next to this file:
rem   1) whole-project type check (npx tsc), 2) iOS bundle check (npx expo export).
rem Paste tsc-report.txt into a comment on the Glaze build page so the cloud build can fix the errors from the real list.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org then run this again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing packages first...
  call npm install
)
rem D72-1: SDK-correct pins for the glass-bar packages (no-op when already right).
call npx expo install expo-blur expo-linear-gradient
echo Glaze verification report %DATE% %TIME% > tsc-report.txt
for /f "delims=" %%v in ('node -v') do echo node %%v >> tsc-report.txt
echo.>> tsc-report.txt
echo === 1/2 Type check: npx tsc --noEmit ===>> tsc-report.txt
echo Type-checking the whole project, this takes a minute...
call npx tsc --noEmit --ignoreDeprecations 6.0 >> tsc-report.txt 2>&1
echo.>> tsc-report.txt
echo === 1b Node-side check: npx tsc -p tsconfig.node.json (tests, ops, app.config.ts) ===>> tsc-report.txt
call npx tsc -p tsconfig.node.json --ignoreDeprecations 6.0 >> tsc-report.txt 2>&1
echo.>> tsc-report.txt
echo === 2/2 Bundle check: npx expo export --platform ios ===>> tsc-report.txt
echo Building the iOS bundle to check it compiles, this takes a few minutes...
call npx expo export --platform ios --output-dir "%TEMP%\glaze-export-check" >> tsc-report.txt 2>&1
if errorlevel 1 (
  echo EXPO EXPORT FAILED >> tsc-report.txt
) else (
  echo EXPO EXPORT OK >> tsc-report.txt
)
echo.
echo Type errors found:
find /c "error TS" tsc-report.txt
echo.
echo Done. Open tsc-report.txt, copy everything, and paste it into a comment on the Glaze build page.
pause
