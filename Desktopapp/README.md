# Oyama Desktopapp

Simple Electron shell for OyamaCRM.

## What it does

- Shows a welcome screen on first launch.
- Prompts for a CRM URL to bind.
- Saves that URL locally in Electron user data.
- Opens the CRM inside the desktop shell every time after that.
- Uses a custom Oyama-branded title bar (not the default Windows title bar).

## Run locally

1. Open a terminal in this folder.
2. Install dependencies:
   - npm install
3. Start app:
   - npm start

## One-click installer builder (Windows)

1. Double-click:
   - build-installer.bat
2. When complete, installer output will be in:
   - release\OyamaCRM-Desktop-Setup-<version>.exe

This uses electron-builder with NSIS one-click mode.

## Notes

- Bound URL config file is stored in Electron user data as:
  - oyama-desktop-config.json
- You can change the URL anytime with the Change URL button in the app toolbar.
