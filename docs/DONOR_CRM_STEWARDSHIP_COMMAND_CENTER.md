# DonorCRM Stewardship Command Center

Last updated: 2026-05-12

DonorCRM should help staff answer three daily questions:

1. How are we doing?
2. Who needs attention?
3. What should we do next?

## Command-Center Principles

- Show real operational signals first, not decorative metrics.
- Make every high-priority metric clickable into a workflow.
- Use suggestion language for insights and signals.
- Keep acknowledgment and follow-up loops visible end-to-end.
- Prefer small, safe enhancements over broad rewrites.

## Daily Stewardship Loop

1. Review dashboard attention widgets.
2. Open constituent profile and confirm giving/communication context.
3. Verify donation acknowledgment status.
4. Generate letter and optional draft email.
5. Create and assign follow-up tasks.
6. Log outcomes in timeline/activity.

## Current Implementation Anchors

- Dashboard: [app/page.tsx](app/page.tsx)
- Dashboard components: [app/components/dashboard](app/components/dashboard)
- Donations API: [server/src/routes/donations.ts](server/src/routes/donations.ts)
- Letters API: [server/src/routes/letters.ts](server/src/routes/letters.ts)
- Communications API: [server/src/routes/email-campaigns.ts](server/src/routes/email-campaigns.ts)
- Tasks API: [server/src/routes/tasks.ts](server/src/routes/tasks.ts)
- Steward Paths APIs: [server/src/routes/automations.ts](server/src/routes/automations.ts), [server/src/routes/steward-paths.ts](server/src/routes/steward-paths.ts)

## Feature Status Registry Keys (DonorCRM)

These keys are tracked in [docs/status/features.md](docs/status/features.md) and should use only approved status labels.

- donor.dashboard
- donor.constituents
- donor.constituentProfile
- donor.donations
- donor.campaigns
- donor.grants
- donor.payments
- donor.tasks
- donor.meetings
- donor.communications
- donor.lettersPrintables
- donor.livecom
- donor.stewardPaths
- donor.stewardSignals
- donor.volunteers
- donor.reports
- donor.dataTools
- donor.customFields

## Safety Rules

- Do not auto-send emails by default from steward workflows.
- Do not silently merge records in data tools.
- Do not represent AI signals as certainty.
- Do not hide partial features; label them clearly.
- Keep donor data isolated from compassion/client data unless intentionally linked.
