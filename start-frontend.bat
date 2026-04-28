@echo off
setlocal

cd /d %~dp0\frontend

where py >nul 2>nul
if %errorlevel%==0 (
  echo Starting frontend on http://localhost:5500 ...
  py -m http.server 5500
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo Starting frontend on http://localhost:5500 ...
  python -m http.server 5500
  goto :eof
)

echo Python is not installed. Please start frontend with VSCode Live Server or any static server at port 5500.

endlocal
