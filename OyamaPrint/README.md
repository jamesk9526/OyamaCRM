# OyamaPrint

OyamaPrint is the desktop foundation for all print-oriented OyamaCRM workflows: donor letters today, and labels, receipts, envelopes, printable reports, and additional CRM audience workflows over time.

## Current capabilities

- Sign in using the existing OyamaCRM login, including email MFA when it is enabled.
- Load, create, and save letter templates through the existing authorized REST API.
- Load API-authorized merge fields and insert their native `{{token}}` values into the editor.
- View CRM email/audience lists without duplicating recipient data locally.
- Edit on an 8.5 × 11-inch Letter surface with Word-like Home, Insert, and Layout controls.
- Create local print projects with automatic recovery and open CRM templates as editable projects.
- Apply the CRM organization's logo, colors, address, contact details, and tagline to the workspace and local output.
- Preview, print, or export a PDF entirely on the user's Windows computer.

## Run

```powershell
dotnet run --project OyamaPrint/OyamaPrint.csproj
```

The API URL defaults to the production CRM URL. For development, expand **Connection settings** on the sign-in screen and enter the running API origin. The editor is never shown until CRM authentication succeeds. Passwords are never stored. When **Keep me signed in** is enabled, the rotating refresh session is saved in Windows Credential Manager and renewed on the next launch.

## Versioned MSI

Run `OyamaPrint\build.bat` from Explorer or a command prompt. It restores required assets first, publishes the x64 application, then creates a rolling, upgrade-safe MSI under `OyamaPrint\artifacts\msi`.

The MSI version follows `YY.MM.R`, where `R` is a monotonic build value based on the current day and minute. This format stays within Windows Installer's strict version limits. The installer has a stable upgrade code, so a later build upgrades the installed OyamaPrint application.

The MSI creates a Start-menu entry at `OyamaCRM > OyamaPrint`, so the application is discoverable through Windows Search after installation.

## Roadmap

The project manager reserves clear sections for letters, forms, labels and envelopes, receipts, and reports. Letters are active now; the other sections are visibly marked as coming soon rather than presenting unfinished controls as working features.
