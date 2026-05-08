# Import Tools — Status

_Last updated: 2026-05-09_

## What Is Implemented

### Visual Import Mapper (`app/data-tools/import/VisualImportMapper.tsx`) ✅ NEW

Full-page, 3-column visual CSV-to-CRM mapping tool. Replaces the inline ImportWizard on the Data Tools page.
Route: `/data-tools/import`

| Step | Status | Notes |
|------|--------|-------|
| 1. Upload CSV | ✅ Working | Drag-and-drop or click; client-side parse; report-title row auto-detection |
| Header detection | ✅ Working | Detects real header by scanning for row with ≥5 non-empty non-numeric cells; shows "Detected header row: N"; user can override |
| 2. Map Fields | ✅ Working | Left sidebar stepper, top summary cards (cols / mapped / unmapped / required / % complete), per-column confidence badges (High/Med/—), grouped target field dropdown, search + filter bar, right-panel field details |
| Auto-mapping | ✅ Working | All 37 eKYROS File Address List columns pre-mapped with HIGH confidence via exact alias match |
| Sensitive field blocking | ✅ Working | SSN blocked by default; user must click "Enable" to opt in |
| Column warnings | ✅ Working | Empty columns, constant-value columns, sensitive fields all flagged with issues |
| 3. Review & Validate | ✅ Working | Data quality warnings list, stat cards, sample mapped records preview |
| 4. Import Settings | ✅ Working | Record type mode (Auto/Person/Org/Household), import mode (Dry Run/Real), preset save |
| 5. Confirm & Import | ✅ Working | Summary cards, duplicate warning, preview table, dry-run CSV download |
| Preset saving | ✅ Working | Saves mapping to `localStorage` as named preset; loadable in future sessions |

### Legacy ImportWizard (`app/data-tools/import/ImportWizard.tsx`)

Still present as a reference implementation. Not rendered from any page (replaced by VisualImportMapper).
Can be removed in a future cleanup pass.

### Field Map (`app/data-tools/import/fieldMap.ts`) — **Extended 2026-05-09**

- `CRM_CONSTITUENT_FIELDS` — 37 constituent fields across 8 groups (Identity, Organization, Address, Phone, Email, Household, Status, Metadata, Tags)
- `AUTO_MAP_ALIASES` — 60+ case-insensitive header aliases including all eKYROS column names
- `SENSITIVE_FIELD_KEYS` — set of source column names that require explicit opt-in (SSN, etc.)
- `ALWAYS_SKIP_DEFAULTS` — columns known to be empty/useless in this source (Age, BirthDate, Keywords, etc.)
- `CONSTANT_VALUE_NOTES` — columns with constant values (Location = "Aurora")
- **Must be updated** whenever a new importable field is added to the Constituent model

### Dry-Run Mode

- Always available as a mode toggle in Import Settings step
- Downloads first 20 mapped records as CSV for review
- Must never be removed; real-import path requires backend wiring (see TODO below)

## What Is Missing

| Item | Priority | Notes |
|------|----------|-------|
| `POST /api/constituents/bulk` backend endpoint | High | `// TODO: backend API needed` in VisualImportMapper.tsx Step 4 confirm handler — currently downloads CSV instead of writing to DB |
| Import history log | Medium | Show a log of past imports with undo support |
| Rollback / undo import | Medium | Allow reverting a bulk import within N hours |
| Merge on duplicate (import-time) | Medium | UI exists to flag dupes; actual merge/update/skip logic needs backend |
| Progress indicator for large files | Low | Client-side pagination or streaming for files > 10,000 rows |
| Compassion CRM import | Low | Port wizard to `app/compassion/data-tools/` when client model is ready |
| Server-side field validation | High | Phone normalize, email validate, ZIP format — currently display-only transforms |
| Load saved presets | Medium | Preset save works; preset load UI not yet implemented |
| Remove legacy ImportWizard | Low | Safe to delete once team confirms VisualImportMapper covers all use cases |

## eKYROS File Address List — Field Mapping Reference

The VisualImportMapper auto-maps all 37 eKYROS columns at HIGH confidence:

| eKYROS Column | CRM Field | Notes |
|---|---|---|
| DirID | External Source ID | Used as dedup key on re-imports |
| FullName | Display Name | |
| Title | Prefix / Title | |
| FirstName | First Name | |
| LastName | Last Name | |
| DearName | Greeting / Dear Name | |
| ProperName | Formal Name | |
| Address | Mailing Address Line 1 | |
| City | Mailing City | |
| State | Mailing State | |
| Zip | Mailing ZIP | |
| SpouseName | Spouse / Household Member | |
| Organization | Organization Name | |
| Occupation | Occupation | ⚠ Empty in source |
| JobTitle | Job Title | ⚠ Empty in source |
| Church | Church Affiliation | |
| HomePhone | Primary Phone | |
| CellPhone | Mobile Phone | |
| WorkPhone | Work Phone | |
| SpousePhone | Spouse Phone | |
| Email | Primary Email | |
| SpouseEmail | Spouse Email | |
| Website | Website | |
| SSN | 🔒 BLOCKED | Requires explicit opt-in |
| BirthDate | — Do Not Import — | ⚠ Empty in source |
| Age | — Do Not Import — | ⚠ Always 0 |
| Gender | Gender | |
| DateCreated | Source Created Date | |
| DateModified | Source Modified Date | |
| LastUpdatedBy | Source Last Updated By | |
| IsOKToContact | Communication Preferences | |
| Location | Location / Center | ℹ Always "Aurora" |
| HoldMail | Do Not Mail / Hold Mail | |
| Status | Constituent Status | |
| DeceasedDesc | Deceased Flag | |
| SpouseDeceasedDesc | Spouse Deceased Flag | |
| Keywords | Tags / Keywords | ⚠ Empty in source |

## Next Steps

1. Implement `POST /api/constituents/bulk` with dry-run flag, upsert-by-externalId, and per-row result reporting.
2. Wire the VisualImportMapper confirm step to call the endpoint.
3. Add import history table to the data-tools page.
4. Build preset-load UI (read from localStorage presets array).
5. When the Constituent model gains new fields, update `CRM_CONSTITUENT_FIELDS` and `AUTO_MAP_ALIASES` in `fieldMap.ts`.

## How to Test the Import Tool

1. Navigate to `/data-tools`
2. Click **Open Import Tool →**
3. Drop the eKYROS `FileAddress_List.csv` (or any CSV) onto the upload zone
4. Observe: "Detected header row: 4" banner
5. All 37 columns auto-mapped — verify Mapped count ≈ 31, SSN blocked, Age/Keywords/BirthDate/Occupation/JobTitle → Unmapped
6. Click a row to see field details in the right panel
7. Use Search and filter tabs (All / Mapped / Unmapped / Ignored)
8. Step through to Confirm → Download Dry Run Preview (first 20 records as CSV)

