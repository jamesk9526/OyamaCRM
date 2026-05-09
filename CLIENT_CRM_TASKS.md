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

---

## "Not yet implemented" popup tracking

When a stub tab/button/page is shipped behind the `<NotYetImplemented />` popup, add it here with the criteria for **removing** the popup. The popup must only be removed once the criteria are met **and** at least one happy-path test exists.

| Surface | Removal criteria | Status |
|---|---|---|
| _none yet — added in Batch 5_ | | |
