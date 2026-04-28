@echo off
setlocal

set PORT=8080
set PID=

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
  set PID=%%a
  goto :found
)

:found
if not defined PID (
  echo No listening process found on port %PORT%.
  exit /b 0
)

echo Stopping backend process %PID% on port %PORT% ...
taskkill /PID %PID% /F

if errorlevel 1 (
  echo Failed to stop process %PID%.
  exit /b 1
)

echo Backend server stopped.
endlocal
