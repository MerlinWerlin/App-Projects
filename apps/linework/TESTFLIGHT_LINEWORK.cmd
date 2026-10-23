@echo off
rem Linework to TestFlight: builds a release version in Expo cloud and uploads it to App Store Connect.
rem You type your Expo and Apple logins yourself in this window.
cd /d "%~dp0"
set EAS_NO_VCS=1
title Linework to TestFlight - keep this window open
echo [1/4] Checking your Expo login (type it if asked)...
call npx --yes eas-cli@latest whoami || call npx --yes eas-cli@latest login
echo.
echo [2/4] Linking Linework to your Expo account (answer Y to create the project)...
call npx --yes eas-cli@latest init
echo.
echo [3/4] Setting up instant updates (lets PUSH_UPDATE.cmd send changes to the TestFlight app later)...
call npx --yes eas-cli@latest update:configure
echo.
echo Installing packages (adds the App Store purchase library expo-iap)...
call npm install
echo.
echo [4/4] Building and sending to TestFlight. Sign in to Apple if asked; answer Y to let it manage certificates.
echo If it asks for an App Store name, use: Linework: Trace ^& Sketch
call npx --yes eas-cli@latest build --platform ios --profile production --auto-submit
echo.
echo Done here. Apple processes the build (about 10-30 min) and emails you. Then open TestFlight on the iPhone.
cmd /k
