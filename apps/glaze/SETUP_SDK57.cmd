@echo off
cd /d "%~dp0"
set LOG=%~dp0sdk57-log.txt
echo === stop old server on 8093 > "%LOG%"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":8093 .*LISTENING"') do taskkill /PID %%p /T /F >> "%LOG%" 2>&1
echo === npm install >> "%LOG%"
call npm install >> "%LOG%" 2>&1
echo exit %ERRORLEVEL% >> "%LOG%"
echo === expo install "expo@~57.0.27" >> "%LOG%"
call npx --yes expo install "expo@~57.0.27" >> "%LOG%" 2>&1
echo exit %ERRORLEVEL% >> "%LOG%"
echo === expo install --fix >> "%LOG%"
call npx expo install --fix >> "%LOG%" 2>&1
echo exit %ERRORLEVEL% >> "%LOG%"
echo === expo-doctor >> "%LOG%"
call npx --yes expo-doctor >> "%LOG%" 2>&1
echo === expo start 8093 >> "%LOG%"
call npx expo start --go --tunnel --port 8093 >> "%LOG%" 2>&1
echo start exit %ERRORLEVEL% >> "%LOG%"
