# Compassion workspace refresh verification — October 29, 2026

## Delivered

- Grouped daily work, care coordination, and supporting tools in a separate Compassion sidebar. Follow-ups and Client letters are directly discoverable.
- Moved Migration into Settings at `/compassion/settings/migration`. Both `/compassion/import/clients` and `/compassion/data-tools` redirect to this canonical route.
- Separated Staff directory, Access & roles, Rooms & resources, Website booking, Staff hours, and Audit history into one settings menu. The overview no longer duplicates staff, membership, or resource forms. Settings controls mount only for the required care capability; server permission checks remain authoritative.
- Added client-directory search in the header, URL search/status handoff, direct appointment-creation shortcuts, actionable Today follow-ups, and explicit queue failure/retry states.
- Simplified Cases and Follow-ups by removing duplicate ribbon actions/status controls. Follow-ups now show the task title and linked client, and completion failures remain visible without hiding the queue. Schedule groups view controls and puts secondary window actions in Calendar options. Directory tools have one menu.
- Refreshed typography, spacing, cards, forms, calendar colors, mobile layouts, focus states, and navigation. All care styling remains under the Compassion boundary, distinct from the donor redesign.

## Verification

- `pnpm build` — passed, including TypeScript and 218 generated static pages.
- `pnpm build:server` — passed.
- `pnpm exec eslint app/components/compassion app/compassion --quiet` — passed. The existing booking page has two image-optimization warnings in the non-quiet lint output; no new lint warnings remain in the care navigation.
- Combined focused Vitest run — **115 tests passed across 12 suites**: four care unit suites, the real-database care API suite, and seven donor calculation/data/navigation suites. Of these, **71** exercise Compassion security, scheduling, import validation, and API workflows. No live records were used.
- `COMPASSION_UI_WEB=http://localhost:3653 node tests/e2e/compassion-workspace-refresh.e2e.mjs` — **10 browser checks passed** against the new production build. Verified navigation, Migration redirects, client search, follow-up completion, reviewed membership assignment, resource creation/filtering, direct appointment creation, 390px viewport containment, Escape support, retry after service failure, and restricted settings access. Isolated synthetic responses; zero database writes or runtime errors.
- Existing `compassion-client-care.e2e.mjs`, through `node --import tsx` with `COMPASSION_E2E_WEB=http://localhost:3653` — **10 browser checks passed** against the production build and real care API/MySQL. Disposable organization fixtures were removed afterward. Verified client directory, calendar, persistent clinical draft, intake, import mapping/preview, mobile navigation, access denial, login, and donor isolation. Results are in `real-api/`; earlier audit evidence was preserved.
- All three donor browser suites were also repeated against this same production build: **33 checks passed**. Total across the combined work: **53 browser checks**, zero runtime errors.
- `git diff --check` — passed.

## Evidence and limits

`today-1440.png`, `today-390.png`, `settings-1440.png`, and `settings-390.png` show the production build with synthetic UI fixtures. `browser-results.json` records the ten new UI checks. `real-api/` records the separate care integration/browser verification.

Development verification initially hit Next's local-origin/hot-reload issues; the final production-build checks passed without those errors. No production deployment, live client/donor write, outbound communication, or clinical cutover occurred. Existing clinical-launch requirements remain unchanged. Donor metric/storage limitations and five previously documented stale visual-source assertions are recorded in `../2026-10-29-donor-modernization/verification.md`.
