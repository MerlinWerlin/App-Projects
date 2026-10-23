@echo off
rem Glaze development build for your iPhone (moving lock screen, widgets, Live Photo export).
rem You type your Expo and Apple logins yourself in this window.
cd /d "%~dp0"
title Glaze dev build - keep this window open
echo [1/5] Adding the development client...
call npx expo install expo-dev-client
echo.
echo [2/5] Checking your Expo login (type it if asked)...
call npx --yes eas-cli@latest whoami || call npx --yes eas-cli@latest login
echo.
echo [3/5] Linking Glaze to your Expo account...
call npx --yes eas-cli@latest init
echo.
echo [4/5] Registering your iPhone. Open the link or QR code it shows ON THE IPHONE and install the profile.
call npx --yes eas-cli@latest device:create
echo.
echo [5/5] Building in Expo cloud. Sign in to Apple when asked and let it manage certificates (answer Y).
call npx --yes eas-cli@latest build --profile development --platform ios
echo.
echo When the build finishes, scan the QR code it printed with the iPhone camera to install Glaze.
echo Then: iPhone Settings, Privacy and Security, Developer Mode, On, restart.
cmd /k
