# OyamaCRM Desktop

A small Windows desktop companion for securely signing in to OyamaCRM, searching donor records, reviewing a live fundraising dashboard with giving charts, running a report, and exporting it to CSV.

## Run locally

```powershell
cd PYthonDESKTOP
python -m pip install -r requirements.txt
python oyama_desktop.py
```

Enter the API base URL (for example `http://localhost:4000`) and your existing OyamaCRM credentials. The app supports email MFA when it is enabled by the server. Access stays scoped to the permissions assigned to that user.

When **Remember this sign-in** is selected, the desktop app stores only the session details (not your password) encrypted with Windows DPAPI. It refreshes the rotating CRM session when the app opens. Use **Forget saved sign-in** on the sign-in page to remove the local session.

## Build the Windows executable

```powershell
cd PYthonDESKTOP
.\build.ps1
```

The executable is written to `PYthonDESKTOP\dist\OyamaCRM-Desktop.exe`. To remove old build artifacts before rebuilding, run `.\build.ps1 -Clean`.
