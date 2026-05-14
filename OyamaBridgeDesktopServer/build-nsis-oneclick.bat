@echo off
setlocal
cd /d "%~dp0"

echo.
echo =============================================
echo Oyama Bridge - NSIS One-Click Installer Build
echo =============================================
echo.

if not exist "node_modules" (
  echo [1/4] Installing dependencies...
  call npm install
  if errorlevel 1 goto :fail
) else (
  echo [1/4] Dependencies already installed.
)

echo [2/4] Cleaning previous release output...
if exist "release" rmdir /s /q "release"
mkdir "release" >nul 2>&1

echo [3/4] Building one-click NSIS installer...
call npx electron-builder --win nsis --x64 --publish never
if errorlevel 1 goto :fail

echo [4/4] Build complete.
echo Output folder: %~dp0release
for %%F in ("%~dp0release\Oyama-Bridge-Setup-*.exe") do (
  set "LATEST_INSTALLER=%%~fF"
)
if defined LATEST_INSTALLER echo Installer: %LATEST_INSTALLER%
echo.
exit /b 0

:fail
echo.
echo NSIS installer build failed.
exit /b 1
