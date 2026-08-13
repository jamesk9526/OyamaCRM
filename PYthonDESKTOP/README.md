# OyamaCRM Desktop

A small Windows desktop companion for securely signing in to OyamaCRM, searching donor records, running a live fundraising summary, and exporting that report to CSV.

## Run locally

```powershell
cd PYthonDESKTOP
python -m pip install -r requirements.txt
python oyama_desktop.py
```

Enter the API base URL (for example `http://localhost:4000`) and your existing OyamaCRM credentials. The app supports email MFA when it is enabled by the server. Access stays scoped to the permissions assigned to that user.

## Build the Windows executable

```powershell
cd PYthonDESKTOP
.\build.ps1
```

The executable is written to `PYthonDESKTOP\dist\OyamaCRM-Desktop.exe`. To remove old build artifacts before rebuilding, run `.\build.ps1 -Clean`.
