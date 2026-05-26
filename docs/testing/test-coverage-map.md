# Test Coverage Map

Status labels:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

| Module | Smoke | E2E | API | Unit | Mobile | Status | Notes |
|---|---|---|---|---|---|---|---|
| Authentication | Working | Partially Working | Working | Working | Partially Working | Partially Working | E2E auth path now covered; MFA matrix still missing. |
| Donor CRM | Working | Partially Working | Partially Working | Working | Partially Working | Partially Working | Core donor smoke exists; broader workflow E2E remains partial. |
| Compassion CRM | Partially Working | Partially Working | Partially Working | Working | Partially Working | Partially Working | Import validator units strong; client-profile E2E depth pending. |
| Events CRM | Partially Working | Partially Working | Partially Working | Partially Working | Partially Working | Partially Working | CRUD/API smoke exists; scoped workspace E2E needs expansion. |
| HRM | Partially Working | Not Implemented | Partially Working | Not Implemented | Not Implemented | Not Implemented | HRM smoke API lane exists; dedicated E2E/mobile still missing. |
| Watchdog | Working | Partially Working | Working | Partially Working | Partially Working | Partially Working | New ops smoke + api + E2E baseline added. |
| WebMaster | Partially Working | Not Implemented | Not Implemented | Not Implemented | Not Implemented | Not Implemented | Requires dedicated API and E2E suite expansion. |
| Standalone apps (`/apps/*`) | Partially Working | Not Implemented | Not Implemented | Not Implemented | Partially Working | Not Implemented | Route smoke checks include `/apps` and `/apps/trivia`; deeper tests missing. |
| Communications | Partially Working | Partially Working | Partially Working | Working | Partially Working | Partially Working | Draft/queue guard regression coverage still needed. |
| Letters & Printables | Partially Working | Not Implemented | Not Implemented | Working | Not Implemented | Partially Working | Unit merge/layout covered; route/API workflow expansion needed. |
| Steward Paths | Working | Working | Not Implemented | Working | Working | Working | Engine/helper unit tests and API contract tests are present; builder E2E remains a coverage-depth follow-up. |
| Reports | Working | Partially Working | Partially Working | Working | Partially Working | Partially Working | Smoke is strong; export and empty-state E2E assertions pending. |
| Data Tools / Importer | Partially Working | Not Implemented | Not Implemented | Working | Not Implemented | Partially Working | CSV fixtures added; flow E2E/API dry-run coverage still pending. |
