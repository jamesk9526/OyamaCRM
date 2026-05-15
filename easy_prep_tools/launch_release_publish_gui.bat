@echo off
setlocal

REM Launches the OyamaCRM Tkinter Release Publisher GUI.
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..

cd /d "%PROJECT_ROOT%"

where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  py -3 "%SCRIPT_DIR%release_publish_gui.py"
  goto :eof
)

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  python "%SCRIPT_DIR%release_publish_gui.py"
  goto :eof
)

echo Python 3 was not found. Install Python and retry.
pause
