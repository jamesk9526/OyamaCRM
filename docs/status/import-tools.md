# Import Tools — Status

_Last updated: 2026-05-13 · Donation Import added_

## What Is Implemented

### Constituent Import Wizard (`app/data-tools/import/ImportWizard.tsx`) ✅

Full 5-step visual import wizard. Route: `/data-tools/import`.
Handles file upload, smart header detection, field mapping, validation, and import confirmation.

| Step | Status | Notes |
|------|--------|-------|
| 1. Upload File | ✅ Working | Drag-and-drop; auto-detects eKYROS title rows; shows file stats + data quality notes |
| Header detection | ✅ Working | `detectHeaderRow()` in csvParser.ts skips title/blank rows; supports eKYROS row-4 headers |
| 2. Map Fields | ✅ Working | 3-panel layout: stepper sidebar + scrollable mapping table + column details panel |
| Auto-mapping | ✅ Working | All 37 eKYROS columns pre-mapped via `AUTO_MAP_ALIASES`; SSN/Age default to skip |
| 3. Review & Validate | ✅ Working | Runs `validateAndTransform`; shows valid/error/warning counts; row error table; 5-row preview |
| 4. Import Settings | ✅ Working | Import mode, record type, dedup options, dry-run toggle |
| 5. Confirm & Import | ✅ Working | POST to `/api/constituents/import`; result display |

### Donation Import Wizard (`app/data-tools/import/DonationImportWizard.tsx`) ✅ NEW

Full 5-step visual donation CSV import wizard. Route: `/data-tools/import/donation`.
Imports historical gift data; links to existing constituents; creates campaigns/designations on-the-fly.

| Step | Status | Notes |
|------|--------|-------|
| 1. Upload File | ✅ Working | CSV drag-and-drop; header auto-detection |
| 2. Map Fields | ✅ Working | 24 donation fields; 100+ aliases for Bloomerang/NeonCRM/eKYROS/DonorPerfect |
| 3. Review & Validate | ✅ Working | Amount validation, date parsing, required-field warnings |
| 4. Import Settings | ✅ Working | Constituent matching (externalId/email/name), dedup by receipt#, dry-run, skip-unmatched |
| 5. Confirm & Import | ✅ Working | POST to `/api/donations/import`; dry-run or live; result summary |

Backend (`POST /api/donations/import`):
- Resolves constituent by externalId → email → name
- Auto-creates Campaign and Designation records if missing
- Deduplicates by receiptNumber
- Updates constituent lifetime giving stats after import
- Audit logs every write
- TODO: rollback/undo not yet implemented

### Visual Import Mapper (`app/data-tools/import/VisualImportMapper.tsx`) ✅

Full-page 3-column advanced CSV-to-CRM mapping tool. Route: `/data-tools/import`.
Features: HIGH/MEDIUM/LOW confidence badges, SSN opt-in, preset save/load, dry-run CSV download.

### CSV Parser (`app/data-tools/import/csvParser.ts`) ✅

Pure utility module (no React dependency). Provides:
- `parseCSV(text)` — RFC 4180 parser with smart header detection
- `detectHeaderRow(lines)` — scans first 10 lines; skips title/blank rows
- `computeColumnStats(headers, rows)` — fill rate, unique count, sample values, inferred type

### Field Maps

| File | Status | Notes |
|------|--------|-------|
| `fieldMap.ts` | ✅ Complete | 37 constituent fields, 80+ aliases, sensitive field flags |
| `donationFieldMap.ts` | ✅ Complete | 24 donation fields, 100+ aliases (Bloomerang, NeonCRM, eKYROS, DonorPerfect) |

## What Is Missing

| Item | Priority | Notes |
|------|----------|-------|
| Donation import rollback / undo | Medium | Allow reverting a bulk donation import within N hours |
| Import history log | Medium | Show a log of past imports with record counts and timestamps |
| Constituent import rollback | Medium | Same as donations |
| Progress bar for large files | Low | Client-side pagination or streaming for files > 10,000 rows |
| Compassion CRM import | Low | Port wizard to `app/compassion/data-tools/` when client model is ready |
| Load saved presets in VisualImportMapper | Medium | Preset save works; preset load UI not yet implemented |
| `POST /api/constituents/import` dry-run accuracy | Medium | Constituent import dry-run skips DB checks; donation import dry-run checks receipt dedup |

## Next Steps

1. Add import history table to the data-tools page (track past import sessions with row counts).
2. Build rollback/undo for both constituent and donation imports.
3. Build preset-load UI for VisualImportMapper.
4. When the Constituent or Donation model gains new fields, update the respective `fieldMap.ts` / `donationFieldMap.ts`.
5. Port import tools to Compassion CRM module when client model is ready.

## How to Test the Import Tool

1. Navigate to `/data-tools`
2. Click **Open Import Tool →**
3. Drop the eKYROS `FileAddress_List.csv` (or any CSV) onto the upload zone
4. Observe: "Detected header row: 4" banner
5. All 37 columns auto-mapped — verify Mapped count ≈ 31, SSN blocked, Age/Keywords/BirthDate/Occupation/JobTitle → Unmapped
6. Click a row to see field details in the right panel
7. Use Search and filter tabs (All / Mapped / Unmapped / Ignored)
8. Step through to Confirm → Download Dry Run Preview (first 20 records as CSV)

