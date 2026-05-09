# Steward Signals Plan (UI-First Rollout)

## Purpose

Steward Signals is the donor-intelligence layer for Donor CRM. It combines explainable scoring, lapse detection, opportunity recommendations, and Steward-assisted next steps.

This phase is intentionally UI-first:
- clarify what will exist,
- show where AI features will appear,
- keep workflows understandable for staff,
- avoid pretending unfinished features are complete.

## Current Scope (Phase 1)

### Completed in this batch
- Added new donor route: `/steward-signals`
- Added sidebar navigation entry: **Steward Signals**
- Added placeholder dashboard cards for:
  - High Opportunity Donors
  - At-Risk / Cadence Broken
  - Monthly Giving Candidates
  - Thank-Yous Needed
- Added Opportunity Engine placeholder queue table with realistic columns and examples
- Added in-development warning banner and explicit notes about human-confirmation requirements
- Added UI notes describing where Steward AI modes will appear and what each mode will do

### Not yet complete
- Real donor score calculations (Generosity, Propensity, Lapse Risk, Opportunity)
- Real opportunity generation from signal events
- Donor profile Steward Signals widget
- Score versioning and explanation APIs
- Action confirmations wired to real task/email/report tools

## Information Architecture

## Donor CRM areas
- Steward Signals (new workspace): strategic overview and opportunity queue
- Steward Paths: workflow automation execution and run history
- Donor profile (planned): embedded Steward Signals widget

## Steward Signals sections (phase roadmap)
1. Dashboard cards
2. Opportunity Engine queue
3. Lapse Radar cohorts
4. Signal history drilldown
5. Score explanation panels
6. Steward action cards (task/email/report draft)

## UX Guardrails

- Use stewardship language, not wealth-targeting language.
- Every score or recommendation must be explainable.
- Every write action remains human-confirmed.
- Show visible in-development notices until APIs are live.
- Never imply automatic outbound communication without approval.

## API and Data Work to Start Next

1. Read APIs
- `GET /api/steward-signals/summary`
- `GET /api/steward-signals/opportunities`
- `GET /api/steward-signals/lapse-radar`
- `GET /api/steward-signals/donors/:id/widget`

2. Action APIs (confirmation required)
- `POST /api/steward-signals/opportunities/:id/create-task`
- `POST /api/steward-signals/opportunities/:id/draft-email`
- `POST /api/steward-signals/opportunities/:id/dismiss`

3. Data model rollout (first wave)
- `donor_signal_events`
- `donor_score_snapshots`
- `donor_score_components`
- `donor_lapse_status_history`
- `donor_opportunities`

## Implementation Sequence

1. Wire summary + opportunities read APIs into current placeholder UI.
2. Add donor profile widget shell and API contract.
3. Add score explanation drawer (component-level breakdown).
4. Add confirmed action cards (task + draft email first).
5. Add nightly recalculation + on-demand recalculation button behavior.

## In-UI Notes Standard

All incomplete Steward/AI areas should include one of:
- In Development Notice banner
- Placeholder badge at card level
- Explicit sentence describing planned behavior and confirmation requirement

## Ownership Notes

- Route shell: `app/steward-signals/page.tsx`
- Workspace composition: `app/components/steward/StewardSignalsPage.tsx`
- Summary cards: `app/components/steward/StewardSignalsSummaryCards.tsx`
- Opportunity queue placeholder: `app/components/steward/OpportunityEnginePlaceholderTable.tsx`
- Navigation entry: `app/components/layout/Sidebar.tsx`
