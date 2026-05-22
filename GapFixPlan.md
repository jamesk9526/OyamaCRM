# Gap Fix Plan

Last updated: 2026-05-21

## Purpose

This file is the working checklist for the CRM-wide gap-and-fix pass.
Each tool/workspace starts unchecked and gets checked off only after its audit and any required fixes are completed.

## Status Rules

- `[ ]` Not audited yet
- `[x]` Audited and current pass completed
- Add short notes under the audit log when a tool needs follow-up work

## Inventory Sources

- `app/` route inventory
- `FEATURES.md`
- `docs/CRM_SIDEBAR_NAVIGATION.md`
- `docs/status/features.md`

## Pass 0

- [x] Build initial CRM tool inventory
- [x] Create root checklist file
- [x] Start first tool audit and fix pass

## Global Shell And Shared Workspaces

- [x] Dashboard / Home
- [x] Top Bar
- [x] Notifications
	- Follow-up: durable producers now cover task/livecom/grants; continue expanding producers in additional modules with explicit assignee ownership.
- [x] Messenger
- [x] Global Search / Command Search
- [x] Module Switcher
- [x] Help
- [x] Settings
- [x] Data Tools
	- Follow-up: broader admin-grade export tooling and deeper centralized data-quality reporting can still expand from this now-working baseline.
- [x] Setup Wizard
- [x] Offline Page

## Donor CRM Core Tools

- [x] Constituents
- [x] Donations
- [x] Campaigns
- [x] Communications
	- Follow-up: webhook ingestion now covers delivery/open/click/bounce; extend provider mapping for unsubscribe event propagation.
- [x] Email Builder
	- Follow-up: reusable sections are currently per-user local library snippets; expand to shared org-level section libraries if teams need centralized governance.
- [x] Letters And Printables
	- Follow-up: improve server-side PDF fidelity/storage pipeline and add deeper delivery metadata for print vendor workflows.
- [x] Contacts Manager
- [x] Tasks
- [x] Steward Paths
	- Follow-up: add long-window failure trend dashboards and finish remaining advanced node-type execution depth.
- [ ] Steward Signals
	- Needs done: finish segment/export automation and continue hardening confirmation-gated write actions.
- [x] Reports
- [ ] Grants
	- Needs done: add dedicated grant calendar view and expanded cross-grant workload/reporting surfaces.
- [x] Meetings
- [x] Volunteers
	- Follow-up: expand the workspace beyond list/search into volunteer-hour tracking and assignment reporting depth.
- [ ] Payments
	- Needs done: build real `/api/payments/*` and provider integration flows; current portal remains demo-oriented.
- [x] QuickBooks Sync
- [x] Custom Fields
- [x] Designations
- [x] LiveCom

## Compassion CRM Tools

- [ ] Compassion Dashboard
	- Needs done: replace demo/static dashboard datasets with live API-backed metrics.
- [x] Clients
- [ ] Cases
	- Needs done: complete the full case workspace beyond create/assign/stage basics.
- [x] Appointments
- [ ] Follow Ups
	- Needs done: complete list/work-queue depth beyond task creation basics.
- [ ] Assessments
	- Needs done: finish result tracking and broader assessment workflow coverage.
- [ ] Activities
	- Needs done: confirm whether the dedicated activities route is production-ready or fold activity access back into the client profile source-of-truth.
- [ ] Families
	- Needs done: audit route behavior and document current readiness; no clear feature-status evidence yet.
- [ ] Communications
	- Needs done: audit route behavior and add real persistence/readiness evidence before checking off.
- [ ] Reports
	- Needs done: expand beyond appointment count/case summary into broader service analytics.
- [ ] Data Tools
	- Needs done: complete Compassion-specific scoped data tools and search/filter workflows.
- [x] Client Import
- [ ] Settings
	- Needs done: verify real settings depth and enforce Compassion workspace permissions consistently.
- [ ] Tasks
	- Needs done: current route remains a known placeholder/partial surface and should stay open until replaced or completed.
- [ ] Care Plans
	- Needs done: implement the care plan workspace; currently not implemented.

## Events CRM Tools

- [x] Event Workspace Selector
- [x] Event Registry
- [ ] Event Overview
	- Needs done: finish live-data depth for the overview dashboard and reduce remaining mixed/static status surfaces.
- [x] Guests
- [x] Orders
- [ ] Tickets
	- Needs done: finish purchase-flow depth and any remaining ticket-type workflow gaps.
- [x] Tables
- [ ] Sponsors
	- Needs done: complete sponsorship package seat-allocation and deeper sponsor workflow depth.
- [ ] Hosts
	- Needs done: audit current host workspace readiness and keep it open until invite/portal flows are fully wired.
- [ ] Check In
	- Needs done: finish QR scanner integration and remaining check-in hardening.
- [ ] Fundraising
	- Needs done: audit actual persistence depth and complete donor-linked fundraising execution flows.
- [ ] Communications
	- Needs done: replace scaffold-level pages with dedicated APIs and live campaign execution.
- [ ] Emails
	- Needs done: replace scaffold-level email pages with real persistence, scheduling, and delivery status.
- [ ] Volunteers
	- Needs done: complete volunteer assignment workflows and persistence.
- [ ] Tasks
	- Needs done: replace scaffold-level task views with dedicated event task persistence and workflow actions.
- [ ] Follow Up
	- Needs done: complete post-event follow-up workflow depth and donor handoff evidence.
- [ ] Files
	- Needs done: implement upload/backend file handling and remove scaffold-level behavior.
- [x] Reports
- [x] Event Page Builder
- [ ] Templates
	- Needs done: finish template application flows and management depth.
- [ ] Event Settings
	- Needs done: complete settings persistence and remove remaining partial/demo states.
- [x] TableLink

## Admin, Ops, And Adjacent Product Tools

- [ ] Watchdog
	- Needs done: expand permission matrix UI, runbook actions, and production-ready health/alert wiring.
- [ ] WebMaster
	- Needs done: finish templates, CMS/forms, preflight checks, publish targets, version history, and rollback controls.
- [ ] HRM
	- Needs done: most HRM surfaces remain partial or not implemented; start with scheduling and permission model hardening.
- [ ] Board
	- Needs done: finish board-specific reporting depth; `app/components/board/BoardDashboard.tsx` still shows illustrative donor-status percentages until the reports API is fully wired for that section.
- [x] Automations
- [x] Apps Hub
- [x] Password Vault
- [x] Ogentic

## Audit Log

### 2026-05-21

- Inventory created from route structure, feature inventory, and sidebar docs.
- Dashboard / Home initial audit completed: page-level source is clean, no editor errors, and no obvious placeholder markers were found in `app/page.tsx`.
- Top Bar audit started but remains open: `app/components/layout/TopBar.tsx` is editor-clean, but the workspace switcher still has an HRM permission-gating TODO and should not be checked off until workspace permissions are implemented more explicitly.
- Shared-shell status seeding completed from `FEATURES.md`, `docs/status/features.md`, and targeted file diagnostics.
- Checked off in this pass: Help, Settings, Setup Wizard, Offline Page, Constituents, Donations, Campaigns, Contacts Manager, Tasks, Reports, Meetings, QuickBooks Sync, Custom Fields, Clients, Appointments, Event Workspace Selector, Event Registry, Guests, Orders, Tables, Reports, and TableLink.
- Event Page Builder route-level audit completed: `app/events/page-builder/page.tsx`, `app/components/events/page-builder/EventPageBuilderShell.tsx`, and `app/components/events/page-builder/EventPageBuilderTopBar.tsx` are editor-clean with no placeholder/TODO markers found in the builder surface.
- Password Vault route-level audit completed: `app/password/page.tsx`, `app/apps/password-vault/page.tsx`, and `app/components/password/OyamaPasswordWorkspace.tsx` are editor-clean with no placeholder/TODO markers found after the recent production pass.
- Apps Hub route-level audit completed: `app/apps/page.tsx` and `app/components/layout/AppsDrawer.tsx` are editor-clean with no placeholder/TODO markers found in the launcher surfaces.
- Top Bar and Module Switcher permission gap fixed: auth session payloads now include effective permissions from role defaults plus explicit overrides, and `app/components/layout/TopBar.tsx` now gates HRM visibility with `hrm.view` instead of a role-only shortcut.
- Messenger audit completed and bug fixed: `app/components/messenger/MessengerPanel.tsx` and `server/src/routes/messenger.ts` are clean, and `PUT /api/messenger/plugin` was moved out of the `/enabled` error path so the settings route now registers correctly.
- Global Search / Command Search audit completed: `app/components/layout/TopBar.tsx` includes a full `GlobalSearch` experience with keyboard controls, recent queries, and help fallback, and `server/src/routes/search.ts` provides clean API-backed scoped results.
- Designations audit completed: `app/designations/page.tsx`, `app/components/designations/DesignationManager.tsx`, and `server/src/routes/designations.ts` are clean and provide a real designation manager backed by `/api/designations`.
- Notifications producer expansion completed for this pass: `server/src/routes/grants.ts` now writes durable donor-module notifications on grant assignment and reassignment, complementing existing task/livecom producers.
- Communications telemetry gap closed for this pass: `server/src/routes/email-campaigns.ts` now includes a secret-gated provider webhook ingestion endpoint for delivery/open/click/bounce events, and campaign activity diagnostics are surfaced in `app/components/communications/CampaignDeliveryEventsPanel.tsx`.
- Email Builder gap closed for this pass: `app/components/email-builder/EmailBuilderApp.tsx` now supports reusable section snippets (save selected block, reinsert, remove) and renders revision history from `/api/email-campaigns/:id/send-log`, which now includes create/update audit events from `server/src/routes/email-campaigns.ts`.
- Email Builder compact-UI gap closed for this pass: `app/components/email-builder/BlockPalette.tsx` now uses a tighter icon+name block library with working Content/Layout filtering, and `app/components/email-builder/BlockEditor.tsx` now has functional Content/Style/Settings tabs with quick style/settings controls instead of static tab chrome.
- Email Builder inspector-settings gap closed for this pass: `app/components/email-builder/BlockEditor.tsx` now keeps email-wide Style/Settings controls available even when a block is selected, including whole-email font-family changes for the current builder session.
- Email Builder merge-preview gap closed for this pass: `app/components/email-builder/EmailBuilderApp.tsx` now recognizes `{{taxDeductibleAmount}}`, `server/src/routes/email-campaigns.ts` now personalizes preview/test/live sends with donor merge values, and `app/components/email-builder/EmailPreview.tsx` now shows a saved-campaign donor sample preview when one is available.
- Volunteers auth/session parity gap closed for this pass: `app/volunteers/page.tsx` now uses `apiFetch` for `/api/constituents?type=VOLUNTEER` instead of direct unauthenticated fetch base-url handling.
- Letters execution-lane policy gap closed for this pass: `server/src/routes/letters.ts` now enforces persisted workflow settings in print/mail queue action endpoints and batch generation queue defaults (approval gates, direct-mail queue policy, address-validation policy, and default priority behavior).
- Steward Paths retry/backoff gap closed for this pass: `server/src/services/steward-paths-worker.ts` now applies adaptive exponential backoff after failed poll passes (with capped delay, consecutive-failure tracking, and live backoff diagnostics in worker status).
- Ogentic audit completed: `app/ogentic/page.tsx` is a clean compatibility redirect to `/?steward=open`, so it no longer needs to stay on the gap list as a standalone unfinished workspace.
- Board audit completed: `app/board/page.tsx` and `app/components/board/BoardDashboard.tsx` are clean and route to a real board-summary view, but the donor-status breakdown still uses illustrative percentages pending fuller board reporting data.
- Automations audit completed: `app/automations/page.tsx` is a clean compatibility redirect to `/steward-paths?deprecated=automations`, so it no longer needs to stay open as a separate unfinished workspace.
- Remaining unchecked items now include explicit "Needs done" notes directly under the checklist so the next passes can work from a concrete gap list instead of a blank audit sheet.
