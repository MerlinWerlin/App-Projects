@echo off
cd /d "%~dp0"
set LOG=%~dp0sdk57-log.txt
echo === npm install > "%LOG%"
call npm install >> "%LOG%" 2>&1
echo === expo install "expo@~58.0.19" >> "%LOG%"
call npx --yes expo install "expo@~58.0.19" >> "%LOG%" 2>&1
echo === expo install --fix >> "%LOG%"
call npx expo install --fix >> "%LOG%" 2>&1
echo === expo start 8094 >> "%LOG%"
call npx expo start --go --tunnel --port 8094 >> "%LOG%" 2>&1
