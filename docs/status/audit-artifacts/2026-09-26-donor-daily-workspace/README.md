# Donor CRM daily workspace audit — 2026-09-26

The daily Donor CRM surface was simplified around finding constituents, reviewing verified relationship history, and taking follow-up actions. The browser fixtures in `tests/e2e/fixtures/donor-daily-workspace.mjs` replace read responses only; authentication remains real, and the fixture records are never written to the database.

## Scope checked

| Area | Evidence |
|---|---|
| Navigation | Shared desktop/mobile destinations, permission and role filtering, QuickBooks availability, nested active state, mobile focus trap, Escape/focus return, and route dismissal. |
| Dashboard | Search focus, recent constituent-linked gifts, follow-up loading/error/empty states, compact performance summary, and customization dialog. |
| Directory | Search, quick views, filters, current-page sorting/selection, optional columns, retry, and filtered empty results. |
| Profiles | Individual, organization, and household layouts; primary actions, More panels, Members, existing gift-entry modal, and guarded communication actions. |
| Donations | Filter and acknowledgment context, row/batch actions, Record Gift modal, and legacy `/donations/new` redirect. |

Chromium screenshots are in [fixtures](fixtures/). The 24 viewport/route combinations cover 390, 768, 1024, and 1440 pixels for the dashboard, directory, donations, and three constituent types. Each rendered with one visible page heading and no page-level or main-content horizontal overflow. Selected examples: [phone dashboard](fixtures/dashboard-390.png), [desktop directory](fixtures/constituents-1440.png), [phone household](fixtures/profile-household-390.png), [desktop donations](fixtures/donations-1440.png).

## Commands and results

- `pnpm typecheck:web` — passed.
- `node node_modules/next/dist/bin/next build .donor-qa-runtime --webpack` — passed using a temporary isolated copy of the frontend. The temporary copy was removed after QA.
- ESLint through `node node_modules/eslint/bin/eslint.js` for the changed Donor TypeScript/JavaScript files — passed.
- Focused non-database Vitest files for navigation, dashboard density, constituent/donation utilities, tax calculations, account-closure and research source checks, and appearance — 63 tests passed.
- `tests/smoke/donations-crud.test.ts` — 4 passed, 13 failed. The local MySQL schema is missing `Donation.taxDeductibleAmount`; the initial read/create failures cascade through dependent CRUD cases. The UI change neither added nor migrated this field.
- Authenticated Chromium against the isolated production build with browser-only read fixtures — 24 responsive route checks and 10 interaction checks passed together with no runtime errors. Restricted email actions, all three secondary profile panels, out-of-order search responses, and mobile keyboard focus were included. [Machine-readable checks](fixtures/results.json).
- Authenticated live-data error-state check at 390 pixels — the donations page showed a plain load error and working Retry control without a false empty result, server-start command, or horizontal overflow. [Error-state check](live-error-check.json) and [screenshot](live-donations-error-390.png).

## Remaining production proof

Synchronize the local/deployment database with the repository's existing schema through the normal migration process, rerun donation CRUD and live authenticated profile/donation checks, and verify real communication preferences and acknowledgment state. The fixture pass establishes the interface states and handoffs, not persistence or provider delivery. No migration, data import, outbound message, or gift write was performed during this audit.
