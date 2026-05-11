# Phase 00 — Setup, Onboarding, and Settings

## Goal

Finish the installation/bootstrap surfaces so a fresh OyamaCRM instance can be configured, recovered, and administered without command-line work.

## Already in place

- Browser-based `/setup` wizard and setup-status gate
- Dedicated Settings workspace shell and sidebar
- Settings → System and System Status diagnostics
- Verified reset flow in Settings → Security that clears the CRM and reopens `/setup`

## Remaining scope

- Users management UI
- Roles & Scopes UI
- Workspace-access management
- App drawer strategy (TopBar drawer reserved for standalone apps; CRM switching stays in module switcher)
- Standalone app shell strategy (`/apps/*` uses basic shell with no CRM top search bar and no CRM AI controls)
- Removal of remaining seeded-org assumptions from live routes
- Broader admin/RBAC protection on sensitive settings/setup recovery flows
- Backup, restore, and recovery documentation

## Remaining implementation steps

1. Build add/edit/disable/invite/reset-password flows for users.
2. Build a real role/permission matrix editor.
3. Build workspace access controls for donor vs. Compassion usage.
4. Keep the app drawer empty by default and populate it only with standalone apps (for example Trivia Night) as they ship.
5. Keep standalone apps in `/apps/*` with a basic shell and app-local navigation (no CRM top search or CRM AI controls).
6. Maintain app and CRM data isolation by default; add explicit permission-scoped integration points only where needed.
7. Replace remaining `org_demo` assumptions with installation-aware organization lookup.
8. Apply admin-only middleware consistently to sensitive setup/settings routes.
9. Document reset, backup, and restore runbooks for operators.

## Exit criteria

- A nontechnical admin can configure the installation from the browser.
- Settings pages manage users, roles, and workspaces without placeholder-only screens.
- Sensitive setup/recovery actions are both permission-protected and documented.
