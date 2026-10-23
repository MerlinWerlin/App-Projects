@echo off
cd /d "%~dp0"
set LOG=%~dp0restart-log.txt
echo === stop old server on 8091 > "%LOG%"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":8091 .*LISTENING"') do taskkill /PID %%p /T /F >> "%LOG%" 2>&1
echo === expo start 8091 >> "%LOG%"
call npx expo start --go --tunnel --port 8091 >> "%LOG%" 2>&1
