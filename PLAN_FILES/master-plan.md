# OyamaCRM Master Plan & Status Index

> **Single source of truth.** This file consolidates every phase packet in
> `PLAN_FILES/`, plus the secondary OyamaCRM-Compassion workspace, into one
> living checklist. Each phase links to its detailed packet. Boxes reflect what
> is **shipped today** in `main` vs. what is **pending**.
>
> When you finish a checklist item, tick the box here _and_ in the matching
> phase packet. When a new item emerges, add it here first, then propagate to
> the packet so this index stays authoritative.

---

## 0. How to use this plan

1. **Pick the next unchecked item under the active phase.** Phases are intended
   to ship in order, but small cross-cutting items (tests, docs) can run in
   parallel.
2. **Implement in vertical slices**: schema → API → UI → automation → tests.
3. **Tick the checkbox here when the slice is in `main`.** Add a one-line note
   if the implementation deviates from the packet.
4. **Run gate checks at phase exit**: `pnpm lint`, `pnpm test`, smoke paths,
   seed compatibility (`pnpm db:seed`).
5. **Promote to the next phase only when its exit criteria are met.**

Legend: `[x]` shipped · `[ ]` pending · `[~]` partially shipped (notes inline)

---

## 1. OyamaCRM (donor / fundraising workspace)

### Phase 01 — Foundation & Auth · packet: [`phase-01-foundation-and-auth.md`](./phase-01-foundation-and-auth.md)

- [x] Express API server bootstrapped (`server/src/index.ts`) with health probe
- [x] Auth routes (`/api/auth/login`, `/refresh`, `/logout`, `/me`) wired to Prisma
- [x] First-run setup APIs and `/setup` redirect enforcement (`server/src/routes/setup.ts`, `app/login/page.tsx`, `app/setup/page.tsx`)
- [x] In-memory access token + httpOnly refresh cookie (`app/lib/auth-client.ts`)
- [x] Rate limiting (global 200/min, auth 20/min) via `express-rate-limit`
- [x] Prisma + MySQL schema and seed script (`prisma/seed.ts`)
- [x] AppShell layout (TopBar + Sidebar) and theme tokens
- [x] Settings workspace foundation with dedicated sidebar (`app/settings/layout.tsx`, `app/components/settings/SettingsSidebar.tsx`)
- [x] System version + readiness surfaces (`/settings/system`, `/settings/system-status`, `/api/health`)
- [~] Role/permission middleware — login works; route-level RBAC still partial
- [ ] API response envelope is mixed (`{ data }` vs. raw); standardize to `{ data, error, meta }`
- [ ] Audit-log table exists; write-side hooks only on a few routes — generalize
- [~] PM2 / production startup docs — `ecosystem.config.cjs` exists, but backup/restore and deployment runbook are still missing

### Phase 02 — Constituents & Timeline · packet: [`phase-02-constituents-and-timeline.md`](./phase-02-constituents-and-timeline.md)

- [x] List page with search + type/status filters (`app/constituents/page.tsx`)
- [x] Detail page including donations, tasks, activities, household, tags
- [x] Create flow (`app/constituents/new`) using shared `ConstituentForm`
- [x] Edit flow (`app/constituents/[id]/edit`) using the same form in edit mode
- [x] Auto-create `Household` record when `type === HOUSEHOLD`
- [x] Timeline activity writes on create/update
- [x] Household panel rendering on detail page
- [ ] Soft-credit / influencer relationship modeling
- [ ] Custom fields per constituent
- [ ] Tag management UI (CRUD on `Tag` + bulk apply)
- [ ] Saved segments / smart lists
- [ ] CSV import + dedupe wizard
- [ ] Bulk edit (assign tag, change status, change owner)
- [ ] Wealth-screening indicator surfaces (capacity to give)

### Phase 03 — Donations, Funds, Campaigns · packet: [`phase-03-donations-funds-campaigns.md`](./phase-03-donations-funds-campaigns.md)

- [x] List + filters (search, status, date range) at `/donations`
- [x] New donation flow (`/donations/new`) wired to `POST /api/donations`
- [x] Edit donation flow (`/donations/[id]/edit`) wired to `PUT /api/donations/:id`
- [x] Edit link surfaced from the donations table
- [x] `DELETE /api/donations/:id` for batch-entry corrections (with audit)
- [x] Recurring gift flag + frequency on form
- [x] Campaign + designation selectors on form
- [x] Donation activity timeline write on create
- [x] Campaigns CRUD (`/campaigns`, `routes/campaigns.ts`)
- [x] Designations CRUD (`/api/designations`)
- [ ] Pledge schedule UI (model exists; no pledge entry / payment-application UI)
- [ ] Receipt / acknowledgment generation (PDF + email)
- [ ] Soft-credit attribution at the donation level
- [ ] In-kind valuation workflow
- [ ] Stock / wire confirmations
- [ ] Refund + chargeback flow with linked activity

### Phase 04 — Receipts, Tasks, Communications · packet: [`phase-04-receipts-tasks-communications.md`](./phase-04-receipts-tasks-communications.md)

- [x] Tasks list with status/type filters, complete + delete actions
- [x] New Task modal
- [x] Task PATCH endpoint writes timeline activity
- [x] Email Builder MVP (`/email-builder`, `app/lib/email-builder-utils.ts`)
- [x] Email campaigns CRUD + stats endpoint
- [~] Communication send controls — preview, audience preview, send test, schedule, cancel exist; media uploads and timeline logging do not
- [ ] **Inline edit on task rows** (priority / due date / assignee), not just complete
- [ ] Task templates (7-day thank-you, 30-day impact update)
- [ ] Bulk task creation from a segment
- [ ] Acknowledgment letter / receipt template engine
- [ ] Mail-merge export to PDF / DOCX
- [~] Email send pipeline + bounce/open tracking — SMTP-backed send/test exists, but provider event tracking does not
- [ ] Communications history per constituent
- [ ] SMS provider abstraction (placeholder only)

### Phase 05 — Dashboard & Reports · packet: [`phase-05-dashboard-and-reports.md`](./phase-05-dashboard-and-reports.md)

- [x] Home dashboard scaffold (`app/page.tsx`) with greeting + cards
- [x] `GET /api/reports/summary` aggregating revenue, donor counts
- [ ] Year-over-year revenue chart (donut + line)
- [ ] Donor retention card (with prior-year comparison)
- [ ] Totals by donor level (major / mid / annual)
- [ ] Engagement heatmap
- [ ] Custom report builder
- [ ] Scheduled email summaries (weekly / monthly)
- [ ] CSV / Excel / PDF exports
- [ ] Caching layer for expensive aggregates

### Phase 06 — Groups, Segments & Automation · packet: [`phase-06-groups-segments-automation.md`](./phase-06-groups-segments-automation.md)

- [x] Automations list page with toggle / run / delete (`/automations`)
- [x] Preset library (`GET /api/automations/presets`) + one-click install
- [x] `POST /api/automations` and `PATCH /api/automations/:id`
- [x] Manual `POST /api/automations/:id/run` increments run count
- [ ] **Edit automation in place** (rename, change trigger, reorder actions)
- [ ] Real execution engine — actions are stored but not executed
- [ ] Tag-based and rule-based segment builder
- [ ] Group membership mgmt (manual + dynamic)
- [ ] Action library: SEND_EMAIL, ADD_TAG, ASSIGN_USER, UPDATE_FIELD, CREATE_TASK
- [ ] Trigger expansion: PLEDGE_CREATED, EMAIL_OPENED, EVENT_REGISTERED
- [ ] Run history + audit per automation execution

### Phase 07 — Events & Gala · packet: [`phase-07-events-and-gala.md`](./phase-07-events-and-gala.md)

- [x] Events list endpoint + create endpoint
- [x] `/events` page scaffold
- [ ] Registration / ticketing flow
- [ ] Sponsorships + table assignments
- [ ] Auction (silent / live) tracking
- [ ] Check-in app
- [ ] Event revenue rollup into reports
- [ ] Volunteer hour logging tied to events

### Phase 08 — Security, Integrations, AI Ops · packet: [`phase-08-security-integrations-ai-ops.md`](./phase-08-security-integrations-ai-ops.md)

- [x] bcrypt password hashing + JWT issuance
- [x] Rate limiting on `/api/auth/*`
- [x] Health endpoint + safe version metadata (`/health`, `/api/health`, `/settings/system`)
- [ ] CSRF posture review for cookie-based refresh
- [ ] Two-factor auth (TOTP)
- [ ] Audit log viewer UI
- [ ] Field-level encryption for sensitive notes
- [ ] Payment processor integration (Stripe / Authorize.Net)
- [ ] Accounting export (QuickBooks / CSV journal entries)
- [ ] Email provider integration (SendGrid / Postmark / SES)
- [ ] AI assistant (summarize donor profile, draft thank-you, suggest next task)
- [ ] AI safety: human review before send, no third-party training on donor data

---

## 2. OyamaCRM-Compassion (client-services workspace) — _new_

> Detailed packet: [`phase-09-compassion-workspace.md`](./phase-09-compassion-workspace.md)
>
> **Architectural rule:** workspace switcher in the top bar — donor data and
> client data must never cross-pollinate in search, exports, dashboards, or
> reports. Permissions are checked _per workspace_.

### Phase C0 — Workspace Foundation

- [ ] Add `workspace` enum + cookie/header so server filters by workspace
- [ ] `WorkspaceSwitcher` component in TopBar (Donor / Compassion)
- [ ] Separate sidebar (`CompassionSidebar`) — Dashboard, Clients, Appointments, Schedule Pages, Forms, Files, Resources, Tasks, Reports, Settings
- [ ] `/compassion/*` route group with its own layout (warm teal/cream theme)
- [ ] Workspace-aware permission middleware (`requireWorkspace("COMPASSION")`)
- [ ] Audit-log foundation — every read / write logs `workspaceId`

### Phase C1 — Client Records

- [ ] `Client` Prisma model (separate from `Constituent`)
- [ ] Client list with search + status / service-type filters
- [ ] Client profile tabs: Overview, Timeline, Appointments, Services, Notes, Forms, Files, Referrals, Tasks, Communications, Audit
- [ ] Client create / edit forms
- [ ] Quick actions: add note, schedule appointment, upload file, create task, add referral
- [ ] Timeline event writers for create / update / appointment / file / note / referral

### Phase C2 — Scheduling Core

- [ ] `AppointmentType` model with duration, eligible staff/rooms, buffers, max/day
- [ ] `Location`, `Room`, `StaffAvailability` models
- [ ] Internal calendar (day / week / month / staff / room views)
- [ ] Appointment statuses: Requested, Confirmed, Checked In, In Progress, Completed, No-Show, Cancelled, Rescheduled, Needs Follow-Up
- [ ] Check-in flow
- [ ] Reschedule + cancel flows with audit
- [ ] No-show tracking + report

### Phase C3 — Public Scheduling Pages & Embeds

- [ ] `SchedulePage` model (title, description, type, location, intake form, design)
- [ ] Public booking page renderer (`/schedule/[slug]`)
- [ ] Booking flow: choose service → location → date/time → intake → review → confirm
- [ ] Confirmation email/SMS hooks
- [ ] Embed script (`/embed/scheduler.js`) + iframe fallback
- [ ] Embed customization (color, logo, copy, prefilled fields, UTM)
- [ ] Spam protection (rate limit + honeypot)

### Phase C4 — Client Files & Forms

- [ ] `ClientFile` model with category, version history, audit on every view/download
- [ ] Upload / replace / archive UI with permission checks
- [ ] Form builder (Short/Long text, Phone, Email, Date, Dropdown, Checkbox, Radio, Yes/No, Signature, File, Private staff field, Conditional section)
- [ ] Conditional logic engine (show/hide fields, trigger tag/task/referral)
- [ ] Form submission → match-or-create client → attach to appointment / profile / task

### Phase C5 — Resources & Referrals

- [ ] `Resource` model with category, contact, eligibility, last-verified
- [ ] Resource directory UI (search, filter by category, mark inactive)
- [ ] `Referral` model linking Client → Resource → Staff → outcome
- [ ] Follow-up task auto-created on referral
- [ ] Resource needs report (which categories are most-requested)

### Phase C6 — Tasks, Notes, Permissions

- [ ] Compassion-side `Task` (separate from donor task or filtered by workspace)
- [ ] Task views: My Tasks, Today, Overdue, By Client, By Staff, By Service Type, Needs Director Review
- [ ] Notes (regular + private staff-only) with edit/delete audit
- [ ] Roles: Super Admin, Director, Client Services Mgr, Nurse/Medical, Advocate, Reception/Scheduler, Volunteer, Donor Staff, Board View
- [ ] Permission types — all server-side checks (view/create/edit/delete client, view sensitive notes, file ops, appointment ops, exports)

### Phase C7 — Reporting, AI, Hardening

- [ ] Compassion dashboard cards (Appointments today, No-shows this week, New clients, Pregnancy tests, Ultrasounds, Material assistance, Referrals, Follow-ups overdue, Classes attended, Needs by category)
- [ ] Reports: Client visit, Service, Appointment, Referral, Material assistance, Staff workload, Outcome, No-show, Resource needs, Monthly board summary
- [ ] Board reports default to anonymized rollups
- [ ] AI: summarize visit notes, draft follow-up message, suggest next task, prepare referral summary, find resources
- [ ] AI safety: never auto-save, mark as draft, audit on every AI access
- [ ] Two-factor auth, session timeout, suspicious-activity alerts

---

## 3. Cross-cutting workstreams

### Testing & quality

- [x] Unit test suite scaffolded with Vitest + v8 coverage provider
- [x] `email-builder-utils` — base tests + extra branch tests (presets, providers, plain-text)
- [x] `donation-utils` — formatter / label / status tests
- [x] `constituent-utils` — formatter / status / engagement bucket tests
- [x] `auth-client` — login / refresh / logout / `apiFetch` auto-refresh tests (fetch mocked)
- [x] Smoke tests against the Express app (`tests/smoke/*`) — _require live MySQL_
- [ ] Component tests with React Testing Library (no UI test runner yet)
- [ ] Route-level tests for `routes/donations.ts` DELETE + PUT branches
- [ ] Route-level tests for `routes/constituents.ts` household auto-create branch
- [ ] Route-level tests for `routes/automations.ts` preset install branch
- [ ] CI pipeline that runs `pnpm lint && pnpm test`
- [ ] Coverage threshold gate (target ≥ 70 % on `app/lib/**` and `server/src/routes/**`)
- [ ] E2E happy path with Playwright (login → add constituent → record gift → mark task complete)

### Documentation & developer experience

- [x] `AGENTS.md` codifies modular architecture, code style, and domain language
- [x] Phase packets and Mermaid diagrams in `PLAN_FILES/`
- [x] `phase-rollout-plan.md` describes the execution workflow
- [x] **This master plan** consolidates everything in one checklist
- [x] Top-level `README.md` quickstart and env/status notes
- [x] Production readiness audit doc (`docs/audits/production-readiness-audit-2026-05-08.md`)
- [ ] API reference (auto-generated from JSDoc on routes)
- [ ] Component storybook for shared UI primitives

### Editability sweep — make every record editable

- [x] Constituents: list / detail / new / **edit** all wired
- [x] Donations: list / new / **edit** + DELETE endpoint (this PR)
- [x] Tasks: list / create / complete / delete (PATCH supports any field)
- [x] Automations: list / create / toggle / delete + manual run
- [x] Campaigns: PATCH endpoint exists; UI for inline edit shipped
- [ ] Tasks UI: inline edit row (priority / due date / assignee) instead of complete-only
- [ ] Automations UI: rename + change trigger + reorder/edit actions in place
- [ ] Donations UI: bulk-status update on filtered set

---

## 4. Active focus

> Update this section on every PR so the team knows where energy is going.

**Now (this PR):**

- Add donation edit page + DELETE endpoint
- Boost unit-test coverage (`donation-utils`, `constituent-utils`, `auth-client`,
  email-builder branches)
- Consolidate `PLAN_FILES/` into this master index
- Stand up the Compassion workspace plan (`phase-09-compassion-workspace.md`)

**Next:**

- Inline-edit task rows + automation rename
- Standardize API response envelope (`{ data, error, meta }`) across all routes
- Begin Phase C0 — workspace switcher + `/compassion` route group skeleton
