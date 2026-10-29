# Donor workspace modernization — October 29, 2026

## Intent

Make Donor CRM easier to scan and use, with visible graphs, trustworthy statistics, and one primary home for each configuration control. Keep the donor app distinct from Compassion and Events. Preserve existing routes and functional workflows.

## Implemented structure

- The dashboard leads with giving, completed gifts, average gift, and unique active donors. Current and matched prior-year monthly giving and a complete fund-mix chart are visible without opening optional widgets.
- Retention shows the actual prior-year donor cohort, retained count, and donors yet to give. No invented target or seasonal risk classification is applied.
- Optional specialized widgets and Steward recommendations remain available. The main fund chart replaces its duplicate in the recommendations disclosure.
- Customize dashboard is the single entry to widget visibility, size, order, layout strategy, lock, restore, and direct arrangement. Revenue-widget configuration remains inside the same dialog.
- Global search owns record search; the duplicate Find/Browse/Add constituent row is removed from the dashboard. Quick Add and the Constituents workspace retain the existing creation paths.
- Donor account navigation focuses on profile, settings, help, feedback, and sign-out. The reporting-period selector has one desktop header location and one mobile Workspace tools location.
- Data Tools owns imports. Settings owns Custom Fields at `/settings/custom-fields`; `/custom-fields` redirects compatibly. Notifications remain in the header.
- Donor theme tokens, cards, form corners, header hierarchy, charts, and navigation use a consistent responsive design. Visual overrides require the donor appearance attribute and do not style Compassion.

## Calculation contract

- Only completed gifts contribute to the main revenue, count, average, and fund charts. Grant awards remain separate and explicitly excluded from the primary chart.
- Average gift is completed-gift revenue divided by completed-gift count, rounded to cents. Average per donor uses unique active donors as denominator.
- Prior-year comparisons use matching date/time cutoffs, preserve exclusive historical year boundaries, clamp leap day, and return no percentage when the comparison baseline is zero or absent.
- Donation calendar/fiscal boundaries match UTC date-only gift storage. The prior-month comparison uses the same UTC basis as current MTD.
- Monthly buckets preserve fiscal order, include observed gaps, exclude future months in current YTD, and support custom-date/all-time scopes. Historical years contain twelve buckets.
- Chart aggregation uses integer cents. Smaller fund slices are grouped into Other funds so the donut and percentages represent the complete total.

## Validation and limits

See `../status/audit-artifacts/2026-10-29-donor-modernization/verification.md`. Browser checks use explicit synthetic fixtures, with business writes blocked. No production deployment, stored donor edits, outbound communication, or provider action was performed.
