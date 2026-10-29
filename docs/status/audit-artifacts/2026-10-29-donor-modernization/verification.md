# Donor modernization verification — October 29, 2026

## Result

Implemented a chart-led donor dashboard and shared donor visual refresh. Giving trend/fund mix are primary content; retention shows its real cohort; gift averages/counts and comparable prior-year revenue explain their denominators. Fiscal and calendar reporting boundaries, historical month counts, partial periods, leap-day comparisons, and cent arithmetic have focused regression coverage.

## Canonical controls

| Control or tool | Canonical home |
| --- | --- |
| Widget visibility, order, sizes, smart layout, lock, reset, direct arrangement | Dashboard → Customize dashboard |
| Reporting basis | Desktop header; mobile Workspace tools |
| Record search | Global command search |
| Imports and data cleanup | Data Tools |
| Custom Fields | Settings → Custom Fields (`/custom-fields` redirects) |
| Notifications | Header notifications control |
| Account and administration | Compact account menu links into Profile and Settings |

The custom-field review also fixed an existing double-unwrapping error: `apiFetch` already returns the field array, so reading `.data` again had hidden saved fields. Loading, retry, mutation errors, and busy states are now explicit; mobile actions remain reachable through table scrolling.

## Checks run

- `pnpm typecheck:web` — passed against the combined donor and Compassion source.
- Focused ESLint for changed dashboard, metrics, navigation, and settings files — no errors. The reports route retains one existing unused-variable warning in its unrelated new-vs-returning handler.
- `pnpm exec vitest run tests/unit/donor-dashboard-charts.test.ts tests/unit/donor-dashboard-data.test.ts tests/unit/donor-dashboard-metrics.test.ts tests/unit/reporting-periods-and-money.test.ts tests/api/donor-dashboard-metrics.api.test.ts tests/unit/crm-sidebar-navigation.test.ts tests/unit/dashboard-ui-density.test.ts` — 44 tests passed across seven suites. API fixtures mock Prisma; no database writes.
- `node tests/e2e/donor-modern-dashboard.e2e.mjs` — eight browser checks passed: desktop/tablet/mobile layout, chart tables and averages, customization controls, source-outage isolation and retry, and signed-out protection of the Notifications route. Zero runtime errors or business writes.
- Existing donor dashboard action-flow browser suite — 18 checks passed against current canonical controls. Evidence in `actions/browser-results.json`.
- Navigation/settings browser audit — seven checks passed, including canonical controls, reporting toggle, keyboard focus, legacy redirect, saved custom fields, retry, and mobile scrolling actions. See `navigation-browser-results.json`.
- Metrics worker independently ran 63 focused checks including an America/Chicago timezone rerun and server typecheck; all passed. The seven-suite result above is the directly repeated combined audit.
- Existing `crm-visual-refresh-source.test.ts` — 11 passed and five failed on stale source strings, including the old `setSuggestions(data.stewardshipAlerts)` implementation and former Donations primitives. The preceding donor audit had already reproduced these five failures against unchanged HEAD. They are not claimed passing; current browser behavior and focused metric tests are the redesign evidence.

## Visual evidence

The browser audits first ran against current source on local development port 3652. After the combined changes were complete, the parent successfully ran `pnpm build` and `pnpm build:server`, repeated all 33 donor browser checks against the production build on port 3653, and passed the combined 115-test run across 12 suites. Final screenshots/results reflect this production-build verification, with zero browser runtime errors or business writes. The same build passed 20 Compassion browser checks; total across both apps is 53. Existing port 3651 was not restarted. Synthetic fixture charts are audit examples only, never application fallback data.

- `modern-dashboard-1440.png`
- `modern-dashboard-768.png`
- `modern-dashboard-390.png`
- `donor-settings-desktop.png` and `donor-settings-mobile.png`
- `dashboard-browser-results.json` and `navigation-browser-results.json`

## Limits

No live donor data, imports, outbound communications, payment providers, production settings, or production deployment were changed. Local browser checks establish rendering/navigation and controlled failure recovery. Metric API tests establish query scopes/formulas with mocked storage; production-data reconciliation and deployed service verification remain operational steps.
