# Oyama Desktop for Windows

Native C# / WPF CRM client, separate from the Electron CRM and AI Bridge. Requires Windows and .NET 8 Desktop Runtime, or publish self-contained.

```
dotnet run --project OyamaDesktopCSharp/OyamaDesktop.csproj
dotnet publish OyamaDesktopCSharp/OyamaDesktop.csproj -c Release -r win-x64 --self-contained true -o OyamaDesktopCSharp/publish
```

Enter the HTTPS CRM origin, email, and password. Email MFA is supported. The client uses the existing `/api/auth/login`, `/mfa/verify`, `/logout` and scoped Contacts/Tasks APIs. Access tokens and refresh cookies live only in memory; restart requires sign-in. Expired access tokens are renewed once through the refresh cookie; an expired refresh session requires sign-in. No API server changes or role bypasses are included.

Contacts, Donations and Tasks use server pagination and search. Tables support sorting, column resizing and native keyboard navigation. Exports include only visible rows and neutralize common spreadsheet formula prefixes. Local file previews accept text/CSV/JSON/Markdown/log files up to 2 MB, never upload them, and do not execute contents. This is a read-only CRM client; record editing, offline synchronization and full browser feature parity remain future work.

## Suite architecture

`Models/SuiteModules.cs` registers workspaces. `Services/CrmClient.cs` owns authenticated HTTP transport. `Services/LocalWorkspace.cs` owns local file boundaries. The WPF shell controls presentation and lifecycle. Add future suite modules behind explicit service boundaries; never expose arbitrary commands or unscoped filesystem access to server content.

The existing desktop applications remain available. This is a new native client, not a migration of saved sessions or an AI runtime manager.

## Installer

`artifacts/Oyama-Desktop-Setup-2.0.0.exe` installs per-user, includes the .NET runtime, and registers Start-menu/desktop shortcuts and Windows uninstall. Build after publishing with NSIS `makensis installer.nsi`. The installer is unsigned. Authenticated live API testing and a clean-machine installation test remain outstanding.
