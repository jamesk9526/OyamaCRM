# Client / Compassion CRM — Tasks

A live checklist of remaining production work for the Compassion CRM. Update as items are completed; do not delete completed items so the history stays visible.

---

## ✅ Completed (Batch 1 — 2026-05-09)

- [x] Audit current Compassion importer + client search.
- [x] New validator module (`app/compassion/import/clients/clientImportValidator.ts`).
- [x] Reject report/widget/metadata garbage rows (the `Text,Aurora,False,...` bug).
- [x] Email/phone/date/status validation with severity levels.
- [x] `Full Name(Preferred)` parser.
- [x] In-file duplicate detection.
- [x] Downloadable error-report CSV.
- [x] CSV parser auto-delimiter detection (CSV / TSV / `;` / `|`), BOM stripping.
- [x] Wizard delimiter dropdown + paste-text input.
- [x] Server import route — defense-in-depth garbage filter and email validation.
- [x] Server `GET /clients` — defensive output filter + new query filters.
- [x] Client list page — assignment / missing-contact / intake-window filters.
- [x] 39 unit tests for the validator + parser.
- [x] Docs: `CLIENT_CRM_AUDIT.md`, `CLIENT_CRM_IMPORTER_PLAN.md`, `CLIENT_CRM_TASKS.md`.
- [x] Simplify Compassion sidebar to major tools only (Dashboard, Clients, Cases, Appointments, Tasks, Follow Ups, Reports, Data Tools, Settings).
- [x] Remove Families, Care Plans, Activities, and Communications from top-level Compassion sidebar.
- [x] Expand client profile into a client-scoped workspace with broad service-domain tabs.
- [x] Add in-development warning scaffolding for not-yet-implemented client tabs.
- [x] Add module-specific communication settings skeleton pages for Donor, Compassion, and Events modules.
- [x] Upgrade Compassion Appointments into a production scheduling hub (calendar day/week/month/agenda + list view + filters/search/sort + quick actions).
- [x] Add drag-and-drop and resize rescheduling with backend conflict validation for Compassion appointments.
- [x] Add appointment workspace test coverage for conflict prevention, status transitions, utility filtering/sorting, and public-widget-to-admin sync.

## 🚧 In progress / next batch

### Stabilization from full production pass (2026-05-10)
- [ ] Fix failing smoke assertion in `tests/smoke/routes-workflow.test.ts` where newly created client is not reliably returned in immediate list calls.
- [ ] Improve `/api/compassion/clients` search to support tokenized full-name matching (for example first + last name query terms).
- [ ] Investigate and fix intermittent 401/500 console errors observed on Compassion settings route in browser audit.

### Batch 2 — Import history + rollback
- [ ] Prisma model: `CompassionClientImportBatch`.
- [ ] Wire `/clients/import` to write a batch row.
- [ ] `app/compassion/import/history/page.tsx`.
- [ ] Rollback API + UI.

### Batch 3 — Duplicate review center
- [ ] Persist duplicate candidates instead of silent upserts.
- [ ] `app/compassion/clients/duplicates/page.tsx`.
- [ ] Merge / skip / keep-both UX.

### Batch 4 — Public + embeddable scheduling
- [x] Public booking page (no auth) with slot-based selection.
- [x] Tokenised submission API.
- [x] Embeddable JS widget (`public/embed/compassion-schedule.js`).
- [x] Office-managed scheduling source-of-truth controls (interval, duration, lead time, advance window, recurring blocks, blackout dates).
- [ ] Rate limiting + anti-abuse telemetry for public scheduling endpoints.
- [ ] Existing-client matcher on submission.
- [ ] Staff review queue for matched submissions.

### Batch 5 — Client profile scoping + UX cleanup
- [x] Replace profile placeholders with client-scoped operational tabs for Notes, Follow Ups, Documents, Medical, Assessments, Pregnancy Tests, Sonograms, Referrals, Classes, Boutique, Communication, and Portal.
- [x] Add client-scoped custom activity-entry CRUD APIs (`GET/POST/PATCH/DELETE /api/compassion/clients/:id/activity-entries`).
- [x] Add comma-separated `serviceTypes` filtering support to `GET /api/compassion/services` for tab-specific service logs.
- [ ] Add happy-path test coverage for client profile tab create/update/delete flows.
- [ ] Add role-aware restrictions and deeper permission checks for sensitive tab actions.
- [ ] Add secure document upload/storage workflow (current documents tab logs metadata records only).

### Batch 6 — Domain modules
- [ ] Pregnancy test tracking.
- [ ] Ultrasound appointment tracking.
- [ ] Material assistance tracking.
- [ ] Referrals (housing / GED / jobs / nutrition / diapers / clothing / transport / parenting).
- [ ] Activity timeline.
- [ ] Privacy-safe audit log viewer.
- [ ] Persist client-scoped linked-record import mappings (case/visit/medical/referral/class/boutique entities).

---

## "Not yet implemented" popup tracking

When a stub tab/button/page is shipped behind the `<NotYetImplemented />` popup, add it here with the criteria for **removing** the popup. The popup must only be removed once the criteria are met **and** at least one happy-path test exists.

| Surface | Removal criteria | Status |
|---|---|---|
| Client tab: Notes (`/compassion/clients/[id]`) | Client-scoped API + create/edit flow + audit events + happy-path test | Operational (warning removed; add tests) |
| Client tab: Follow Ups (`/compassion/clients/[id]`) | Client-scoped API + status updates + audit events + happy-path test | Operational (warning removed; add tests) |
| Client tab: Documents (`/compassion/clients/[id]`) | Upload/list/delete with client permissions + audit + happy-path test | Partially Working (metadata CRUD live; upload pending; warning shown) |
| Client tab: Medical (`/compassion/clients/[id]`) | Medical data model + role-aware read/write + audit + happy-path test | Operational (warning removed; harden permissions/tests) |
| Client tab: Assessments (`/compassion/clients/[id]`) | Assessment records linked to client/case + audit + happy-path test | Operational (warning removed; add tests) |
| Client tab: Pregnancy Tests (`/compassion/clients/[id]`) | Pregnancy test model + record flow + audit + happy-path test | Operational (warning removed; add tests) |
| Client tab: Sonograms (`/compassion/clients/[id]`) | Sonogram records + scheduling links + audit + happy-path test | Operational (warning removed; add tests) |
| Client tab: Referrals (`/compassion/clients/[id]`) | Referral model + outcome tracking + audit + happy-path test | Operational (warning removed; add tests) |
| Client tab: Classes (`/compassion/clients/[id]`) | Class attendance/completion model + audit + happy-path test | Operational (warning removed; add tests) |
| Client tab: Boutique (`/compassion/clients/[id]`) | Item/points tracking model + audit + happy-path test | Operational (warning removed; add tests) |
| Client tab: Communication (`/compassion/clients/[id]`) | Email/SMS/call log model + consent checks + audit + happy-path test | Operational (warning removed; add tests) |
| Client tab: Portal (`/compassion/clients/[id]`) | Portal event ingestion and read model + audit + happy-path test | Partially Working (manual event CRUD live; ingestion pending; warning shown) |
| Public scheduling intake triage (`/compassion/public/appointments/[token]`) | Existing-client matcher + staff review queue + approval handoff + happy-path test | In development |
