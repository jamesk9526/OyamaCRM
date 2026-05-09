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

## 🚧 In progress / next batch

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
- [ ] Public booking page (no auth).
- [ ] Tokenised submission API + rate limiting.
- [ ] Embeddable JS widget.
- [ ] Existing-client matcher on submission.
- [ ] Staff review queue for matched submissions.

### Batch 5 — Client profile scoping + UX cleanup
- [ ] Audit every `app/compassion/clients/[id]/*` tab for client-id scoping.
- [ ] Add reusable `<NotYetImplemented />` popup component.
- [ ] Replace stub buttons with the popup; record each in `AGENTS.md`.

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
| Client tab: Notes (`/compassion/clients/[id]`) | Client-scoped API + create/edit flow + audit events + happy-path test | In development |
| Client tab: Follow Ups (`/compassion/clients/[id]`) | Client-scoped API + status updates + audit events + happy-path test | In development |
| Client tab: Documents (`/compassion/clients/[id]`) | Upload/list/delete with client permissions + audit + happy-path test | In development |
| Client tab: Medical (`/compassion/clients/[id]`) | Medical data model + role-aware read/write + audit + happy-path test | In development |
| Client tab: Assessments (`/compassion/clients/[id]`) | Assessment records linked to client/case + audit + happy-path test | In development |
| Client tab: Pregnancy Tests (`/compassion/clients/[id]`) | Pregnancy test model + record flow + audit + happy-path test | In development |
| Client tab: Sonograms (`/compassion/clients/[id]`) | Sonogram records + scheduling links + audit + happy-path test | In development |
| Client tab: Referrals (`/compassion/clients/[id]`) | Referral model + outcome tracking + audit + happy-path test | In development |
| Client tab: Classes (`/compassion/clients/[id]`) | Class attendance/completion model + audit + happy-path test | In development |
| Client tab: Boutique (`/compassion/clients/[id]`) | Item/points tracking model + audit + happy-path test | In development |
| Client tab: Communication (`/compassion/clients/[id]`) | Email/SMS/call log model + consent checks + audit + happy-path test | In development |
| Client tab: Portal (`/compassion/clients/[id]`) | Portal event ingestion and read model + audit + happy-path test | In development |
