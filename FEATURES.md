# OyamaCRM — Complete Feature Inventory

> Version 1.1.0 · Last updated: 2026-05-18
>
> Status labels: **Working** | **Partially Working** | **Demo Only** | **Broken** | **Not Implemented**

---

## Platform & Shell

| Feature | Status | Notes |
|---|---|---|
| First-run setup wizard | Working | `/setup` — org profile, admin account, email provider |
| Module switcher (Donor / Events / Compassion) | Working | TopBar switcher — full scope change per module |
| AppShell (green sidebar + TopBar) | Working | Donor CRM shell |
| CompassionShell (blue sidebar + TopBar) | Working | Compassion CRM shell |
| EventsShell (events sidebar + TopBar) | Working | Events CRM shell |
| Compact breadcrumb bar | Working | Shared `WorkspaceBreadcrumbBar` across all workspaces |
| Ribbon-first workspace commands | Working | `WorkspaceRibbonFrame` with grouped icon-first actions |
| Responsive layout (1280–1440px compact desktop) | Working | Drawer at `<1024`, compact `1024–1439`, full `≥1440` |
| Notification panel (TopBar bell) | Partially Working | UI present; real-time push not yet implemented |
| System runtime status (`/settings/system`) | Working | Version, build date, DB health check |
| System status / readiness matrix (`/settings/system-status`) | Working | Audit-backed feature readiness |

---

## Authentication & User Management

| Feature | Status | Notes |
|---|---|---|
| Login with email/password | Working | JWT-based auth; refresh tokens |
| Setup-time access enforcement | Working | `/api/setup/status` redirects to `/setup` when incomplete |
| Role-based access control | Partially Working | Admin / Staff / Volunteer / Read-only roles defined; enforcement in progress |
| User invite by email | Partially Working | Admin can create users; email invitation flow in progress |
| Password reset | Partially Working | Backend route present; email delivery depends on email provider |
| Session timeout | Partially Working | JWT expiry in place; configurable timeout not yet surfaced in UI |
| Two-factor authentication | Not Implemented | Planned |

---

## Donor CRM

### Constituents

| Feature | Status | Notes |
|---|---|---|
| Add / edit constituent | Working | Full profile form with all contact fields |
| Constituent list with search & filters | Working | Sortable, filterable list with pagination |
| Constituent profile & activity timeline | Working | Giving history, tasks, emails, notes in one view |
| Household relationship linking | Partially Working | Household field present; household-scoped views in progress |
| Soft credits | Not Implemented | Planned |
| Wealth screening indicators | Not Implemented | Planned |
| Communication preference flags | Working | doNotEmail, doNotMail, doNotCall, doNotContact enforced in sends |
| Tags and custom segments | Working | Tag library, bulk tagging, tag descriptions for staff context |
| Duplicate detection and merge | Working | `DuplicateConstituentMergeTool` — approve/decline merge rows |
| Constituent export (CSV) | Working | Export from list view |
| Import constituents from CSV | Working | Guided import with field mapping, duplicate detection |
| HubSpot contacts import preset | Working | Maps HubSpot email lists into tags |

### Donations

| Feature | Status | Notes |
|---|---|---|
| Record one-time gift | Working | Amount, date, designation, payment method, acknowledgment |
| Recurring gift setup | Working | Frequency, start date, health indicators for failed payments |
| Pledge management | Partially Working | Pledge records and payment tracking; fulfillment % UI in progress |
| Batch gift entry | Partially Working | Bulk entry UI scaffolded; backend batch endpoint in progress |
| In-kind donation tracking | Not Implemented | Planned |
| Receipt generation | Partially Working | Receipt field tracked; PDF generation not yet implemented |
| Tax acknowledgment letters | Partially Working | Letter generation available; bulk-send batch in progress |
| Donation import from CSV | Partially Working | Donation type supported in guided import; validation in progress |
| Donation export | Working | CSV export from donations list |
| QuickBooks opt-in queue | Working | Manual sync queue with PENDING/SYNCED/FAILED/SKIPPED states |

### Campaigns

| Feature | Status | Notes |
|---|---|---|
| Create / edit campaign | Working | Name, goal, dates, designation, active flag |
| Campaign progress tracking | Working | Revenue raised vs goal in campaign detail |
| Multi-channel campaign support | Partially Working | Email campaigns linked; direct mail and social in progress |
| Peer-to-peer fundraising | Not Implemented | Planned |
| Matching gift tracking | Not Implemented | Planned |

### Communications & Email

| Feature | Status | Notes |
|---|---|---|
| Email campaign builder (3-panel studio) | Working | Block library, canvas, inspector; draft-first |
| Audience targeting from segments | Working | Load saved Contacts Manager audience lists |
| Campaign draft / needs-review / scheduled / sent lifecycle | Working | Explicit status labels; review-first default |
| Send-test before full send | Working | Test send to admin address |
| Compliance footer in campaigns | Working | Required compliance token validation before broad sends |
| Email open/click tracking | Working | Provider webhook ingestion plus campaign delivery diagnostics are live in the activity workspace |
| Email builder reusable sections | Working | Save selected blocks as reusable snippets and reinsert them in campaign editor flows |
| Email builder revision history | Working | Campaign review tab now surfaces create/update/send audit history from campaign activity logs |
| Communication preference enforcement | Working | Suppresses doNotEmail, emailOptOut, unsubscribed recipients |
| Microsoft 365 SMTP provider | Working | Full SMTP config + test send |
| Microsoft Graph OAuth provider | Working | OAuth connect flow, Mail.Send permission, test send |
| Standard SMTP provider | Working | Custom SMTP host/port/TLS/credentials + test send |
| Unsubscribe handling | Working | Opt-out fields enforced on every send |
| Email preference categories | Working | Category-level opt-in/out for different communication types |
| Scheduled sends | Working | `schedule` endpoint; sends at configured time |
| Campaign cancel | Working | Cancel reverts scheduled campaigns to draft |
| Audience preview before send | Working | `audience-preview` endpoint shows recipient count |

### Letters & Printables

| Feature | Status | Notes |
|---|---|---|
| Letter generation from templates | Working | Generate from templates with server-side single and batch PDF export endpoints |
| Print queue (Needs Review → Approved → Printed → Mailed) | Partially Working | Queue actions are live and now enforce workflow policy approval/direct-mail gates |
| Mail queue advancement | Partially Working | Status transitions and address validation policy enforcement are live; carrier integration remains pending |
| Letter-to-email handoff | Working | Generated letters can create linked email drafts |
| Print permission controls | Working | `letters.manage_print_queue` / `letters.manage_mail_queue` permissions are enforced on queue action APIs |

### Tasks & Workflow

| Feature | Status | Notes |
|---|---|---|
| Create / edit tasks with due date, priority, assignee | Working | Full task CRUD |
| Task status (pending / in-progress / completed) | Working | All status transitions |
| Task linked to constituent | Working | Constituent timeline shows related tasks |
| Task templates for stewardship workflows | Partially Working | Templates scaffolded; auto-trigger from steward paths |
| Overdue task notifications | Partially Working | Notification panel shows overdue tasks |

### Steward Paths

| Feature | Status | Notes |
|---|---|---|
| Create / edit engagement sequences | Working | Multi-step paths with steps |
| Step types: task, email, letter, status-change | Working | All four step types implemented |
| Branch / condition steps | Working | `BRANCH_PLACEHOLDER` with eq/neq/gt/gte/lt/lte/in/not_in operators |
| Status change steps (allow-listed fields) | Working | `buildStatusChangeUpdate` validates target fields |
| Sequence activation and advancement | Working | Paths advance on schedule |
| Audience assignment | Working | Assign path to segment or constituent |

### Reports & Analytics

| Feature | Status | Notes |
|---|---|---|
| Report builder (filter by date, campaign, designation) | Working | Full filter panel + result preview |
| 7 chart types (bar, line, area, pie, donut, composed, scatter) | Working | `ReportViewer` workspace |
| KPI summary cards | Working | Total, average, max per selected metric |
| Multi-metric Y-axis selector | Working | Toggle per metric with color dot |
| Color themes (5) | Working | Green, blue, purple, orange, rainbow |
| Inline editable report title | Working | Click-to-edit pencil |
| Data table panel with sort, filter, column toggle | Working | In ReportViewer |
| CSV and PDF export from reports | Working | Client-side CSV; print-ready PDF layout |
| Donor retention metrics | Partially Working | Report type available; full fiscal-year comparison in progress |
| Scheduled report emails | Not Implemented | Planned |

### Grants

| Feature | Status | Notes |
|---|---|---|
| Grant opportunity records | Working | Funder, amount, deadline, requirements, status |
| Writing task assignments | Working | Tasks linked to grant deadlines |
| Grant stage tracking (Research → Submitted → Awarded) | Working | Status transitions |
| Awarded amount → donation handoff | Working | Explicit handoff flow; no auto-donation creation |
| Deadline reminders | Working | Task-based reminders for grant deadlines |
| Grant resource notes | Working | Notes and file links (no secret storage) |
| Grant assignment notifications | Working | Durable notifications are created for grant assignment/reassignment and surface in TopBar |

### Contacts Manager

| Feature | Status | Notes |
|---|---|---|
| Side-by-side list builder | Working | Select constituents and add to audience list while table stays open |
| Saved audience segments | Working | Named reusable lists for email/letter sends |
| Bulk tag actions | Working | Add/remove tags across selected constituents |
| Duplicate merge tool | Working | Scan, approve/decline, merge with full history transfer |
| Spreadsheet-style grid with sticky headers | Working | Sort, filter, checkbox multi-select |
| Full-screen list workspace | Working | `/contacts-manager/fullscreen` |
| Audience list manager | Working | Preview, load, rename, duplicate, merge, delete saved lists |
| HubSpot import preset | Working | Maps HubSpot fields + email lists into segments |
| Import unsubscribe mapping | Working | Maps HubSpot opt-out fields to donor suppression |

### Integrations

| Feature | Status | Notes |
|---|---|---|
| QuickBooks Online (via `intuit-oauth`) | Working | OAuth connect, donation sync queue, manual trigger |
| QuickBooks disconnect | Working | Revoke token, clear plugin state |
| Webhook outbound (planned) | Not Implemented | — |

### Volunteers

| Feature | Status | Notes |
|---|---|---|
| Volunteer records linked to constituents | Partially Working | Record creation; hour tracking UI in progress |
| Volunteer task assignment | Partially Working | Task assignment UI; reporting in progress |

---

## Events CRM

| Feature | Status | Notes |
|---|---|---|
| Event registry (create/edit events) | Working | Name, date, venue, capacity, status |
| Workspace selector (event-first navigation) | Working | `/events/workspace` selects active event context |
| Event overview dashboard | Partially Working | Check-in progress, revenue, RSVP counts; live data in progress |
| Guest registration | Partially Working | Add guests, RSVP/payment status; bulk registration in progress |
| Guest CSV import | Working | `EventGuestImportWizard` with field mapping |
| Ticket types (individual, table, comp, sponsored) | Partially Working | Ticket model defined; purchase flow in progress |
| Table management (capacity, shape, position) | Working | Round/rectangle tables with capacity and host assignment |
| Seating assignments (guest → table) | Working | Drag-and-drop assignment; over-capacity warnings |
| Seating chart visual | Working | Spatial table layout view |
| Check-in (QR scan / name search / table browse) | Partially Working | Multi-mode UI; QR scanner integration in progress |
| Sponsor management | Partially Working | Sponsor records; package seat-allocation in progress |
| Sponsorship packages with included seats | Partially Working | Package model implemented; auto-assign in progress |
| Table invitation links (tokenized) | Not Implemented | Planned |
| Cross-event reports | Partially Working | Report views available; multi-event comparison in progress |
| Events page builder | Partially Working | Page creation UI; publish flow in progress |
| Events template management | Partially Working | Template store; apply-to-event flow in progress |
| Event orders / payment tracking | Partially Working | Order records; payment processing not yet connected |

---

## Compassion CRM

| Feature | Status | Notes |
|---|---|---|
| Client list with search and filters | Working | Privacy-safe list view |
| Add / edit client profile | Working | Intake form with communication preferences |
| Client activity timeline | Working | Appointments, notes, assessments, referrals in one view |
| Case management | Partially Working | Create case, assign owner, stage tracking; full case workspace in progress |
| Appointments calendar | Working | Day/week/month calendar view |
| Appointment scheduling | Working | Create, edit, reschedule with conflict detection |
| Public scheduling widget (tokenized embed) | Working | Slot generation, submit-time validation, iframe/script embeds |
| Slot availability API | Working | Server-generated slots, configurable policy |
| Client import (CSV with validation) | Working | `clientImportValidator.ts` strict garbage/metadata filtering |
| Follow-up tasks | Partially Working | Task creation; task-list view in progress |
| Assessments | Partially Working | Intake assessment forms; result tracking in progress |
| Pregnancy tests & sonogram records | Partially Working | Record forms present; reporting in progress |
| Referrals | Partially Working | Referral records; follow-up tracking in progress |
| Material assistance / boutique | Not Implemented | Planned |
| Care plans | Not Implemented | Planned |
| Compassion reports | Partially Working | Appointment count, case summary; advanced analytics in progress |
| Client document storage | Not Implemented | Planned |
| Audit log (client-scoped) | Partially Working | Audit events written; client-profile audit view in progress |

---

## Data Tools & Imports

| Feature | Status | Notes |
|---|---|---|
| Guided import wizard (donor / client / events) | Working | Type selection → upload → preview → map → validate → import |
| CSV auto-delimiter detection | Working | Comma, tab, semicolon, pipe; BOM strip |
| Field mapping with auto-map aliases | Working | `fieldMap.ts` — CRM field + alias array per importable field |
| Required field validation | Working | Missing required fields block import commit |
| Duplicate detection (email / phone match) | Working | Merge/update/skip decision per duplicate |
| Import dry-run mode | Working | Preview result without committing |
| Compassion client import with privacy guards | Working | `clientImportValidator.ts` — garbage pattern heuristics |
| Event guest CSV import | Working | `EventGuestImportWizard` with RSVP/payment/check-in mapping |
| Import result summary | Working | Row counts, errors, created/skipped/merged |
| Data export (CSV/Excel) | Partially Working | Most list views; bulk export endpoint in progress |

---

## Settings

| Feature | Status | Notes |
|---|---|---|
| Organization settings (name, address, timezone, FY start) | Working | Full CRUD form |
| Outbound email provider (SMTP / Microsoft 365 / Graph) | Working | Provider selection, credentials, test send |
| Microsoft Graph OAuth connect/disconnect | Working | Full OAuth flow with token storage |
| QuickBooks plugin enable/disable | Working | Plugin toggle + connect/disconnect |
| Security & audit log viewer | Working | Unified security + audit log page |
| User management | Partially Working | List users; invite/edit in progress |
| Integrations workspace | Working | QuickBooks + future connectors |
| Project status / readiness matrix | Working | Embedded in `/settings/system-status` |
| Site embeds manager | Working | Tokenized snippets, domain allow-list, connection test |
| System info page (version, runtime, DB) | Working | `/settings/system` |

---

## Help App

| Feature | Status | Notes |
|---|---|---|
| Help workspace at `/help` | Working | Search, filters, contextual suggestions |
| Article detail at `/help/[slug]` | Working | Full article with walkthrough, images, related guides |
| CRM-scoped search (donor / events / compassion / global) | Working | Scope parameter on all help URLs |
| Local full-text search engine | Working | Weighted phrase + token + fuzzy matching with scope boost |
| Query synonym expansion | Working | 60+ nonprofit-domain expansion rules |
| Typo tolerance (Levenshtein edit distance) | Working | Medium/long tokens; ≤1 edit for 4–7 chars, ≤2 for 8+ |
| Feature readiness boost in ranking | Working | Working articles ranked above Partially Working for same score |
| Category, tag, role, difficulty filters | Working | All four filter dropdowns |
| Contextual route suggestions | Working | 35+ route prefix → tag mappings |
| Help Agent planner | Working | Plain-language → route/article action suggestions |
| Feedback bar ("Was this helpful?") | Working | Per-article feedback control |
| 60+ published help articles | Working | Covers all major CRM modules and workflows |

---

## Webmaster (OyamaWebMaster)

| Feature | Status | Notes |
|---|---|---|
| Site registry (create/edit sites) | Partially Working | Site model with type, owner, module linkage |
| Page management | Partially Working | Page CRUD; publish flow in progress |
| Publishing workflow | Partially Working | Review → publish handoff; deployment integration not yet done |
| CRM module linkage | Partially Working | `connected_module` + `connected_record_id` references |
| Template library | Partially Working | Template store; apply-to-site in progress |
| Media library | Not Implemented | Planned |
| SEO metadata editor | Not Implemented | Planned |

---

## OyamaHRM (Human Resources Module)

| Feature | Status | Notes |
|---|---|---|
| Employee records | Partially Working | Profile form; org chart in progress |
| Scheduling | Not Implemented | Planned |
| PTO and leave management | Not Implemented | Planned |

---

## LiveCom Messenger

| Feature | Status | Notes |
|---|---|---|
| LiveCom inbox (website conversation tracking) | Working | Inbox, assignment, lifecycle updates, and shared notification-center delivery are live; short polling remains the current runtime model |
| Website chat launcher (via site embed) | Working | Launcher button injected via embed snippet |
| Conversation → constituent link | Working | Public intake preserves existing conversation links and auto-matches by exact email or phone before creating a new prospect |
| Notification on new message | Working | Durable donor-module notifications are created for new public LiveCom messages and surface in the shared TopBar notification center |

---

## Steward AI

| Feature | Status | Notes |
|---|---|---|
| AGENTSteward workspace | Working | Full workspace with mode switcher and starter workflows |
| Steward help mode (route + article suggestions) | Working | Deterministic catalog + confidence labels |
| Steward donor context tools (read) | Working | Constituent summaries, giving history, segment info |
| Steward write actions (task create, draft) | Working | Confirmation-gated; draft-first |
| Steward runtime status API | Working | `/api/steward-ai/status` — disabled/connecting/running states |
| Steward donor intelligence | Working | Permission-aware, org-scoped server tools only |
| Steward RAG from Help App articles | Not Implemented | Planned — help articles as grounded source |
| Steward paths AI step suggestions | Not Implemented | Planned |

---

## Desktop App (OyamaBridge)

| Feature | Status | Notes |
|---|---|---|
| OyamaBridge desktop server | Partially Working | Local bridge for desktop integrations |
| Desktop installer | Partially Working | Build tooling present; auto-update not yet done |

---

## Standalone Apps (`/apps/*`)

| Feature | Status | Notes |
|---|---|---|
| Trivia Software app (`/apps/trivia`) | Partially Working | App shell with basic trivia workspace |

---

## Developer / Ops

| Feature | Status | Notes |
|---|---|---|
| Prisma ORM with MySQL | Working | Full migration history |
| Express API server (Node.js) | Working | All CRM API routes |
| Next.js 16 frontend | Working | App Router, Server + Client components |
| pnpm monorepo | Working | Shared workspace at root |
| PM2 process management (`ecosystem.config.cjs`) | Working | Production process config |
| Smoke tests | Working | `pnpm test:smoke` — core endpoint coverage |
| E2E tests (Playwright) | Working | `pnpm test:e2e` — key user flows |
| Unit tests (Vitest) | Working | `pnpm test` — pure function coverage |
| ESLint config | Working | `eslint.config.mjs` |
| TypeScript strict mode | Working | Both `tsconfig.json` and `server/tsconfig.json` |
| Responsive UI audit automation | Working | `scripts/qa/responsive-ui-pass.mjs` |
| Screenshot capture script | Working | `scripts/take-screenshots.mjs` |
| Hostinger deployment guide | Working | `docs/HOSTINGER_DEPLOY_README.md` |
| Demo seed data (small / medium / large) | Working | `pnpm db:seed:medium` — Hope Foundation org with realistic data |

---

*This document is auto-maintained. Update it whenever feature status changes.*
