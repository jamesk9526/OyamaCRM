# Compassion client-care verification — October 29, 2026

## Implementation and boundaries

Recovered useful code from immediately before removal commit `32c316f6`, without reverting unrelated work. `/compassion` has its own clinical shell and `/compassion/login` screen. `/api/compassion/*` and `/api/compassion-public/*` proxy to the independent API process on port 4100. Shared platform identity is retained; explicit active Compassion membership is required. The donor API entry point does not mount care routes.

Dedicated care models, configuration, transactions, audit evidence, and encryption protect client workflows. New care-only staff identities cannot access donor endpoints; donor administrator status alone does not grant chart access. Client-care operations do not create donor constituents, gifts, campaign activity, or donor audit entries. Historical medical service details require clinical capability, including read and edit paths.

## Engineering verification

- The combined focused Vitest run passed **102 tests, zero failures, zero pending**. This covers the recovered appointment utilities and public availability, import field validation and idempotency, encryption and clinical authorization, client-care API workflows, chart signing and amendments, protected documents, reviewed intake, portal access, classes/points, concurrent booking/resource conflicts, reviewed merge redirects, donor boundaries, dashboard calculations, overdue task scoping, tax calculations, annual statements, and donor appearance persistence.
- `pnpm build` completed successfully, including Next TypeScript checking and 214 generated pages. `pnpm build:server` passed. Changed TypeScript/TSX lint had no errors; the remaining warnings concern recovered booking `<img>` elements. `git diff --check` passed.
- `tests/e2e/compassion-client-care.e2e.mjs` passed **10 real-browser checks**, with no browser runtime errors. It exercised the real care API and local MySQL with a disposable synthetic organization, then cleaned its fixtures. Shared identity transport was stubbed; no existing client records or clinical data were used.
- Browser checks covered Today data, donor chrome/API isolation, client directory, interactive calendar, persisted clinical draft, intake, CSV mapping/server preview, mobile containment/navigation, donor-only denial, and the dedicated login/protected redirect. Results are in `browser-results.json`; reviewed screenshots are stored beside this document.
- API tests also assert no donor records, donations, or generic donor audit entries are created by care operations. Simultaneous public requests for the same slot produce one booking and one conflict.

## Migration evidence

The original historical Compassion migration was restored byte-for-byte. Existing tables were inspected before applying three additive care migrations through the dedicated migration script. Surviving care data was preserved. Source exports have not been supplied, so the importer currently verifies client identity CSV mapping and repeatable reconciliation rather than claiming full CenterPiece relational or medical export support. Unsupported nonempty fields require explicit exclusion; no unsupported rows are silently accepted.

Separately authorized donor work required one pending local tax-schema compatibility migration. Its before/after checks are in `donor-schema-compatibility.json` and the donor verification record. The care migration command never applies unrelated migrations.

## Clinical launch remains unapproved

No live medical migration, production deployment, outbound campaign, or clinical cutover occurred. Center-specific form/consent review, verified source exports and historical signatures, document reconciliation, hosting review, encrypted backup/restore and key recovery, retention policy, least-privilege account assignments, provider delivery, and operational cutover rehearsal remain required. PlusLink access, national/organization-specific reporting packs, and PowerPoint export are incomplete or unverified. See `../../../plans/compassion-client-care-implementation.md` for operation and rollback instructions.
