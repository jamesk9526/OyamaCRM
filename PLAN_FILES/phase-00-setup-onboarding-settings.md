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
- Removal of remaining seeded-org assumptions from live routes
- Broader admin/RBAC protection on sensitive settings/setup recovery flows
- Backup, restore, and recovery documentation

## Remaining implementation steps

1. Build add/edit/disable/invite/reset-password flows for users.
2. Build a real role/permission matrix editor.
3. Build workspace access controls for donor vs. Compassion usage.
4. Replace remaining `org_demo` assumptions with installation-aware organization lookup.
5. Apply admin-only middleware consistently to sensitive setup/settings routes.
6. Document reset, backup, and restore runbooks for operators.

## Exit criteria

- A nontechnical admin can configure the installation from the browser.
- Settings pages manage users, roles, and workspaces without placeholder-only screens.
- Sensitive setup/recovery actions are both permission-protected and documented.
