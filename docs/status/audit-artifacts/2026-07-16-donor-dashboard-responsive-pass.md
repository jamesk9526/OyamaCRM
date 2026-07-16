# Donor Dashboard Responsive Layout Pass — 2026-07-16

## Scope

- Canonical Donor Dashboard route (`/`)
- Naturalistic Donor Dashboard command center and live-data cards
- Personal widget card shell
- Dashboard responsive governance and office guidance

## Changes

| Area | Status | Change |
|---|---|---|
| Command center | Working | Kept the compact-desktop hero focused in one column until wide desktop; live status tiles remain readable below it. |
| Focus and KPI grids | Working | Priority tiles and KPI cards now use deliberate one-, two-, three-, and five-column thresholds instead of compressing at laptop widths. |
| Giving Overview | Working | Chart and designation legend stack on narrow screens; long designation labels truncate inside the card while monetary values remain readable. |
| Recommendation cards | Working | Priority badges move under content on narrow screens and return to a trailing column at `640px` and above. |
| Activity and recent-gift panels | Working | Grid cards use `min-w-0`; the existing Recent Gifts table remains locally scrollable rather than widening the page. |
| Personal widget cards | Working | Widget shell/header now permit flex children to shrink without creating page-level horizontal overflow. |
| Browser viewport verification | Partially Working | The in-app browser was unavailable in this environment. Source-level responsive contracts and type/test validation are required; live screenshot verification should be repeated at `1280x720`, `1366x768`, tablet, and mobile when the browser is available. |

## Guardrails

- No dashboard API, live-data calculation, route, action handler, or navigation ownership changed.
- Dashboard counters, queues, and charts remain live-data or truthful empty-state surfaces.
- Responsive changes do not introduce permanent side rails below wide desktop.
