# Client / Compassion CRM — Audit (Batch 1)

_Audit completed: 2026-05-09 — first pass focused on **importer + client list/search**._

This document captures the state of the Compassion CRM client tooling **before and after** Batch 1 of the production-readiness work, plus a backlog for subsequent batches. Pair it with `CLIENT_CRM_IMPORTER_PLAN.md` and `CLIENT_CRM_TASKS.md`.

---

## 1. Surface map

| Area | Path | Status |
|---|---|---|
| Client list / search | `app/compassion/clients/page.tsx` | ✅ Hardened in Batch 1 (filters, garbage filter) |
| Add Client modal | `app/compassion/clients/page.tsx` (`AddClientModal`) | ⚠️ Functional; missing form-level validation parity with importer |
| Client profile | `app/compassion/clients/[id]/page.tsx` | ⚠️ Partial — see backlog |
| Import wizard (UI) | `app/compassion/import/clients/CompassionClientImportWizard.tsx` | ✅ Hardened in Batch 1 |
| Import field map | `app/compassion/import/clients/compassionFieldMap.ts` | ✅ |
| Import validator | `app/compassion/import/clients/clientImportValidator.ts` | 🆕 Added in Batch 1 |
| CSV parser | `app/data-tools/import/csvParser.ts` | ✅ Auto-delimiter, BOM, paste |
| List API | `GET /api/compassion/clients` | ✅ New filters added |
| Import API | `POST /api/compassion/clients/import` | ✅ Hardened garbage filter |
| Public scheduling | _none_ | ❌ Not implemented |
| Embeddable widget | _none_ | ❌ Not implemented |
| Duplicate review center | _none_ | ❌ Not implemented |
| Import history | _none_ | ❌ Not implemented (audit log captures import events) |

---

## 2. The bug that prompted this work

The user reported that imports were creating client records like:

```
Text,Aurora,False,Active,No,Not Applicable, Active — — 05/09/2026 Unassigned 0
```

### Root cause analysis

1. The original wizard validator only rejected names containing a literal comma **after** name fields had already been mapped. eKYROS exports often place report-widget metadata in cells that are not always mapped to a name field, so the row slipped through.
2. The CSV parser only supported comma-delimited input. When users uploaded a TSV (or a file whose actual delimiter was tab/semicolon), the entire row collapsed into a single cell that then became the "name", evading the comma check.
3. The server-side `/clients/import` route applied an even weaker garbage check than the wizard, so a misbehaving client (or a curl) could push obviously-junk rows directly into the DB.
4. The client list page had no defensive filter — once garbage rows were in the DB, they showed up in search results forever.

Batch 1 closes all four gaps.

---

## 3. What changed in Batch 1

### 3.1 Centralised validator (`clientImportValidator.ts` — new)

- All garbage / metadata heuristics live here as exported pure functions (`isGarbageName`, `splitNameAndPreferred`, `isValidEmail`, `isValidPhone`, `isValidDate`, etc.) — fully unit-tested.
- Returns a structured `ClientValidationResult` with **per-row issues** that have a `severity` (`error` skips, `warning` keeps) and a stable `code` so the UI can group/filter.
- Detects **in-file duplicates** by email, normalised phone, and normalised name and surfaces them as warnings.
- Parses `Miranda Abrisz(Miranda)` and `Robert "Bob" Smith` patterns into `fullName` + `preferredName`.
- `issuesToCsv()` exports the issue list as a downloadable CSV.

### 3.2 CSV parser (`csvParser.ts`)

- New `detectDelimiter()` picks between `, \t ;  |` based on per-line consistency.
- `parseCSV()` now accepts an optional explicit `delimiter` and defaults to `"auto"`.
- Strips UTF-8 BOM, accepts CRLF/LF/CR line endings.
- Returns the resolved `delimiter` in the result so the UI can show it.

### 3.3 Import wizard (`CompassionClientImportWizard.tsx`)

- Added a delimiter dropdown (Auto / Comma / Tab / Semicolon / Pipe). Changing it re-parses the loaded text without requiring re-upload.
- Added a **paste-tabular-data** textarea + "Parse Text" button.
- Step 3 now shows separate counts for **garbage skipped**, **errors**, **warnings**, and **in-file duplicates**.
- Per-row issue table is colour-coded by severity and capped at 100 entries with a "download report" button for the full list.
- "Download Error Report" produces an RFC-4180 CSV named `<source>-import-issues.csv`.
- Reset / "Start New Import" now clears paste-text + raw-text state too.

### 3.4 Server route (`POST /api/compassion/clients/import`)

- Replaced the weak `isMetadataName` check with a heuristic that matches the client-side validator (defense in depth — a misbehaving client cannot bypass it).
- Drops obviously-invalid emails before persisting.

### 3.5 List route (`GET /api/compassion/clients`) + page

- New query params: `assigned`, `missingContact`, `intakeWithinDays`.
- Search now also matches `preferredName` and `referralSource`.
- **Defensive output filter** strips any rows whose name still contains a comma or em-dash separator — protects users from legacy bad imports that pre-date this work.
- UI filter bar updated with assignment dropdown, intake-window dropdown, "Missing contact info" checkbox, and "Clear filters" reset.

### 3.6 Tests

- `tests/unit/compassion-client-import-validator.test.ts` — 39 tests covering the bug-report example, name-parsing, email/phone/date validation, in-file duplicate detection, status normalisation, error-CSV serialisation, and the new auto-delimiter parser.

### 3.7 Client-scoped workspace structure (new)

- Compassion sidebar was simplified to major tools only: Dashboard, Clients, Cases, Appointments, Tasks, Follow Ups, Reports, Data Tools, Settings.
- Families, Care Plans, Activities, and Communications were removed from top-level sidebar navigation.
- Client profile route (`/compassion/clients/[id]`) was expanded into a client-scoped workspace with tabs for detailed service areas.
- Existing data-backed tabs remain active (Overview, Details, Cases, Activity, Appointments, Resources, Audit Log).
- Planned tabs now show explicit in-development notices with criteria for removal (Notes, Follow Ups, Documents, Medical, Assessments, Pregnancy Tests, Sonograms, Referrals, Classes, Boutique, Communication, Portal).

---

## 4. Backlog (next batches)

Tracked in `CLIENT_CRM_TASKS.md`. High-priority items not in Batch 1:

- **Client profile scoping audit.** Verify every tab on the client profile filters by `clientId` and never leaks data across clients.
- **Import history page.** Surface the audit-log `COMPASSION_CLIENT_IMPORT*` entries in a real UI with "view results" + "rollback" affordances.
- **Duplicate review center.** Promote the in-file duplicate warnings into a global queue showing cross-org duplicate suggestions with merge/skip/keep-both controls.
- **Public appointment scheduling + embeddable widget.** Add a public route, a tokenised submission endpoint, and a script-tag-installable widget. Public submissions must run through a name/email/phone matcher and create review tasks rather than auto-creating clients.
- **Privacy-safe audit log surface.** Internal audit log already captures import events; a dedicated read-only viewer is needed.
- **"Not yet implemented" warnings.** Add a small popup component used by stub tabs/buttons; record each in `AGENTS.md` until the feature is real.

---

## 5. Privacy & isolation guarantees (verified for Batch 1)

- The Compassion import route writes only to `compassionClient` and `compassionActivity`. It never touches `Constituent`, `Donation`, `Event*`, or any Donor/Events module.
- SSN / tax-ID / SIN fields are **stripped server-side** even if a payload still includes them.
- Records are scoped to the authenticated user's `organizationId` on every read and write.
- Search queries always include `organizationId` in the `WHERE` clause; the new defensive filter runs **after** the org-scoped query.
