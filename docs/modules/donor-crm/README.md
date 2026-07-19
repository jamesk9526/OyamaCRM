# DonorCRM Module Guide

Last updated: 2026-07-19

This guide explains the current DonorCRM in plain office workflow language.

## What DonorCRM Is For

Use DonorCRM to manage donors, gifts, campaigns, stewardship follow-up, and fundraising reporting in one workspace.

## Workspace operating standard

- Use canonical dedicated workspaces for major tools (for example, OyamaEmail, OyamaLetters, Steward Paths).
- Prefer one-direction progression inside each workspace: overview -> build/edit -> review -> activate -> history.
- Treat legacy routes as compatibility paths when canonical replacements exist.

## Dashboard

- Start here each morning for revenue, retention, and stewardship attention summaries.
- Use links inside widgets to jump directly to donations, tasks, letters, and constituents.

## Constituents

- Search first to avoid duplicate records.
- Open the profile to review contact details, giving, timeline, tasks, notes, and stewardship actions.
- Use quick actions on the profile for Gift, Letter, Communication, Task, Meeting, and Steward Path.

## Donations

- Record new gifts from Donations -> Record Gift.
- Use Complete Loop to run first-pass stewardship in one click:
  - Email draft
  - Follow-up task
  - Steward path enrollment
- Use row actions for letter generation, call tasks, and acknowledgment status.

## Campaigns

- Use campaign list for active fundraising programs.
- Open campaign detail to review/edit campaign configuration and connected giving context.

## OyamaEmail

- Use `/oyama-email` for email templates, audience selection, campaign review, sending, queue work, and analytics.
- `/communications/*` is retained only as a compatibility redirect.

## OyamaLetters

- Use `/oyama-letters` to manage letter templates and generate print-ready donor communications.
- Use its queue and batch views for operational handoff.
- Use email draft bridge when a printed letter should also have an email touchpoint.

## Steward Paths

- Open /steward-paths for saved visual paths and path operations.
- Open /steward-paths/builder for new visual workflow creation.
- Open /steward-paths/builder/:id for editing existing paths.
- /automations is deprecated and redirects to /steward-paths.

## Reports

- Use reports for fundraising and donor trend visibility.
- Confirm date/year scope before sharing numbers externally.

## Data Tools and Imports

- Use import wizard for constituent and donation CSV onboarding.
- Validate mapping and dry-run behavior before applying records.
- Treat merge workflow as non-authoritative until merge backend is fully completed.

## Settings

- Use donor-related settings for workflow policy, module config, and organization-level controls.
- Keep operational work (donations, tasks, campaigns) in module pages, not settings screens.

## Common Workflows

1. New donation follow-up:
   - Record gift -> Complete Loop -> open draft/task/path artifact -> finish acknowledgment.
2. Constituent stewardship:
   - Open profile -> review timeline/giving/tasks -> create communication or letter -> create follow-up task.
3. Campaign execution:
   - Open campaign -> update details -> launch communication draft -> monitor tasks and reports.

## Known Partial Features

- Merge workflow is still demo-only in parts.
- Some stewardship signal widgets show read-only shell language while deeper orchestration is still rolling out.
- E2E automation lanes are currently failing due environment contract mismatch and do not yet represent a green release gate.

## If Something Fails

1. Capture route, action, and timestamp.
2. Capture screenshot and copy error text if visible.
3. Try the closest alternate path (for example, open communication from constituent or donations row instead of dashboard link).
4. Report issue with exact reproduction steps.

## References

- Browser QA report: [browser-qa-report.md](browser-qa-report.md)
- Steward Paths module detail: [steward-paths.md](steward-paths.md)
- Screenshot index: [../../screenshots/donor-crm/README.md](../../screenshots/donor-crm/README.md)
- Feature matrix: [../../status/features.md](../../status/features.md)
- Production readiness checklist: [../../status/production-readiness-checklist.md](../../status/production-readiness-checklist.md)
