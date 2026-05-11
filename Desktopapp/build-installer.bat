@echo off
setlocal
cd /d "%~dp0"

echo.
echo =====================================
echo Building OyamaCRM Desktop Installer...
echo =====================================
echo.

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 goto :fail
)

echo Creating one-click Windows installer...
call npm run dist:win
if errorlevel 1 goto :fail

echo.
echo Build complete.
echo Installer is in: %~dp0release
echo.
pause
exit /b 0

:fail
echo.
echo Build failed. Review errors above.
echo.
pause
exit /b 1
