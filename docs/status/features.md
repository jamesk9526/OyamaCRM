# OyamaCRM Feature Status Audit

_Last deep audit: 2026-05-09_

## Audit Rules

This document treats a feature as complete only when it uses real data, saves correctly, handles error/empty/loading states, and supports the intended user workflow.

## Master Status Table

| Area | Feature | Status | Data Source | Notes | Next Step |
|---|---|---|---|---|---|
| Donor CRM | Dashboard cards + KPI summary | Working | Real API Data | `app/page.tsx` loads `/api/reports/summary` and `/api/reports/donor-retention`. | Add explicit loading/error UI for every widget card. |
| Donor CRM | Constituent list + search/filter | Working | Real API Data | `app/constituents/page.tsx` reads `/api/constituents` with query filters. | Add pagination + saved filters/segments. |
| Donor CRM | Constituent profile + notes + timeline | Working | Real API Data | `app/constituents/[id]/page.tsx` reads `/api/constituents/:id`; notes saved through `POST /api/constituents/:id/notes`. | Add richer timeline grouping and event filtering. |
| Donor CRM | Donations CRUD + donation import | Working | Real API Data | `app/donations/page.tsx`, `server/src/routes/donations.ts`, `/api/donations/import` are wired. | Add rollback support and receipt automation. |
| Donor CRM | Campaign management | Working | Real API Data | `app/campaigns/page.tsx` is backed by `/api/campaigns` CRUD. | Add campaign attribution reporting from events + communications. |
| Donor CRM | Tasks | Working | Real API Data | `app/tasks/page.tsx` is backed by `/api/tasks` CRUD. | Add task templates and bulk assignment from segment results. |
| Donor CRM | Communications campaign CRUD | Partial | Mixed Real/Demo Data | Email campaign records are persisted via `/api/email-campaigns`; delivery analytics are simulated in current flow. | Add provider webhook ingestion for delivery/open/click metrics and unsubscribe events. |
| Donor CRM | Steward Paths (automation workflows) | Partial | Real API Data | `/api/automations` rules execute action steps with triggerConfig guardrails; run history is available in UI/API and the in-process worker handles task-due + pledge timeline triggers. | Add retries/backoff, worker controls, and advanced run-history filtering/export. |
| Donor CRM | Email/newsletter builder | Partial | Mixed Real/Demo Data | Builder stores structure/content in DB; advanced merge fields/media pipeline are incomplete. | Add merge fields, media uploads, and timeline writeback per recipient. |
| Donor CRM | Reports | Working | Real API Data | `app/reports/page.tsx` consumes summary/monthly/retention/top donor/campaign APIs. | Add scheduled report delivery and server-side export jobs. |
| Donor CRM | Import wizard (constituents + donations) | Working | Real API Data | Import wizard posts to `/api/constituents/import`; donation wizard posts to `/api/donations/import`. | Add import history and rollback tooling. |
| Donor CRM | Merge workflow | UI Only | Static Demo UI | `app/data-tools/merge/MergeWorkflow.tsx` is preview-first and not yet wired to merge endpoint writes. | Implement backend merge endpoint and explicit conflict resolution. |
| Donor CRM | Volunteers page | Needs Review | Real API Data | `app/volunteers/page.tsx` uses direct `fetch` to `/api/constituents?type=VOLUNTEER`; behavior differs from `apiFetch` helper pattern. | Switch to `apiFetch` and validate auth/session consistency. |
| Compassion CRM | Dashboard | Placeholder Data | Hardcoded Placeholder | `app/compassion/dashboard/page.tsx` uses static arrays and TODO markers for live API replacement. | Create Compassion API + schema and wire dashboard cards/charts. |
| Compassion CRM | Clients, cases, appointments, services, reports | UI Only | Static Demo UI | Most `/app/compassion/*` routes render placeholder shells/coming soon pages only. | Build models and API routes, then replace placeholders incrementally. |
| Compassion CRM | Search/filtering + intake/import tools | Not Started | Unknown / Needs Verification | No Compassion-specific search endpoints or import routes found. | Add Compassion data tools and scoped filters after client/case schema launch. |
| Compassion CRM | Module permissions | Partial | Unknown / Needs Verification | `app/compassion/layout.tsx` includes TODO for workspace permission enforcement. | Add module-level authorization middleware and role checks. |
| Events CRM | Event registry + setup | Working | Real API Data | `app/events/list` + `app/events/dashboard` call events APIs in `server/src/routes/events.ts`. | Add visibility policy controls and registration publishing controls. |
| Events CRM | Orders + guests + tables + check-in | Working | Real API Data | `app/events/orders|guests|tables|check-in` are wired to DB-backed event endpoints. | Add reconciliation workflows for unlinked/duplicate guests. |
| Events CRM | Event reports + donor activity sync | Working | Real API Data | `/events/reports` uses `/api/events/reports/*`; event actions write `Activity` entries in `events.ts`. | Add sponsor, ticket-type, and export reporting slices. |
| Events CRM | Tickets, sponsors, communications, tasks, volunteers, files, settings | UI Only | Static Demo UI | These routes use `app/components/events/EventsWorkspacePage.tsx` with static metrics/text only. | Build dedicated APIs and replace each scaffold with live data pages. |
| Events CRM | Public ticketing page + hosted checkout | Not Started | Unknown / Needs Verification | No public ticket storefront route/API is currently wired. | Implement event ticket type CRUD + public registration page generation. |
| Platform | Authentication + session | Working | Real API Data | JWT auth, refresh, logout, and `/api/auth/me` are active. | Add MFA, session list, and revocation UI. |
| Platform | Users management | Working | Real API Data | Settings users page is wired to `/api/users` CRUD + password reset. | Add invite flow and user onboarding emails. |
| Platform | Audit logs | Working | Real API Data | Settings audit page reads `/api/audit-logs` with filter/pagination. | Add exports and saved filter presets. |
| Platform | Roles & scopes matrix | UI Only | Hardcoded Placeholder | `app/settings/roles/page.tsx` currently presents static role content. | Build persisted role matrix editor + permission inheritance controls. |
| Platform | Payments portal | Placeholder Data | Mock Data | `app/components/payments/*` tabs are mock/simulated data with TODO comments. | Build `/api/payments/*` and provider integration flows. |
| Platform | Version/build/status visibility | Working | Real API Data | `/api/health`, settings system page, and system status show version/build metadata. | Add release notes/changelog UI and deployment history. |
| Growth Tools | Blog Builder | Not Started | Unknown / Needs Verification | No blog model/API/UI exists in app or server directories. | Implement blog module (editor, publish flow, public feed/post, embeds). |
| Growth Tools | Website Embed System | Not Started | Unknown / Needs Verification | No generic embed generator for widgets/forms/blog/events is present. | Build iframe/script/hosted embed pipeline with branding controls. |
| Growth Tools | Event Manager CRM expansion | Partial | Mixed Real/Demo Data | Core operations exist; ticketing/sponsor/public workflows are still scaffolded. | Prioritize ticket types, sponsor CRUD, and public event registration pages. |

## Real Data vs Demo Data Audit

### Donor CRM

- **Real data confirmed:** dashboard summaries/reports (`app/page.tsx` + `server/src/routes/reports.ts`), constituent CRUD and profile timeline (`app/constituents/*`, `server/src/routes/constituents.ts`), donation CRUD/import (`app/donations/page.tsx`, `server/src/routes/donations.ts`), campaign CRUD (`server/src/routes/campaigns.ts`), tasks (`server/src/routes/tasks.ts`), audit/users/settings routes.
- **Mixed/partial:** email campaigns are persisted but runtime delivery telemetry is incomplete; Steward Paths automation executes across direct and scheduled triggers with run-history traces, but still needs retry/backoff and deeper operations tooling (`server/src/routes/email-campaigns.ts`, `server/src/routes/automations.ts`, `server/src/services/stewardPathsEngine.ts`, `server/src/services/steward-paths-worker.ts`).
- **UI/demo-only:** merge workflow actions are still preview-focused without backend merge write (`app/data-tools/merge/MergeWorkflow.tsx`).

### Compassion CRM

- **Real data confirmed:** module shell/auth gate only (`app/compassion/layout.tsx`).
- **Placeholder/demo:** dashboard metrics/charts/schedules are hardcoded static datasets (`app/compassion/dashboard/page.tsx`).
- **UI-only routes:** clients/cases/appointments/reports/data-tools/settings paths are mostly placeholder pages under `app/compassion/*`.

### Events CRM

- **Real data confirmed:** event CRUD, orders, guests, tables, check-in, reports, and donor timeline sync (`server/src/routes/events.ts`; `app/events/orders`, `app/events/guests`, `app/events/tables`, `app/events/check-in`, `app/events/reports`).
- **Mixed:** dashboard/registry combine real API responses with static narrative/status cards (`app/events/dashboard/page.tsx`, `app/events/list/page.tsx`).
- **UI-only:** tickets/sponsors/communications/tasks/volunteers/files/settings/fundraising scaffolds are static workspace pages (`app/events/*/page.tsx` using `app/components/events/EventsWorkspacePage.tsx`).

## Major Planned TODOs (Requested Additions)

1. **Blog Builder Tool (major tool):** blog editor, draft/publish, tags/categories, SEO fields, slug control, revisions, public feed/page, embed-safe styling, iframe/script embeds, RSS/sitemap support.
2. **Website Embed Tools:** reusable widget output for donation forms, newsletter signup, blog feed, event tickets, volunteer signup, contact/resource forms, appointment requests as iframe/script/hosted links.
3. **Event Manager CRM Expansion:** ticket types, public registration pages, sponsors, seating, QR check-in, walk-ins, badges, event communications, post-event donor follow-up.
4. **Data Mapping Import Tool Completion:** saved templates, duplicate detection and merge actions, import history, error reporting, rollback/safe review, support for donor/client/event/sponsor datasets.
5. **Email/Newsletter Builder Completion:** richer blocks/media support, merge fields, audience segments, scheduling, test sends, delivery/open/click metrics, profile history, unsubscribe compliance.
6. **Shared Constituent Timeline Completion:** donation, event attendance/orders, sponsorships, communications, tasks, imports, and Compassion interactions in one timeline model.
7. **Versioning + Production Readiness Visibility:** explicit app version/build/changelog page plus status labels showing complete/partial/demo-only features.
