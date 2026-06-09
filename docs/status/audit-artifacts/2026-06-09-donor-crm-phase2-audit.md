# DonorCRM Phase 2 Fresh Audit (2026-06-09)

Scope: current DonorCRM route surface, API-backed evidence, stale status reconciliation, and truthfulness checks for placeholder/dead-control signals.

## Summary

- Canonical donor workspaces remain route-owned and API-backed for Constituents, Donations, Campaigns, Tasks, Meetings, Grants, Communications -> OyamaEmail redirect, and Letters.
- One stale status claim was found and reconciled: `Letters and Printables` in the donor audit remained `Partially Working` even though server PDF export and batch generation evidence is now in place.
- One stale risk note was found and reconciled: `Volunteers` no longer uses direct unauthenticated fetch; it now uses shared `apiFetch`.
- Remaining truthful partials include donor settings placeholder routes and one route-level browser confirm in donations temporary handoff flow.

## Evidence Highlights

### Canonical routing and workspace ownership

- Communications legacy route redirects into canonical OyamaEmail campaigns: `app/communications/page.tsx`.
- Canonical OyamaEmail workspace entry: `app/oyama-email/page.tsx`.
- Canonical OyamaLetters workspace entry: `app/oyama-letters/page.tsx`.
- Canonical reports app shell route: `app/reports/page.tsx`.

### API-backed donor surfaces (representative)

- Constituents UI -> `/api/constituents*`: `app/constituents/page.tsx`.
- Donations UI -> `/api/donations*` and quick-actions: `app/donations/page.tsx`.
- Campaigns UI -> `/api/campaigns*`: `app/campaigns/page.tsx`.
- Tasks UI -> `/api/tasks*`: `app/tasks/page.tsx`.
- Meetings UI -> `/api/meetings*`: `app/meetings/page.tsx`.
- Grants UI -> `/api/grants*`: `app/grants/page.tsx`, `app/grants/[id]/page.tsx`.

### Server endpoint depth (representative)

- Constituents route breadth: `server/src/routes/constituents.ts`.
- Donations route breadth with stewardship quick-actions and imports: `server/src/routes/donations.ts`.
- Campaigns CRUD: `server/src/routes/campaigns.ts`.
- Tasks lifecycle and bulk assign: `server/src/routes/tasks.ts`.
- Meetings lifecycle: `server/src/routes/meetings.ts`.
- Grants CRUD + funders + case-items + activity: `server/src/routes/grants.ts`.
- Reports coverage for summary/retention/top-donors/board/admin exports: `server/src/routes/reports.ts`.
- Email campaigns workflow + queue + delivery/webhooks: `server/src/routes/email-campaigns.ts`.
- Letters templates/publish/history/generate/export/queue: `server/src/routes/letters.ts`.

### Truthfulness and partial-risk findings

- Browser confirm still present in donor donations workspace (`window.confirm`) for temporary handoff path: `app/donations/page.tsx`.
- Donor settings page is still a placeholder surface via `SettingsPlaceholderPage`: `app/settings/donor/page.tsx`.
- Additional settings modules remain partially wired or TODO-marked (tasks/events/email): `app/settings/tasks/page.tsx`, `app/settings/events/page.tsx`, `app/settings/email/page.tsx`.

## Stale Documentation Reconciliation Performed

1. Updated donor audit date and reconciled stale statuses in `docs/DONOR_CRM_AUDIT.md`:
   - `Letters and Printables`: `Partially Working` -> `Working`.
   - `Volunteers` risk text corrected to reflect shared `apiFetch` usage.
2. Added a donor phase-2 audit refresh section to `docs/status/features.md`.
3. Added a donor phase-2 readiness snapshot to `docs/status/production-readiness-checklist.md`.

## Validation Performed For This Pass

- `pnpm typecheck`
- `pnpm build`

Status conclusion for this phase:

- DonorCRM audit documentation has been refreshed and reconciled with current route/API evidence.
- Remaining partials are explicitly documented and evidence-backed.