# Import Tools — Status

_Last updated: 2025-07-14_

## What Is Implemented

### CSV Import Wizard (`app/data-tools/import/ImportWizard.tsx`)

| Step | Status | Notes |
|------|--------|-------|
| 1. Upload CSV | ✅ Working | Drag-and-drop or click; client-side file read |
| 2. Map Fields | ✅ Working | Auto-map from `AUTO_MAP_ALIASES`; per-column `<select>`; required field highlight |
| 3. Validate & Preview | ✅ Working | Row counts, data quality score bar, dry-run preview table (first 10 rows) |
| 4. Duplicate Detection | ✅ Working | Client-side email match against loaded constituents; new vs. duplicate row counts |
| 5. Confirm | ✅ Working | Import summary; "Download Mapped CSV" button; placeholder message for backend |

### Field Map (`app/data-tools/import/fieldMap.ts`)

- `CRM_CONSTITUENT_FIELDS` — all constituent fields that can be mapped
- `AUTO_MAP_ALIASES` — case-insensitive header-to-field alias dictionary
- **Must be updated** whenever a new importable field is added to the Constituent model

### Dry-Run Mode

- Dry-run is always active in the current implementation (no data is written without a backend)
- Step 3 preview table shows exactly what would be imported
- Must never be removed; any future backend integration must preserve dry-run as an explicit option

## What Is Missing

| Item | Priority | Notes |
|------|----------|-------|
| `POST /api/imports/constituents` backend endpoint | High | Wire Step 5 "Confirm Import" to actually create records |
| Import history log | Medium | Show a log of past imports with undo support |
| Rollback / undo import | Medium | Allow reverting a bulk import within N hours |
| Merge on duplicate (import-time) | Medium | Offer update-if-exists vs. skip-if-exists vs. create-duplicate |
| Progress indicator for large files | Low | Client-side pagination or streaming for files > 10,000 rows |
| Compassion CRM import | Low | Port wizard to `app/compassion/data-tools/` when client model is ready |
| Server-side field validation | High | Email format, phone format, ZIP format checks |
| Import for non-constituent types | Low | Donations, campaigns — separate wizards needed |

## Next Steps

1. Implement `POST /api/imports/constituents` in the backend (Express) with dry-run flag support.
2. Wire Step 5 of `ImportWizard.tsx` to call the endpoint.
3. Add import history table to the data-tools page.
4. Add `// TODO: backend API needed` is already in place in Step 5 of the wizard.
5. When the Constituent model gains new fields, update `CRM_CONSTITUENT_FIELDS` and `AUTO_MAP_ALIASES`.

## How to Test the Wizard

1. Navigate to `/data-tools`
2. In the "Import Constituents" section, drag or select a CSV file
3. Adjust column mappings if needed
4. Step through validation, duplicate detection, and confirm
5. Download the mapped CSV from Step 5
