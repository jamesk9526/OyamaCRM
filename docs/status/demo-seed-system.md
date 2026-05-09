# Demo Seed System

## Purpose

The demo seed system creates **deterministic, privacy-safe synthetic CRM data** for platform-wide testing.

It is designed for:
- search and global search stress tests,
- dashboard and reporting realism,
- pagination/filtering stress,
- importer validation and duplicate-review edge cases,
- workflow/automation run-history testing,
- Steward Signals and opportunity recommendation testing,
- AI/RAG retrieval on realistic timeline notes and summaries.

Every generated record is marked as synthetic using one or more markers:
- ID prefixes: `demo_*`
- textual marker: `[DEMO DATA - SYNTHETIC RECORD]`
- import fixtures under `prisma/demo-imports/`
- invalid-safe domains: `*.demo.oyamacrm.invalid`

## Dataset Profiles

The seed supports deterministic profile sizes:
- `small` (default): local development and quick smoke testing
- `medium`: deeper QA and integration checks
- `large`: stress/perf test environments

Determinism key:
- controlled by `--seed <key>` or env `DEMO_SEED_KEY`
- defaults to `oyamacrm-demo-seed-v1`

## Commands

### Seed

```bash
pnpm db:seed:small
pnpm db:seed:medium
pnpm db:seed:large
```

Equivalent custom seed key examples:

```bash
pnpm db:seed:medium -- --seed team-qa-2026-05
pnpm db:seed:large -- --seed perf-baseline-01
```

### Verify

```bash
pnpm db:verify:demo
```

Verification checks:
- demo donors/constituents/donations/events/guests/clients exist,
- demo automations and steward run-history logs exist,
- steward signal custom fields/values exist,
- import fixture files exist.

### Reset + Seed + Verify

```bash
pnpm db:reset:demo
```

This does:
1. `prisma migrate reset --force --skip-seed`
2. `pnpm db:seed:small`
3. `pnpm db:verify:demo`

## What Gets Seeded

## Donor CRM
- Baseline seeded records (existing IDs) are preserved.
- Additional deterministic synthetic constituents with lifecycle variety:
  - new donors
  - recurring donors
  - major donors
  - lapsed donors
  - mail-only donors
  - event sponsors / table hosts
  - donors with incomplete contact info
- Synthetic donation history including:
  - completed, pending, failed, refunded gifts
  - recurring gift patterns
  - event-linked gifts
- Tasks, meetings, notes, activities for timeline and AI retrieval testing.
- Email campaign records for communication analytics views.

## Events CRM
- Synthetic events with realistic statuses and date windows.
- Ticket types (individual, VIP, table host package).
- Sponsorships and table assignments.
- Orders, order items, guests, check-in codes, RSVP/payment statuses.
- Volunteer hour records for event operations reporting.

## Compassion CRM
- Synthetic privacy-safe clients, never linked by default to donor records.
- Cases, appointments, services, follow-ups, and compassion activities.
- Includes pregnancy tests and ultrasound appointment/service patterns.
- Private notes are clearly marked as synthetic.

## Steward Paths / Signals
- Demo automation workflows and action chains.
- Synthetic `STEWARD_PATH_RUN` audit logs for run-history UI/API.
- Steward signal custom fields + values:
  - generosity score
  - lapse risk
  - opportunity score
  - recommendation narrative
- High-opportunity and lapse-risk demo tag segmentation.

## Import Fixtures and Edge Cases

Generated at:
- `prisma/demo-imports/donors-clean.csv`
- `prisma/demo-imports/donors-messy.csv`
- `prisma/demo-imports/clients-messy.csv`
- `prisma/demo-imports/manifest.json`

Messy fixture coverage includes:
- duplicate source IDs,
- duplicate person rows,
- invalid emails,
- missing values,
- metadata-like garbage rows,
- malformed quote rows.

## Safety and Data Boundary Notes

- Demo client records are synthetic and are not linked to donor records by default.
- Demo records are intentionally marked as synthetic in IDs, notes, and metadata.
- Demo domains are non-deliverable (`.invalid`) to prevent accidental outbound use.
- Steward/automation records are synthetic and marked in metadata for easy filtering.
