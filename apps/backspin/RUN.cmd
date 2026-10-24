@echo off
rem Quick start (no reinstall): frees the port, then starts Backspin for Expo Go over a tunnel.
rem Port 8097 is Backspin's (8091 Linework, 8092 Couch, 8093 Glaze; 8094-8096 left for other new apps).
cd /d "%~dp0"
set LOG=%~dp0run-log.txt
echo === %DATE% %TIME% stop old server on 8097 > "%LOG%"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":8097 .*LISTENING"') do taskkill /PID %%p /T /F >> "%LOG%" 2>&1
echo === expo start 8097 >> "%LOG%"
call npx expo start --go --tunnel --port 8097 >> "%LOG%" 2>&1
echo start exit %ERRORLEVEL% >> "%LOG%"
