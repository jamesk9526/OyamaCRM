# Phase 09 — OyamaCRM-Compassion Workspace (Client-Services CRM)

> **Archived source brief:** [`oyamacrm-compassion-agent-plan.md`](./oyamacrm-compassion-agent-plan.md)
>
> This packet turns the high-level Compassion brief into an executable plan
> for the secondary workspace inside OyamaCRM. Compassion is a separate CRM
> embedded in the same platform: shared login + users, but **separate
> navigation, dashboards, data models, permissions, audit logs, and
> reports**. Donor data must never appear in client search/exports/dashboards
> and vice-versa.
>
> Refer to the [`master-plan.md`](./master-plan.md) for the rolled-up status
> checklist; this file holds the architectural detail and exit criteria for
> each Compassion sub-phase (C0 → C7).

---

## 0. Architectural pillars

These rules apply to **every** Compassion change and override convenience.

1. **Separation without duplication.** Shared platform core: `User`, `Role`,
   `Permission`, `Notification`, `CalendarEngine`, `TemplateEngine`,
   `AuditLog`, `AIAssistant`, `Settings`. Donor-only: `Constituent`,
   `Donation`, `Campaign`, `Pledge`, etc. Client-only: `Client`,
   `Appointment`, `ClientFile`, `ClientNote`, `Form`, `FormSubmission`,
   `Resource`, `Referral`, `SchedulePage`, `AvailabilityRule`, `Location`,
   `Room`, `CompassionTask`.
2. **Workspace-scoped queries.** Every Compassion query carries
   `workspaceId = "COMPASSION"`. Every donor query carries
   `workspaceId = "DONOR"`. Middleware `requireWorkspace(name)` is mandatory
   on `/api/compassion/*` and `/api/donor/*` routes.
3. **Server-side permissions.** Never rely on UI hiding. Every Compassion
   endpoint that returns client data must run a permission check before
   returning a record.
4. **Audit on read _and_ write.** Compassion file views, downloads, edits,
   deletions, exports, and AI summarizations are logged.
5. **Naming convention** (DB tables): prefix `core_*`, `donor_*`,
   `compassion_*` — keeps mixing accidentally impossible.
6. **Theme separation.** Donor UI = green-600 accents, white. Compassion UI
   = blue-600 accents with a visually distinct shell so the workspace switch
   is obvious immediately.
7. **No sales-CRM language anywhere in Compassion.** Use "client", "case
   note", "service", "follow-up" — never "lead", "deal", "pipeline".

## Audit snapshot — 2026-05-08

- [~] Compassion routing and shell scaffolding exist — `/compassion/*` pages, `app/compassion/layout.tsx`, `app/components/layout/CompassionSidebar.tsx`, and a module switcher in `TopBar.tsx`.
- [ ] Workspace-aware permission enforcement still has not started on the server — no `requireWorkspace(...)` middleware found in live route usage.
- [ ] Client, appointment, file, referral, schedule-page, and compassion-task models are still not present in `prisma/schema.prisma`.
- [ ] Compassion remains shell-first until server-side workspace isolation and real data models are added.

---

## C0 — Workspace Foundation

### Scope

Stand up the workspace boundary so all later phases plug into a clean shell.

### Manageable steps

1. Add `Workspace` enum (`DONOR`, `COMPASSION`) to Prisma schema and bake it
   into `User` (`accessibleWorkspaces`) and into a new `WorkspaceSession`
   cookie `workspace=COMPASSION`.
2. Build `WorkspaceSwitcher` component for `TopBar` showing current workspace
   and the user's other accessible workspaces.
3. Create the `/compassion` route group with its own `layout.tsx` (blue
   palette, dedicated sidebar). Reuse `AppShell` primitives but render
   `CompassionSidebar`.
4. Add `requireWorkspace(name)` middleware on the API. Default donor routes
   live under `/api/*`; Compassion routes mount under `/api/compassion/*`.
5. Wire the audit-log writer to record `workspaceId` for every event.
6. Seed two demo users: a donor-only staffer and a Compassion advocate, plus
   a Director with both workspaces.

### Exit criteria

- A user with both workspaces can switch via the top bar; URL changes from
  `/` to `/compassion` and the sidebar swaps.
- A donor-only user attempting `/compassion` gets a 403 from middleware.
- All Compassion API requests fail without `workspace=COMPASSION` context.
- AppShell theme tokens swap cleanly per workspace (no FOUC).
- Audit log stores workspace on every event.

---

## C1 — Client Records

### Scope

Profiles, timeline, notes, and search for the people the center serves.

### Manageable steps

1. Create `Client`, `ClientContact`, `ClientNote`, `ClientTimelineEvent`
   Prisma models. Do **not** reuse `Constituent`.
2. List page (`/compassion/clients`) with search (name, phone, email, ID,
   tag, service type, appointment status) and filters (active, inactive,
   new, overdue follow-up, appointment date, service type, assigned staff,
   location).
3. Quick actions on each row: add note, schedule appointment, upload file,
   create task, add referral, view timeline.
4. Client profile (`/compassion/clients/[id]`) with tabs: Overview,
   Timeline, Appointments, Services, Notes, Forms, Files, Referrals, Tasks,
   Communications, Audit.
5. Create / edit forms with permission checks.
6. Timeline writers on every relevant action (created, form submitted,
   appointment requested/confirmed/checked-in/completed/no-show/cancelled/
   rescheduled, note added, file uploaded, service provided, referral made,
   task created/completed, follow-up sent, staff assignment changed).
7. Filter timeline by event type.
8. Soft-delete / archive behavior + restore.

### Exit criteria

- Staff can create, search, edit, archive, and restore a client.
- Timeline shows all 17 event types with filters.
- Notes support a "private staff-only" flag enforced server-side.
- Profile is permission-gated; non-eligible roles see 403.

---

## C2 — Scheduling Core

### Scope

Internal calendar engine that backs both staff bookings and the public pages
in C3.

### Current implementation note (2026-05-11)

- Office scheduling hub is now live at `/compassion/appointments` with shared source-of-truth calendar/list views, drag-drop and resize rescheduling, conflict-aware create/edit/status updates, and full-screen calendar mode.
- Public scheduling still flows through tokenized slot APIs and creates real `CompassionAppointment` records visible in the office scheduler.
- Existing-client matching and staff triage queue for public submissions remain planned work.

### Manageable steps

1. Models: `AppointmentType`, `Location`, `Room`, `StaffAvailability`,
   `Appointment`, `AppointmentStatusHistory`, `Equipment` (optional).
2. Appointment types fields: name, description, duration, location, eligible
   staff, eligible rooms, required forms, public/private visibility, buffers
   (before/after), max bookings/day, cancellation rules, reschedule rules,
   reminder rules, follow-up workflow, internal notes.
3. Status machine: `Requested → Confirmed → Checked In → In Progress →
   Completed`, plus side states `No-Show`, `Cancelled`, `Rescheduled`,
   `Needs Follow-Up`. Every transition writes a status-history row.
4. Calendar views: Day, Week, Month, Staff, Room, Location, Appointment
   Type, My Appointments, Check-In view.
5. Scheduling service (`AvailabilityService`, `AppointmentService`). UI
   never computes availability — always asks the service.
6. Reschedule + cancel flows with reason capture and audit entries.
7. No-show tracking + automated follow-up task creation.

### Exit criteria

- Staff can create an appointment type and book a client into it.
- Booking respects staff availability, room availability, and per-type
  max/day limits.
- Status transitions are auditable and visible on the client timeline.
- Day/week/month/staff/room views all render the same data correctly.

---

## C3 — Public Scheduling Pages & Embeds

### Scope

Self-service booking pages that the center can publish or embed on its
website.

### Manageable steps

1. `SchedulePage` model: title, description, appointment type(s), location
   rules, staff rules, room rules, intake form, confirmation message,
   reminder rules, visibility (public / private link / internal), design
   (logo, colors, button style, welcome text), slug.
2. Public renderer at `/schedule/[slug]` with the booking flow:
   choose service → choose location → choose date/time → complete intake
   form → review → confirm → confirmation page → email/SMS confirmation →
   internal staff notification.
3. Confirmation/reminder hooks pluggable into a future Email/SMS provider.
4. Embed script `/embed/scheduler.js` that supports: inline embed, popup
   button, floating button, direct link, single-type embed, multi-type
   embed, location-specific embed.
5. Embed customization: colors, fonts, button text, logo, rounded/square,
   full-page/compact/mobile, language, prefilled fields, UTM tracking,
   conversion events.
6. Spam protection: per-IP rate limit, honeypot field, optional CAPTCHA
   hook.
7. Page builder UI (`/compassion/schedule-pages`) with duplicate / disable.

### Exit criteria

- Staff can publish a scheduling page and copy its embed code.
- A public visitor can book; appointment lands on the internal calendar
  with `Requested` status.
- Confirmation message renders and the staff notification fires.
- Embed code drops into a static HTML page and renders correctly.

---

## C4 — Client Files & Forms

### Scope

Secure file cabinet per client and a form builder feeding both intake and
client records.

### Manageable steps

1. Models: `ClientFile` (category, version, mime, size, uploader, audit
   refs), `Form`, `FormField`, `FormSubmission`.
2. Default file categories: Intake, Consent, Medical/Ultrasound, Education,
   Referrals, Material Assistance, Case Notes, Staff Documents, Other.
3. File features: upload, category, staff-only notes, metadata, replace
   with version history, permission-gated download, archive/delete, audit
   log on every view/upload/download/replace/delete.
4. Form builder UI with field types: Short Text, Long Text, Phone, Email,
   Date, Dropdown, Checkbox, Radio, Yes/No, Signature, File Upload,
   Private Staff-Only field, Conditional Section.
5. Conditional logic engine — show/hide fields, trigger tag/task/referral
   based on answers (e.g. "needs housing" → housing referral task + tag).
6. Form submission rules: create-or-match client, attach to appointment,
   attach to profile, trigger staff notification, trigger task, trigger
   referral workflow, trigger confirmation email/SMS.
7. Privacy rule: client files must **not** appear in donor search, donor
   reports, donor exports, donor timelines, or fundraising dashboards.

### Exit criteria

- Staff can upload, replace, download, and archive a file with full audit.
- Form builder produces a working public form attached to a scheduling page
  or used standalone.
- Submitting a form creates or links a client and fires its configured
  triggers.
- Donor workspace returns zero results for any client file or form.

---

## C5 — Resources & Referrals

### Scope

A referable directory of community resources plus the referral workflow.

### Manageable steps

1. `Resource` model: name, category, contact, phone, email, website,
   address, eligibility, notes, internal quality notes, last verified,
   active.
2. Default categories: Housing, GED/HiSET, Jobs, Nutrition, Diapers,
   Clothing, Transportation, Food Assistance, Church Connections, Parenting
   Classes, Medical Referrals, Counseling Referrals, Community Aid, Other.
3. Resource directory UI with search, category filter, last-verified
   indicator, and a "needs reverification" alert.
4. `Referral` model linking Client → Resource → Staff with date, reason,
   status, follow-up date, outcome notes.
5. Auto-create a follow-up task when a referral is made.
6. Resource needs report (which categories are most-requested).

### Exit criteria

- Staff can create a resource and refer a client to it in two clicks from
  the client profile.
- A follow-up task appears automatically.
- Referral outcome can be recorded and shows in the client timeline.

---

## C6 — Tasks, Notes, Permissions

### Scope

Compassion-side task engine and the role/permission model that secures
everything.

### Manageable steps

1. `CompassionTask` model — implemented as a discriminator field
   (`workspace: WorkspaceEnum`) on the existing donor `Task` model. This
   keeps a single task engine, automation surface, and timeline writer
   while still scoping queries per workspace. All Compassion-side queries
   add `where: { workspace: "COMPASSION" }`; all donor-side queries add
   `where: { workspace: "DONOR" }`. _(Decision recorded; revisit only if a
   future Compassion-only field set diverges materially.)_
2. Task views: My Tasks, Today, Overdue, By Client, By Staff Member, By
   Appointment, By Service Type, Needs Director Review.
3. Task fields: title, description, client, assigned staff, due date,
   priority, status, related appointment, related referral, related file,
   completion notes.
4. Roles: Super Admin, Director, Client Services Manager, Nurse / Medical
   Staff, Advocate, Reception/Scheduler, Volunteer, Donor Staff, Board View.
5. Critical rule: **a user does not get client access just because they
   have donor access.** Permissions are granted per workspace.
6. Permission types (server-checked): view/create/edit/delete client; view
   sensitive notes; add/edit/delete notes; view/upload/download/delete
   files; view/create/edit/cancel appointments; view/export reports; manage
   forms / scheduling pages / resources / settings.
7. Notes — regular and private staff-only — with edit/delete audit.

### Exit criteria

- A Reception user can schedule but cannot view sensitive notes.
- An Advocate can edit notes on their assigned clients but not delete.
- A Donor Staff user has zero Compassion access.
- Every permission denial is logged.

---

## C7 — Reporting, AI, and Hardening

### Scope

Make the workspace board-ready, AI-assisted, and security-hardened.

### Manageable steps

1. Compassion dashboard cards: Appointments Today, Upcoming Appointments,
   No-Shows This Week, New Clients This Month, Pregnancy Tests This Month,
   Ultrasound Appointments This Month, Material Assistance Visits, Resource
   Referrals Made, Follow-Ups Overdue, Classes Attended, Client Needs by
   Category.
2. Reports: Client Visit, Service, Appointment, Referral, Material
   Assistance, Staff Workload, Outcome, No-Show, Resource Needs, Monthly
   Board Summary.
3. Board reporting rule: totals/trends/outcomes only — no private records
   unless explicitly authorized; default exports are anonymized rollups.
4. AI assistant features: summarize visit notes, draft follow-up messages,
   suggest next care tasks, prepare resource referral summaries, identify
   incomplete intake forms, help staff find resources, generate internal
   reports, summarize appointment trends, create board-safe summaries.
5. AI safety rules: never auto-save AI output; mark AI-generated drafts;
   require staff approval before sending; never train external models on
   client data; prefer local AI for sensitive work; audit every AI access;
   AI never overrides staff judgment.
6. Security hardening: 2FA (TOTP), session timeout, suspicious-activity
   admin alerts, login history, record-view history, export controls, print
   controls, per-field permissions where needed.

### Exit criteria

- Compassion dashboard renders all 11 cards with seeded demo data.
- Board summary produces a printable monthly report with no PII by default.
- AI summaries appear marked as drafts and require explicit save.
- 2FA can be enforced per role; session timeout is configurable.
- Audit log viewer shows every read/write with workspace, user, IP.

---

## Data model (high-level)

```
core_users
core_roles
core_permissions
core_workspaces
core_audit_logs
core_notifications
core_calendar_engine
core_template_engine

donor_constituents
donor_gifts
donor_campaigns
donor_letters
donor_email_campaigns
donor_pledges

compassion_clients
compassion_client_contacts
compassion_client_notes
compassion_client_files
compassion_client_timeline_events
compassion_appointments
compassion_appointment_types
compassion_appointment_status_history
compassion_locations
compassion_rooms
compassion_staff_availability
compassion_services
compassion_forms
compassion_form_fields
compassion_form_submissions
compassion_resources
compassion_referrals
compassion_tasks
compassion_schedule_pages
compassion_availability_rules
```

---

## Future nice-to-haves (parking lot)

SMS reminders · two-way texting · automated follow-up workflows · client
portal · digital signatures · advanced conditional logic · drag-and-drop
schedule builder · waitlist management · staff workload balancing ·
multi-center support · volunteer scheduling · inventory tracking for
diapers/clothing/material assistance · AI-generated board reports · AI
resource matching · smart duplicate detection · bulk import/export ·
QuickBooks/accounting integrations · email marketing integrations · website
analytics integration.

---

## Final product vision

> OyamaCRM helps the center care for donors.
> OyamaCRM-Compassion helps the center care for clients.
>
> One platform. Two separate workspaces. Shared users and tools. Separated
> data. Simple design. Powerful scheduling. Secure client files.
> **Built for ministry, not sales.**
