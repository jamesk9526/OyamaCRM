@echo off
REM Launch the production build manager Tkinter GUI from repository root context.
setlocal
cd /d "%~dp0.."
python easy_prep_tools\production_build_manager_gui.py
