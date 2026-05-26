# Donor Dashboard

The DonorCRM dashboard is the stewardship home page for live donor work. It preserves the global OyamaCRM sidebar and top bar, then renders a configurable dashboard workspace inside that app shell.

## Data Sources

- Total Giving: `/api/reports/giving-trend`, summed from completed donations in the selected reporting scope.
- Active Donors: `/api/reports/summary`, unique constituents with completed gifts in the selected reporting scope.
- New Donors: `/api/reports/summary`, constituents whose first gift falls inside the selected reporting scope.
- Follow-Ups Needed: `/api/reports/summary`, pending plus overdue tasks.
- This Month: `/api/reports/summary`, completed gifts from the current calendar month.
- Who Gave This Month: `/api/reports/donors-this-month`, current-month donors with gift totals, latest gift dates, task creation, saved audience-list handoff, and email draft starters.
- Giving by Designation: `/api/reports/designations-summary`, completed donations grouped by designation.
- Recent Donor Movement: `/api/donations?limit=20&status=COMPLETED`.
- Acknowledgment Queue: recent completed donations without `acknowledgmentSentAt`.
- Giving Source Mix: payment methods grouped from recent completed gifts.
- Donor Health Snapshot: active donors, first-time donors, pending/overdue tasks, and retention cohort counts.
- Campaign Impact: `/api/campaigns?active=true&limit=6`.
- My Due Tasks: `/api/tasks?status=PENDING&limit=5&queue=assigned-to-me`.

## Appearance Settings

Dashboard appearance is managed from `Settings > Dashboard Appearance` and stored in the `donor-dashboard-appearance` plugin setting.

Configurable fields include header image, image position, overlay color and strength, optional quote card, hero greeting style, hero height, dashboard density, primary hero actions, and section visibility.
Admins can also show or hide the metric strip from the same settings page.
Follow-up widgets can be shown or hidden as a group from the same settings page.
The current-month donor workflow can be shown or hidden separately from both organization appearance settings and the personal dashboard customizer.

If no header image is configured, the dashboard uses a green Oyama gradient fallback. No stock or fake donor photo is shown.

## Retention

Retention is returned by `/api/reports/donor-retention`.

Calculation policy:

- Prior-period donors are constituents who gave in the prior comparable reporting period.
- Retained donors are prior-period donors who also gave in the current reporting period.
- Retention rate is `retained donors / prior-period donors`.

The dashboard displays a real retention result when available. If no prior-period donor cohort exists, the retention card shows an empty state rather than a made-up rate.

## Testing

Recommended checks:

- Load `/` with real data and verify metric values match source reports.
- Load `/` with an empty database and verify empty states instead of fake numbers.
- Save dashboard appearance settings and verify the hero updates.
- Confirm Record Gift, View Reports, and Open Tasks route correctly.
- Verify assigned task completion from My Due Tasks.
- Check responsive layout at `1366x768`, `1280x720`, tablet, and mobile widths.
