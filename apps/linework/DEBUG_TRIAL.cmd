@echo off
cd /d "%~dp0"
echo === expo start port 8090 > debug-log.txt
call npx expo start --go --tunnel --port 8090 2>> debug-log.txt
echo start exit %ERRORLEVEL% >> debug-log.txt
cmd /k
