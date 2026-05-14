@echo off
setlocal
cd /d "%~dp0"

echo.
echo =============================================
echo Oyama Bridge - NSIS One-Click Installer Build
echo =============================================
echo.

echo Running clean installer build script...
call "%~dp0build-nsis-oneclick.bat"
if errorlevel 1 goto :fail

echo.
echo Build complete.
echo Installer is in: %~dp0release
echo.
exit /b 0

:fail
echo.
echo Installer build failed.
exit /b 1
