# Dashboard Data Rules

## No Fake Production Data

Production dashboard components must not display fake totals, placeholder donor counts, sample campaign values, random trends, or mock activity rows.

Allowed states:

- Real values from organization-scoped APIs.
- Seeded demo values only in explicit demo/development mode.
- Loading skeletons.
- Empty states.
- Partial or Coming Soon labels when a calculation is not implemented.

## Empty State Copy

Use direct, practical empty states:

- `No gifts recorded for this period.`
- `No open stewardship tasks.`
- `No donor movement yet.`
- `No campaign data available.`
- `Connect/import donor data to populate this card.`

## Dashboard Data Layer

The dashboard body should consume data through `app/features/donor-dashboard/services/dashboard-client-service.ts`.

Cards should not invent default numbers. If an adapter fails, the card receives an empty array, zero total, or `null` trend and renders an empty/error-safe state.
The dashboard shell also shows a section-level warning when one or more dashboard requests fail, so request failures are not hidden as normal empty data.

## Deterministic Stewardship Alerts

Steward Intelligence starts with deterministic rules:

- Overdue Tasks: pending tasks with due dates before today.
- Retention Needs Attention: real retention rate below the configured threshold.
- First-Time Donors: constituents whose first gift is in the reporting period.
- Pending Tasks: open task queue count.
- Acknowledgment Queue: recent completed donations where `acknowledgmentSentAt` is empty.
- This Month's Donors: current-month donor records from `/api/reports/donors-this-month`; load failures must render an explicit unavailable/error state, not `$0`.
- Giving Source Mix: payment methods grouped from the recent completed donation result set.
- Donor Health Snapshot: summary, task, and retention API values displayed together without generated scores.

AI can summarize these signals, but dashboard counts must come from CRM data first.

## Formatting

Use locale-aware number and currency formatting. Do not hand-format strings that can produce broken values such as `4,30` or `$245,60`.

## Current Status

- Working: summary metrics, giving trend, designation breakdown, recent gifts, this-month donor workflow, active campaigns, assigned due tasks, appearance settings.
- Partial: broader donor movement beyond donations, such as notes and letters, depends on additional activity feed adapters.
- Partial: major gift thank-you opportunity counts need a dedicated API that joins completed donations to completed thank-you tasks.
