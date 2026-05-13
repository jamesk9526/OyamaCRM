# OyamaCRM Feature Status Audit

_Last deep audit: 2026-05-13_

## 2026-05-13 Donor Engagement Unified System Refactor — Phase 4 partial (visual builder skeleton)

| Area | Status | Evidence | Notes |
|---|---|---|---|
| `app/components/steward-paths/` workspace components | Working | `app/components/steward-paths/StewardPathBuilderPage.tsx`, `WorkflowCanvas.tsx`, `NodePalette.tsx`, `NodeInspector.tsx`, `WorkflowNodeCard.tsx`, `palette-catalog.ts`, `workflow-types.ts` | Three-panel skeleton (palette / canvas / inspector) with structured-card fallback for the visual map. Full palette catalog includes Triggers, Timing, Email, Print, Task, Donor Data, Logic, and Safety blocks; each block carries an honest "Working / Partially Working / Not Implemented" readiness badge. |
| `/steward-paths/builder` route | Working | `app/steward-paths/builder/page.tsx` | Mounted as a preview surface so reviewers can interact with the new builder. The production editor remains at `/automations` until persistence wiring lands. |
| Visual builder persistence (save/load against `/api/steward-paths`) | Not Implemented | `app/components/steward-paths/StewardPathBuilderPage.tsx` | Skeleton edits the document in memory only. Save and Run Test Enrollment buttons are visibly disabled with tooltips explaining the limitation. |
| Drag-and-drop reordering | Not Implemented | `app/components/steward-paths/WorkflowNodeCard.tsx` | Up/Down/Remove buttons provide the structured-card fallback. Drag/drop is a progressive enhancement for a later pass. |
| Branch edges in the canvas | Not Implemented | `app/components/steward-paths/workflow-types.ts` | `WorkflowEdge` type is defined; canvas currently renders linear chains only. Branching UI lands with Phase 5 step execution. |

## 2026-05-13 Donor Engagement Unified System Refactor — Phase 2 (UI relabeling, shared status) and Phase 3 partial (shared service contracts foundation)

Status labels used in this section are restricted to:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Shared engagement status vocabulary helpers | Working | `app/lib/engagement-status.ts`, `tests/unit/engagement-status.test.ts` | Pure module mapping channel-specific backend statuses (email/letter/path-draft/path-step-run/path-enrollment/task) to the locked user-facing labels with chip tones. 10 unit tests. |
| Shared engagement orchestration helpers | Working | `app/lib/engagement-orchestration.ts`, `tests/unit/engagement-orchestration.test.ts` | Pure helpers for delay math (`addEngagementDuration`, `computeDelayScheduledFor`), communication-preference checks (`canContactConstituent`), and branch rule evaluation (`evaluateBranchRule`). 17 unit tests. Server engine still uses its private copies until cutover in a later Phase-3 pass. |
| Communications "Letters" tab → discovery card | Working | `app/communications/page.tsx` | Tab is now labeled "Letters & Printables ↗" and renders an explicit notice + link cards pointing to `/letters-printables` instead of duplicating queue UI. |
| Steward Paths shared status legend uses tone palette | Working | `app/automations/page.tsx` | Legend now sources `ENGAGEMENT_STATUS_LEGEND` and renders chips with tones from `getEngagementStatusChipClass`. |
| Steward Paths `SEND_EMAIL` UI label | Working | `app/automations/page.tsx`, `app/components/automations/NewAutomationModal.tsx`, `app/components/automations/AutomationWorkflowEditorModal.tsx` | Renamed from "Send email" to "Create review-required email" to match the actual draft-first behavior. Backend value `SEND_EMAIL` unchanged for backwards compatibility. |
| Canonical `/steward-paths` URL | Working | `app/steward-paths/page.tsx` | Thin Next.js redirect points to `/automations`. Establishes the canonical URL ahead of the Phase 4 visual builder; sidebar will be flipped when the new builder lands. |
| Steward Paths visual node-based builder | Not Implemented | `app/automations/page.tsx`, no `app/components/steward-paths/` builder components | Phase 4 of the refactor doc. |
| Steward Paths `BRANCH_PLACEHOLDER` execution | Not Implemented | `server/src/services/steward-paths-sequence-engine.ts` | Step is skipped at runtime; planned for Phase 5. |
| Steward Paths `STATUS_CHANGE` execution | Not Implemented | `server/src/services/steward-paths-sequence-engine.ts` | Step is skipped at runtime; planned for Phase 5. |
| Steward Paths `SEND_EMAIL` auto-send | Not Implemented | `server/src/services/steward-paths-sequence-engine.ts` | Routes through draft-first; auto-send remains gated by `email_auto_send` permission and intentionally not enabled. |
| Sequence engine cutover to shared helpers | Not Implemented | `server/src/services/steward-paths-sequence-engine.ts` | Engine still uses private `addDuration`. Cutover deferred until visual builder lands so the cutover and parity tests ship together. |
| Legacy `stewardPathsEngine.ts` retirement | Not Implemented | `server/src/services/stewardPathsEngine.ts`, `server/src/services/steward-paths-worker.ts` | Legacy and sequence engines coexist intentionally. |

## 2026-05-13 Donor Engagement Unified System Refactor — Phase 1 (audit + docs)

Status labels used in this section are restricted to:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

This pass is documentation-only. No application code, schema, or routes were changed. Phase 2 onward will land incrementally per `docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md`.

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Incremental workspace refactor permission | Working | `AGENTS.md` `incremental-workspace-refactor-rules` | New rule explicitly allows controlled, test-backed workspace refactors with backwards-compatibility safeguards. |
| Unified donor engagement refactor plan | Working | `docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md` | Documents current state, ownership boundaries, backwards-compatibility contract, phased plan, test plan, and risks. |
| Steward Paths visual node-based builder | Not Implemented | `app/automations/page.tsx`, no `app/components/steward-paths/` directory | Current page is structured-card automation list; visual builder skeleton planned in Phase 4. |
| Steward Paths `BRANCH_PLACEHOLDER` execution | Not Implemented | `server/src/services/steward-paths-sequence-engine.ts` | Step is skipped at runtime; planned for Phase 5. |
| Steward Paths `STATUS_CHANGE` execution | Not Implemented | `server/src/services/steward-paths-sequence-engine.ts` | Step is skipped at runtime; planned for Phase 5. |
| Steward Paths `SEND_EMAIL` auto-send | Not Implemented | `server/src/services/steward-paths-sequence-engine.ts` | Step routes through draft-first behavior; auto-send remains gated by `email_auto_send` permission and intentionally not enabled. |
| Letters tab inside Communications (overlap) | Partially Working | `app/communications/page.tsx` | Letters tab still rendered alongside email tabs; Phase 2 will replace with a discovery card linking to `/letters-printables`. |
| Letters & Printables print/mail workflows | Partially Working | `server/src/routes/letters.ts`, `app/components/letters/*` | Templates, generated, queue actions, batch, and letter→email-draft bridge are real; PDF export remains partial. |
| Communications email lifecycle | Partially Working | `app/communications/page.tsx`, `server/src/routes/email-campaigns.ts` | Campaign CRUD/scheduling/send/delivery events live; deeper log filtering and export remain partial. |
| Shared engagement status vocabulary surfaced in UI | Partially Working | `docs/DONOR_ENGAGEMENT_SYSTEM.md` | Vocabulary defined; not yet applied consistently across all channel chips — planned for Phase 2. |
| Legacy `stewardPathsEngine.ts` retirement | Not Implemented | `server/src/services/stewardPathsEngine.ts`, `server/src/services/steward-paths-worker.ts` | Legacy and sequence engines coexist intentionally; retirement is not started until Phase 3 confirms parity. |

## 2026-05-12 Readiness Audit Refresh

This file remains useful for feature context, but release-readiness authority is:
`docs/status/production-readiness-checklist.md`

Centralized status labels are locked to:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

Current release-gate snapshot from the 14-command audit run:

- Lint lane: Broken (`pnpm lint` exited 1 with 13 errors)
- Typecheck lane: Working (`pnpm typecheck`, `pnpm typecheck:web`, `pnpm typecheck:server` all exited 0)
- Smoke lane: Working (`pnpm test:smoke` 151 passed)
- E2E lane: Broken (`pnpm test:e2e`, `pnpm test:e2e:mobile`, `pnpm test:e2e:livecom` all exited 1)
- Test + coverage lane: Working (`pnpm test` and `pnpm test:coverage` exited 0)
- Build lane: Working (`pnpm build`, `pnpm build:server` exited 0)
- Prisma generation lane: Broken (`pnpm db:generate` exited 1 with Windows `EPERM` rename failure)
- Migration safety lane: Working (`pnpm db:verify:linux-casing` exited 0)

Dated evidence docs:

- `docs/status/readiness-audit-2026-05-12.md`
- `docs/status/testing-coverage-audit-2026-05-12.md`
- `docs/status/e2e-coverage-audit-2026-05-12.md`
- `docs/status/smoke-coverage-audit-2026-05-12.md`
- `docs/status/build-and-typecheck-audit-2026-05-12.md`

Do not use this file alone to declare production readiness.

## 2026-05-12 Donor Engagement Integration Pass

Status labels used in this section are restricted to:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Donor engagement architecture docs | Working | `docs/DONOR_ENGAGEMENT_SYSTEM.md`, `docs/DONOR_CRM_COMMUNICATIONS_AUDIT.md` | Shared tool relationships are now documented as one system. |
| Communications workspace as outreach hub | Partially Working | `app/communications/page.tsx` | New tabbed hub (overview/campaigns/drafts/letters/templates/segments/queue/log/settings) is live; deeper filters/export remain in progress. |
| Donation acknowledgment quick-action loop | Working | `app/components/donations/DonationTable.tsx`, `app/donations/page.tsx`, `server/src/routes/donations.ts` | Mark Thanked now persists through API and appears in donation row actions. |
| Constituent quick actions into engagement tools | Working | `app/constituents/[id]/page.tsx` | Added direct actions for communication, letters, paths, tasks, meetings. |
| Campaign quick actions into engagement workflows | Working | `app/campaigns/[id]/page.tsx` | Added campaign-level links for email campaign, appeal letter, follow-up path. |
| Email Builder campaign studio UX and donor block library | Partially Working | `app/components/email-builder/EmailBuilderApp.tsx`, `app/components/email-builder/BlockPalette.tsx`, `app/lib/email-builder-types.ts` | Workflow stage indicator, review checklist, grouped merge fields, canvas controls, and donor-specific blocks were added; reusable sections persistence and revision history remain not implemented. |
| Shared email subscription and unsubscribe compliance layer | Partially Working | `server/src/routes/email-preferences.ts`, `server/src/services/email-compliance.ts`, `docs/DONOR_CRM_EMAIL_COMPLIANCE.md` | Tokenized preferences/unsubscribe flows, suppression-aware eligibility checks, and donor profile preference controls are now wired; webhook ingestion and full cross-tool propagation remain in progress. |
| Steward Paths visual clarity upgrades | Partially Working | `app/automations/page.tsx` | Added shared status legend and sequence-node cards; full visual canvas builder remains in progress. |

## 2026-05-12 Donor Grants Research Workspace Pass

Status labels used in this section are restricted to:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Grants research-workspace reframing | Working | `app/grants/page.tsx`, `app/components/grants/GrantStats.tsx`, `app/components/grants/GrantsCommandPanel.tsx` | Primary grants language shifted from pipeline framing to research/deadline/writing workflows. |
| Grant case-file detail tabs | Working | `app/grants/[id]/page.tsx`, `app/components/grants/GrantCaseItemPanel.tsx` | Added dedicated requirements, reminders, tasks, resources, research, and decision views. |
| Grant case-file persistence APIs | Working | `server/src/routes/grants.ts` | Added workspace and grant-level case-item endpoints for reminder/task/resource/requirement records. |
| Grant-specific permissions | Working | `server/src/lib/permissions.ts`, `server/src/routes/grants.ts` | Added and enforced grants permission keys for viewing, editing, funders, deadlines, tasks, resources. |
| Donation separation for grants | Working | `app/grants/[id]/page.tsx`, `app/donations/new/page.tsx` | Award handoff now routes to Donations flow; grants do not auto-create donation ledger rows. |
| Grant calendar/reporting depth | Partially Working | `app/grants/page.tsx` | Deadline and task workspace tabs are live; dedicated calendar and deeper analytics remain in progress. |

## Audit Rules

This document treats a feature as complete only when it uses real data, saves correctly, handles error/empty/loading states, and supports the intended user workflow.

## Master Status Table

| Area | Feature | Status | Data Source | Notes | Next Step |
|---|---|---|---|---|---|
| Donor CRM | Dashboard cards + KPI summary | Working | Real API Data | `app/page.tsx` loads `/api/reports/summary` and `/api/reports/donor-retention`. | Add explicit loading/error UI for every widget card. |
| Donor CRM | Constituent list + search/filter | Working | Real API Data | `app/constituents/page.tsx` reads `/api/constituents` with query filters. | Add pagination + saved filters/segments. |
| Donor CRM | Constituent profile + notes + timeline | Working | Real API Data | `app/constituents/[id]/page.tsx` reads `/api/constituents/:id`; notes saved through `POST /api/constituents/:id/notes`. | Add richer timeline grouping and event filtering. |
| Donor CRM | Donations CRUD + donation import | Working | Real API Data | `app/donations/page.tsx`, `server/src/routes/donations.ts`, `/api/donations/import` are wired. | Add rollback support and receipt automation. |
| Donor CRM | Campaign management | Working | Real API Data | `app/campaigns/page.tsx` now links to `app/campaigns/[id]/page.tsx` for campaign info, full edit, recent donations, and delete workflows backed by `/api/campaigns` CRUD. | Add campaign attribution reporting from events + communications and multi-campaign comparison analytics. |
| Donor CRM | Grants research workspace | Partially Working | Real API Data | Grants route/module now supports case-file reminders/tasks/resources/requirements and donation handoff separation from grant records. | Add dedicated grant calendar view and expanded cross-grant workload/reporting surfaces. |
| Donor CRM | Tasks | Working | Real API Data | `app/tasks/page.tsx` is backed by `/api/tasks` CRUD. | Add task templates and bulk assignment from segment results. |
| Donor CRM | Communications campaign CRUD | Partially Working | Mixed Real/Demo Data | Email campaign records are persisted via `/api/email-campaigns`; delivery analytics are simulated in current flow. | Add provider webhook ingestion for delivery/open/click metrics and unsubscribe events. |
| Donor CRM | Letters & Printables workspace | Partially Working | Real API Data | `/api/letters` plus `/letters-printables` now support template CRUD, rich letter authoring, merge preview, single-letter generation, batch generation, print queue actions, mail queue actions, timeline logging, email draft creation, and persisted workflow policy settings via `/api/letters/workflow-settings`. | Wire true server-side PDF rendering/export and enforce workflow policy settings in queue execution lanes. |
| Donor CRM | Steward Paths (automation + sequence workflows) | Partially Working | Real API Data | Legacy `/api/automations` trigger/action rules remain active, and new sequence APIs at `/api/steward-paths` now support template steps, enrollments, timeline, draft email review, and due-step processing in the worker. | Add full sequence builder UI, branch/status-change execution, and retry/backoff operations tooling. |
| Donor CRM | Email/newsletter builder | Partially Working | Mixed Real/Demo Data | Builder stores structure/content in DB and now includes strict review checks for unknown/malformed merge tokens; advanced saved sections/history and provider validation lanes remain incomplete. | Add reusable sections, revision history, and delivery/timeline writeback per recipient. |
| Donor CRM | Reports | Working | Real API Data | `app/reports/page.tsx` consumes summary/monthly/retention/top donor/campaign APIs. | Add scheduled report delivery and server-side export jobs. |
| Donor CRM | Import wizard (constituents + donations) | Working | Real API Data | Import wizard posts to `/api/constituents/import`; donation wizard posts to `/api/donations/import`. | Add import history and rollback tooling. |
| Donor CRM | Merge workflow | Demo Only | Static Demo UI | `app/data-tools/merge/MergeWorkflow.tsx` is preview-first and not yet wired to merge endpoint writes. | Implement backend merge endpoint and explicit conflict resolution. |
| Donor CRM | Volunteers page | Partially Working | Real API Data | `app/volunteers/page.tsx` uses direct `fetch` to `/api/constituents?type=VOLUNTEER`; behavior differs from `apiFetch` helper pattern. | Switch to `apiFetch` and validate auth/session consistency. |
| Compassion CRM | Dashboard | Demo Only | Hardcoded Placeholder | `app/compassion/dashboard/page.tsx` uses static arrays and TODO markers for live API replacement. | Create Compassion API + schema and wire dashboard cards/charts. |
| Compassion CRM | Clients, cases, appointments, services, reports | Demo Only | Static Demo UI | Most `/app/compassion/*` routes render placeholder shells/coming soon pages only. | Build models and API routes, then replace placeholders incrementally. |
| Compassion CRM | Search/filtering + intake/import tools | Not Implemented | Unknown / Needs Verification | No Compassion-specific search endpoints or import routes found. | Add Compassion data tools and scoped filters after client/case schema launch. |
| Compassion CRM | Module permissions | Partially Working | Unknown / Needs Verification | `app/compassion/layout.tsx` includes TODO for workspace permission enforcement. | Add module-level authorization middleware and role checks. |
| Events CRM | Event registry + setup | Working | Real API Data | `app/events/list` + `app/events/dashboard` call events APIs in `server/src/routes/events.ts`. | Add visibility policy controls and registration publishing controls. |
| Events CRM | Orders + guests + tables + check-in | Working | Real API Data | `app/events/orders|guests|tables|check-in` are wired to DB-backed event endpoints. | Add reconciliation workflows for unlinked/duplicate guests. |
| Events CRM | Event reports + donor activity sync | Working | Real API Data | `/events/reports` uses `/api/events/reports/*`; event actions write `Activity` entries in `events.ts`. | Add sponsor, ticket-type, and export reporting slices. |
| Events CRM | Tickets, sponsors, communications, tasks, volunteers, files, settings | Demo Only | Static Demo UI | These routes use `app/components/events/EventsWorkspacePage.tsx` with static metrics/text only. | Build dedicated APIs and replace each scaffold with live data pages. |
| Events CRM | Public ticketing page + hosted checkout | Not Implemented | Unknown / Needs Verification | No public ticket storefront route/API is currently wired. | Implement event ticket type CRUD + public registration page generation. |
| OyamaWatchdog | Security feed + encrypted vault + admin controls | Partially Working | External DB + Real API Data | `/watchdog` module and `/api/watchdog/*` routes are scaffolded with encrypted secret storage and permission key checks. | Add full permission matrix UI, runbook actions, and production-ready health/alert wiring. |
| OyamaWebMaster | Website command center + site manager + builder shell | Partially Working | Real API Data + Builder Shell | `/webmaster` now includes persisted site metadata, type-based filtering, archive/restore/duplicate lifecycle APIs, quick page creation, and visual builder shell persistence via `/api/webmaster`. | Expand templates, CMS/forms, preflight checks, publish targets, version history, and rollback controls. |
| Platform | Authentication + session | Working | Real API Data | JWT auth, refresh, logout, and `/api/auth/me` are active. | Add MFA, session list, and revocation UI. |
| Platform | Users management | Working | Real API Data | Settings users page is wired to `/api/users` CRUD + password reset. | Add invite flow and user onboarding emails. |
| Platform | Audit logs | Working | Real API Data | Settings audit page reads `/api/audit-logs` with filter/pagination. | Add exports and saved filter presets. |
| Platform | Roles & scopes matrix | Demo Only | Hardcoded Placeholder | `app/settings/roles/page.tsx` currently presents static role content. | Build persisted role matrix editor + permission inheritance controls. |
| Platform | Payments portal | Demo Only | Mock Data | `app/components/payments/*` tabs are mock/simulated data with TODO comments. | Build `/api/payments/*` and provider integration flows. |
| Platform | Version/build/status visibility | Working | Real API Data | `/api/health`, settings system page, and system status show version/build metadata. | Add release notes/changelog UI and deployment history. |
| Growth Tools | Blog Builder | Not Implemented | Unknown / Needs Verification | No blog model/API/UI exists in app or server directories. | Implement blog module (editor, publish flow, public feed/post, embeds). |
| Growth Tools | Website Embed System | Not Implemented | Unknown / Needs Verification | No generic embed generator for widgets/forms/blog/events is present. | Build iframe/script/hosted embed pipeline with branding controls. |
| Growth Tools | Event Manager CRM expansion | Partially Working | Mixed Real/Demo Data | Core operations exist; ticketing/sponsor/public workflows are still scaffolded. | Prioritize ticket types, sponsor CRUD, and public event registration pages. |

## Real Data vs Demo Data Audit

### Donor CRM

- **Real data confirmed:** dashboard summaries/reports (`app/page.tsx` + `server/src/routes/reports.ts`), constituent CRUD and profile timeline (`app/constituents/*`, `server/src/routes/constituents.ts`), donation CRUD/import (`app/donations/page.tsx`, `server/src/routes/donations.ts`), campaign CRUD (`server/src/routes/campaigns.ts`), tasks (`server/src/routes/tasks.ts`), audit/users/settings routes.
- **Mixed/partial:** email campaigns are persisted but runtime delivery telemetry is incomplete; Steward Paths now includes both legacy automations and new sequence processing (`server/src/routes/automations.ts`, `server/src/routes/steward-paths.ts`, `server/src/services/stewardPathsEngine.ts`, `server/src/services/steward-paths-sequence-engine.ts`, `server/src/services/steward-paths-worker.ts`) and still needs retry/backoff and deeper operations tooling.
- **UI/demo-only:** merge workflow actions are still preview-focused without backend merge write (`app/data-tools/merge/MergeWorkflow.tsx`).

### Compassion CRM

- **Real data confirmed:** module shell/auth gate only (`app/compassion/layout.tsx`).
- **Placeholder/demo:** dashboard metrics/charts/schedules are hardcoded static datasets (`app/compassion/dashboard/page.tsx`).
- **UI-only routes:** clients/cases/appointments/reports/data-tools/settings paths are mostly placeholder pages under `app/compassion/*`.

### Events CRM

- **Real data confirmed:** event CRUD, orders, guests, tables, check-in, reports, and donor timeline sync (`server/src/routes/events.ts`; `app/events/orders`, `app/events/guests`, `app/events/tables`, `app/events/check-in`, `app/events/reports`).
- **Mixed:** dashboard/registry combine real API responses with static narrative/status cards (`app/events/dashboard/page.tsx`, `app/events/list/page.tsx`).
- **UI-only:** tickets/sponsors/communications/tasks/volunteers/files/settings/fundraising scaffolds are static workspace pages (`app/events/*/page.tsx` using `app/components/events/EventsWorkspacePage.tsx`).

### OyamaWatchdog

- **Real data confirmed:** module status, feed, and vault APIs are wired through `server/src/routes/watchdog.ts` and `server/src/services/watchdog-store.ts` (with external DB + encryption key requirements).
- **Partial:** dashboard actions and access matrix management are foundational; broader response workflows and automated alerting still need implementation.

### OyamaWebMaster

- **Real data confirmed:** persisted site/page records and site lifecycle APIs are active (`server/src/routes/webmaster.ts`, `server/src/services/webmaster-store.ts`).
- **Partially working:** dashboard site manager and visual builder shell are active (`app/webmaster/*`, `app/components/webmaster/WebmasterStarterDashboard.tsx`) with lifecycle actions and metadata visibility.
- **Not implemented:** production publish targets, rollback history/version table, and full preflight validation pipeline.

## Major Planned TODOs (Requested Additions)

1. **Blog Builder Tool (major tool):** blog editor, draft/publish, tags/categories, SEO fields, slug control, revisions, public feed/page, embed-safe styling, iframe/script embeds, RSS/sitemap support.
2. **Website Embed Tools:** reusable widget output for donation forms, newsletter signup, blog feed, event tickets, volunteer signup, contact/resource forms, appointment requests as iframe/script/hosted links.
3. **Event Manager CRM Expansion:** ticket types, public registration pages, sponsors, seating, QR check-in, walk-ins, badges, event communications, post-event donor follow-up.
4. **Data Mapping Import Tool Completion:** saved templates, duplicate detection and merge actions, import history, error reporting, rollback/safe review, support for donor/client/event/sponsor datasets.
5. **Email/Newsletter Builder Completion:** richer blocks/media support, merge fields, audience segments, scheduling, test sends, delivery/open/click metrics, profile history, unsubscribe compliance.
6. **Shared Constituent Timeline Completion:** donation, event attendance/orders, sponsorships, communications, tasks, imports, and Compassion interactions in one timeline model.
7. **Versioning + Production Readiness Visibility:** explicit app version/build/changelog page plus status labels showing complete/partial/demo-only features.

## Donor CRM Completion Plan (2026-05-10)

## DonorCRM Feature Key Registry (2026-05-12)

| Key | Status | Source Route Or API | Notes |
|---|---|---|---|
| donor.dashboard | Partially Working | `app/page.tsx` | Command-center triage widgets are improving; continue action-first workflow links. |
| donor.constituents | Working | `app/constituents/page.tsx` + `/api/constituents` | API-backed list/search/filter. |
| donor.constituentProfile | Working | `app/constituents/[id]/page.tsx` + `/api/constituents/:id` | Includes giving/tasks/timeline and letters panel hooks. |
| donor.donations | Working | `app/donations/page.tsx` + `/api/donations` | CRUD and stats endpoints live. |
| donor.campaigns | Working | `app/campaigns/*` + `/api/campaigns` | List/detail/edit workflows are API-backed. |
| donor.grants | Partially Working | `app/grants/*` + `/api/grants` | Research workspace + case-file APIs are live; calendar/reporting depth remains in progress. |
| donor.payments | Partially Working | `app/payments/page.tsx` | Ledger is live; processor tooling intentionally in development. |
| donor.tasks | Working | `app/tasks/page.tsx` + `/api/tasks` | Task CRUD and bulk assignment live. |
| donor.meetings | Working | `app/meetings/page.tsx` + `/api/meetings` | Scheduling and completion flows are live. |
| donor.communications | Partially Working | `app/communications/*` + `/api/email-campaigns` | Core persistence is live; delivery telemetry depth varies by provider setup. |
| donor.lettersPrintables | Partially Working | `app/letters-printables/*` + `/api/letters` | Single and batch generation plus print/mail queue workflows are functional; server-side PDF export remains partial. |
| donor.livecom | Working | `app/livecom/page.tsx` + `/api/livecom` | Interaction capture writes to timeline activity. |
| donor.stewardPaths | Partially Working | `app/automations/page.tsx`, `/api/automations`, `/api/steward-paths` | Legacy and sequence workflows run together; builder depth still growing. |
| donor.stewardSignals | Partially Working | `app/steward-signals/page.tsx` + `/api/steward-signals` | Suggestion-first insights; keep human review required. |
| donor.volunteers | Partially Working | `app/volunteers/page.tsx` | Real data list with auth-helper consistency gap. |
| donor.reports | Working | `app/reports/page.tsx` + `/api/reports/*` | Broad report coverage and exports are available. |
| donor.dataTools | Partially Working | `app/data-tools/*` | Import/export/data-quality tooling is live; merge depth still in progress. |
| donor.customFields | Working | `app/custom-fields/page.tsx` + `/api/custom-fields` | Full CRUD for custom donor schema extensions. |

This plan targets donor-side partial features in delivery order and keeps campaign improvements as the first completed step.

### Step 0 (Started)

- Campaign detail and edit/remove completion:
	- Added dedicated campaign info route (`app/campaigns/[id]/page.tsx`).
	- Added list-to-detail navigation from campaign cards.
	- Added full campaign edit fields (name/category/goal/dates/description/active) and delete action in detail page.

### Step 1 (Next)

- Communications telemetry hardening:
	- Persist provider send lifecycle webhooks (delivered/open/click/bounce/unsubscribe).
	- Show campaign-level delivery diagnostics in communications workspace.

### Step 2

- Merge workflow completion:
	- Wire backend merge endpoint for constituent conflict resolution.
	- Replace preview-only merge actions with explicit write + audit events.

### Step 3

- Reports and export readiness:
	- Add permission-gated export endpoints and queued export jobs.
	- Add saved report presets and report freshness indicators.

### Step 4

- Task and stewardship acceleration:
	- Add task templates and segment-driven bulk task assignment.
	- Add stewardship template automation hooks and run diagnostics.

### Step 5

- Volunteer/auth consistency cleanup:
	- Move volunteer route calls to `apiFetch` pattern everywhere.
	- Validate auth/session behavior parity with donor pages.

## CRM Organization And Usability Audit (2026-05-10)

Audit objective: reduce duplicated paths, clarify module boundaries, and make unfinished surfaces visibly in development.

Completed in this pass:

- Added Event Workspace Selector route (`app/events/workspace/page.tsx`) as the clear event-first entry path.
- Rewired Events dashboard quick actions to event-scoped workflow entry instead of ambiguous global paths.
- Updated event overview quick actions to scoped routes (`/events/[eventId]/...`).
- Added compatibility warning banner for legacy global events tool routes in `app/events/layout.tsx`.
- Added explicit in-development warning banner to scaffolded Events workspace pages (`app/components/events/EventsWorkspacePage.tsx`).
- Simplified Apps launcher to core modules/shared workspaces and removed overlapping duplicate app tiles (`app/components/layout/AppsDrawer.tsx`).
- Reduced Settings sidebar overlap by removing duplicate/low-signal entries from primary navigation (`app/components/settings/SettingsSidebar.tsx`).
- Clarified StewardAI vs OGentic roles in workspace headers (`app/components/ai/StewardAIWorkspace.tsx`, `app/components/ogentic/OGenticWorkspace.tsx`).

Source-of-truth organization map:

- `docs/status/crm-organization-map.md`
