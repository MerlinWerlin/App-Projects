@echo off
cd /d "%~dp0"
set LOG=%~dp0upgrade-log.txt
echo === stop old Linework server on 8090 > "%LOG%"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":8090 .*LISTENING"') do taskkill /PID %%p /T /F >> "%LOG%" 2>&1
echo === expo install expo@^57.0.0 >> "%LOG%"
call npx --yes expo install expo@^57.0.0 >> "%LOG%" 2>&1
echo exit %ERRORLEVEL% >> "%LOG%"
echo === expo install --fix >> "%LOG%"
call npx expo install --fix >> "%LOG%" 2>&1
echo exit %ERRORLEVEL% >> "%LOG%"
echo === expo-doctor >> "%LOG%"
call npx --yes expo-doctor >> "%LOG%" 2>&1
echo === expo start 8091 >> "%LOG%"
call npx expo start --go --tunnel --port 8091 >> "%LOG%" 2>&1
echo start exit %ERRORLEVEL% >> "%LOG%"
cmd /k
