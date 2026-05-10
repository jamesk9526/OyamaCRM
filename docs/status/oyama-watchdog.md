# OyamaWatchdog Status

Last updated: 2026-05-10

## Purpose

OyamaWatchdog is the security-focused admin CRM module for platform-level monitoring, credential vault operations, and cross-module security visibility.

## Current Scope (Implemented)

- Dedicated module route and shell:
  - `app/watchdog/layout.tsx`
  - `app/watchdog/page.tsx`
  - `app/components/layout/WatchdogSidebar.tsx`
- Starter security dashboard UI:
  - `app/components/watchdog/WatchdogDashboardPage.tsx`
  - `app/components/watchdog/WatchdogStatusCards.tsx`
  - `app/components/watchdog/WatchdogSecurityFeed.tsx`
  - `app/components/watchdog/WatchdogVaultPanel.tsx`
- Backend API routes mounted at `/api/watchdog`:
  - `server/src/routes/watchdog.ts`
- External watchdog store service with encryption utilities:
  - `server/src/services/watchdog-store.ts`

## Security Architecture

### Separate Database

Watchdog data is intentionally isolated from the primary CRM database using:

- `WATCHDOG_DATABASE_URL`

This connection is used for watchdog events and vault records.

### Encryption Model

Sensitive vault values are encrypted before persistence using AES-256-GCM with:

- `WATCHDOG_ENCRYPTION_KEY`

Operational expectations:

- Key material is environment-managed and never hardcoded.
- Plaintext secrets are only returned when the caller has explicit permission.
- Missing config should fail safely with clear status errors.

### Access Control

Watchdog routes require admin-level access and support fine-grained permission checks via `UserPermission`.

Permission keys currently used include watchdog-prefixed scopes (for example `watchdog:view_logs` and `watchdog:vault:read_secret`).

## API Surface (Current)

- `GET /api/watchdog/permissions`
- `GET /api/watchdog/status`
- `GET /api/watchdog/security-feed`
- `POST /api/watchdog/security-feed/actions`
- `POST /api/watchdog/security-events`
- `GET /api/watchdog/vault`
- `POST /api/watchdog/vault`
- `GET /api/watchdog/vault/:id`

## Known Gaps

- Alert policy configuration and notification channels are not complete.
- External store observability (retention policies, replay, and export) is limited.

## Next Steps

1. Add explicit Watchdog role templates and permission presets in settings.
2. Add encrypted credential rotation reminders and expiration metadata.
3. Add integration hooks for SIEM/webhook sinks.
4. Add end-to-end tests for missing-env behavior and permission enforcement.
