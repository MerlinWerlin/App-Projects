@echo off
rem Quick start (no reinstall): frees the port, then starts the app for Expo Go over a tunnel.
cd /d "%~dp0"
set LOG=%~dp0run-log.txt
echo === %DATE% %TIME% stop old server on 8094 > "%LOG%"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":8094 .*LISTENING"') do taskkill /PID %%p /T /F >> "%LOG%" 2>&1
echo === expo start 8094 >> "%LOG%"
call npx expo start --go --tunnel --port 8094 >> "%LOG%" 2>&1
echo start exit %ERRORLEVEL% >> "%LOG%"
