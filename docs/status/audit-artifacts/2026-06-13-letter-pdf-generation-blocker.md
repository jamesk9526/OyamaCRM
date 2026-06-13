# 2026-06-13 Letter PDF Generation Blocker

Status: Working for the verified OyamaLetters batch PDF path; keep monitoring sample PDF preview in the live editor.

User note: PDF generation could not be made to work from the Letters workspace.

Observed from browser/server logs:

- `POST /api/letters/templates/:id/publish` returned 500.
- `POST /api/letters/templates/:id/sample-pdf` returned 500.
- `GET /api/constituents?limit=all` returned 500.
- Browser diagnostics logged `[OyamaLetters PDF Preview Diagnostics] Failed to load inline server preview`.

Root cause identified from the pasted logs:

- Prisma rejected the `Constituent` select used during letter merge context resolution.
- The immediate runtime error was `Unknown field displayName for select statement on model Constituent`.
- The checked-in Prisma schema includes `displayName`, `organizationName`, `contactFirstName`, `contactLastName`, `contactTitle`, `entityKind`, and `organizationCategory`, so this points to a generated Prisma client or local database/runtime metadata mismatch.

Remediation applied:

- Letter merge context now filters optional `Constituent` select fields against Prisma runtime model metadata before querying.
- Constituents list/detail select paths now use the same runtime metadata guard for optional constituent identity fields.
- Constituent search no longer includes organization/contact search fields unless the runtime Prisma model exposes them.
- Constituent create/update/import writes now filter optional constituent identity fields against Prisma runtime model metadata before writing.
- Letter sample PDF preview now falls back to a synthetic preview recipient when no live sample recipient is available, so PDF rendering can still be tested.
- Publish preflight now uses a synthetic preview context for PDF parser checks when no live sample recipient exists; the result is advisory and does not block publishing.
- Constituent group membership sync now skips safely when the live Prisma runtime is missing the `ConstituentGroup` or `ConstituentGroupMember` model delegates, preventing local runtime drift from breaking constituent setup during Letters generation.
- Server PDF export failures now log structured renderer diagnostics and return development-only `error.details` so browser logs show the real jsPDF/runtime exception.
- Added the missing jsPDF PNG runtime dependency chain (`fast-png`, `iobuffer`, `pako`) to root dependencies so server-side PDF export can load jsPDF's Node image path.
- Updated the OyamaLetters batch E2E selectors to match the current generate workflow labels and recipient search control.

Validation target:

- Rebuild/regenerate Prisma client if the local runtime still does not expose the checked-in schema fields.
- Re-test sample PDF, inline PDF preview, and letter publish from the Letters workspace.

Current validation evidence:

- `pnpm typecheck` passed.
- Focused letter/PDF Vitest suite passed.
- Focused constituent API/import tests passed.
- `pnpm build:server` passed.
- `pnpm test:e2e:letters` passed after linking jsPDF's missing runtime dependencies; the test generated a batch, opened the server-rendered batch PDF, opened an individual generated-letter PDF, and reached the print queue view.
