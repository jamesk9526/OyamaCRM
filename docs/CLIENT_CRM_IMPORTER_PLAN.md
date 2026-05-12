# Client / Compassion CRM Importer Plan

This plan tracks the production-readiness work for the Compassion CRM client importer. Pair with `CLIENT_CRM_AUDIT.md` (state) and `CLIENT_CRM_TASKS.md` (per-task tracker).

The first batch is complete. Subsequent batches stay in this document so any future agent can pick up the same plan without losing context.

---

## Goal

A client importer that:

- Never imports obvious garbage rows.
- Never overwrites an existing client without a clear merge decision.
- Never lets imported client data leak into Donor or Events CRMs.
- Tells the user **exactly** what was rejected, why, and how to fix it.
- Supports messy real-world exports — CSV, TSV, semicolon-delimited, pasted text — with a smart field-mapping step.

---

## Batch 1 — Validation, parsing, search hardening — ✅ DONE

- [x] Add a dedicated, unit-tested validator module (`clientImportValidator.ts`).
- [x] Reject rows where the "name" is comma-separated metadata, em-dash separators, widget tokens (`Text`, `True`, `Report`, `Page`, `Total`, `Generated`, …), placeholder values (`test`, `unknown`, `placeholder`, `tbd`), all-caps layout artifacts, or mostly-digits noise.
- [x] Email-format validation (drop invalid email, keep row, warn).
- [x] Phone-format validation (warn but keep raw).
- [x] Date validity validation for DOB and intake date (drop, warn).
- [x] Parse `Full Name(Preferred)` and `First "Nick" Last` patterns.
- [x] In-file duplicate detection by email, normalised phone, normalised name. Warn — do not auto-merge.
- [x] Per-row issues with `severity` + stable `code`.
- [x] Downloadable error report CSV.
- [x] CSV parser: auto-detect delimiter (comma / tab / semicolon / pipe), strip BOM, accept CRLF/LF/CR.
- [x] Wizard: delimiter dropdown override + paste-text input.
- [x] Server `/clients/import`: mirror the garbage filter (defense in depth).
- [x] Server `GET /clients`: defensive filter against legacy bad rows + new `assigned` / `missingContact` / `intakeWithinDays` filters and `preferredName` / `referralSource` search.
- [x] Frontend client list: matching filter UI.
- [x] Unit tests for everything new.

---

## Batch 2 — Import history + rollback (next)

- [ ] Schema: add a `compassionClientImportBatch` table storing `id`, `organizationId`, `userId`, `dryRun`, `mode`, `recordCount`, `created`, `updated`, `skipped`, `errorJson`, `createdAt`. (Already have `auditLog` rows — promote to a structured table for proper UX.)
- [ ] Wizard: post a `batchId` on completion; show "View Import History" link.
- [ ] New page `app/compassion/import/history/page.tsx` listing recent batches with summary stats.
- [ ] Per-batch detail view with full error list + "Rollback" button (deletes only the clients created in that batch — never touches matched/updated existing records).
- [ ] Rollback API: soft-delete (status → `ARCHIVED`, add `deletedByImportRollback` flag) rather than hard delete.

## Batch 3 — Duplicate review center

- [ ] During import, when an existing client matches by email/phone/normalised-name, **don't auto-upsert** — instead enqueue a `compassionDuplicateCandidate` row.
- [ ] Page: `app/compassion/clients/duplicates/page.tsx` showing pending candidates with side-by-side diff + Merge / Skip / Keep Both.
- [ ] Merge action shows exactly which fields will change and never silently overwrites.

## Batch 4 — Public appointment scheduling + embeddable widget

- [x] Public route `app/compassion/public/appointments/[token]/page.tsx` with single-page booking form and slot selection. No auth required.
- [x] APIs:
	- `GET /api/compassion-public/widget/:token/config`
	- `GET /api/compassion-public/widget/:token/slots`
	- `POST /api/compassion-public/widget/:token/appointments`
	Tokenised submissions are live; rate limiting is still pending.
- [x] Embeddable widget script `public/embed/compassion-schedule.js` loadable via `<script src=...>` on partner sites.
- [ ] Submissions run through existing-client matcher and staff review queue before final conversion.
- [ ] Add rate-limiting/anti-abuse controls for public endpoints.
- [x] Public form and slot APIs expose booking-safe fields only and do not return private client identifiers.

## Batch 5 — Client-profile scoping audit + "not yet implemented" popups

- [ ] Verify each tab on `app/compassion/clients/[id]/*` filters by `clientId`.
- [ ] Add a reusable `<NotYetImplemented feature="…" />` popup component. Use it on every stub tab.
- [ ] Record each stub in `AGENTS.md` (already established in this PR).

## Batch 6 — Client-scoped linked-record import expansion

- [x] Extend Compassion field map with planned linked-record mappings (case, visit, assessment, pregnancy test, referral, class, boutique).
- [ ] Persist mapped linked-record fields into dedicated client-scoped entities (case visits, assessments, tests, referrals, classes, boutique usage).
- [ ] Import results should show per-entity counts (clients created/updated, case rows created, medical rows created, referral rows created).
- [ ] Add audit events per entity type created or updated during import.

---

## Out of scope

- Editing the Donor CRM importer behaviour. Donor + Compassion importers share `csvParser.ts`; the new auto-delimiter is a backwards-compatible default and does not change donor import semantics.
- Removing pre-existing TS2742 warnings in unrelated server route files.
