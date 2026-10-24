@echo off
cd /d "%~dp0"
set LOG=%~dp0sdk57-log.txt
echo === npm install > "%LOG%"
call npm install >> "%LOG%" 2>&1
echo === expo install "expo@~57.0.27" >> "%LOG%"
call npx --yes expo install "expo@~57.0.27" >> "%LOG%" 2>&1
echo === expo install --fix >> "%LOG%"
call npx expo install --fix >> "%LOG%" 2>&1
echo === expo start 8097 >> "%LOG%"
call npx expo start --go --tunnel --port 8097 >> "%LOG%" 2>&1
