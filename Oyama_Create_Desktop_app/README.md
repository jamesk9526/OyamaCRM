# Oyama Create Desktop

Windows desktop application using C# and WPF on .NET 10.

## Current milestone

A blank, resizable application window. No CRM connection or sending is implemented.
All application UI is owned by this project and editable in XAML; there is no embedded website or third-party UI shell.

## Run and develop

From this directory: `dotnet run`.
For development: `dotnet watch run`. Supported edits use Hot Reload; other edits may require a restart. Visual Studio XAML Hot Reload is also supported while debugging.
MainWindow.xaml controls the initial window; App.xaml holds application resources.

## Incremental roadmap

1. Agree on the desktop shell and editable visual tokens.
2. Letter editing with save/open and a defined document model.
3. Print preview and verified PDF output.
4. Email conversion with explicit fidelity expectations and preview.
5. Authenticated CRM audience integration, with server-side tenant and user authorization.
6. Reviewed email dispatch and social content workflows.

Each milestone needs focused verification before expansion. PDF layout and email HTML need separate rendering checks. Production readiness, authentication, persistence, deployment and integrations remain future work.
