# Documentation and Agent Instructions Audit

Date: 2026-07-19

## Scope and result

Audited repository-authored Markdown outside `node_modules`, generated `dist` snapshots, and `REFERANCE_SOFTWARE`. The latter two remain historical/reference material and are not canonical documentation.

The repository now has one agent instruction source: root `AGENTS.md`. `CLAUDE.md` was a one-line delegation to that file and was removed. Tools that package a demo no longer need it; their file lists should be updated if those packaging tools are used.

## Canonical documentation

| Need | Canonical source |
|---|---|
| Project plan and architecture | `docs/MASTER_PLAN.md` and `docs/architecture/workspace-layout-system.md` |
| Current implementation status | `docs/status/features.md` |
| Release readiness | `docs/status/production-readiness-checklist.md` |
| Staff operating guidance | `docs/howto/HOW_TO_USE.md` |
| Donor email workspace | `docs/DONOR_CRM_EMAIL_BUILDER.md` |
| Letters workspace | `docs/DONOR_CRM_LETTERS_PRINTABLES.md` |
| Steward Paths | `docs/modules/donor-crm/steward-paths.md` |

## Changes made

- Removed six root tactical/planning reports. Their intended workspace direction is now implemented and documented by current module documents and status evidence.
- Removed the duplicate staff guide and updated its inbound documentation references to `HOW_TO_USE.md`.
- Updated email, letters, DonorCRM module, and office workflow docs to recognize `/oyama-email` and `/oyama-letters` as canonical routes. Code confirms legacy Communications and Letters & Printables routes redirect into those workspaces.
- Replaced restrictive, duplicated agent guidance with a single root guide that supports autonomous redesign and implementation while retaining data-safety requirements.

## Open documentation debt

- `README.md`, `docs/MASTER_PLAN.md`, and older status reports contain historical release claims. They should be refreshed only with fresh validation evidence; this audit does not treat those claims as current release certification.
- `app/oyama-email/callender` is a misspelled route alongside `calendar`. Resolve it in a route cleanup when compatibility and inbound links are reviewed.
- Several planning and audit documents predate the current workspace cutovers. They are historical context, not routing authority.
