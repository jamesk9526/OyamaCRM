# Import Tools Status

_Last deep audit: 2026-05-09_

## Summary

Donor-side import tooling is operational and API-backed for constituent and donation imports, but merge/writeback lifecycle features (history, rollback, backend merge execution) are still incomplete.

## Status Matrix

| Area | Feature | Status | Data Source | Notes | Next Step |
|---|---|---|---|---|---|
| Data Tools | Constituent import wizard | Working | Real API Data | `app/data-tools/import/ImportWizard.tsx` posts to `/api/constituents/import` with dry-run support. | Add import history UI + rollback support for accepted imports. |
| Data Tools | Donation import wizard | Working | Real API Data | `DonationImportWizard.tsx` posts to `/api/donations/import`; endpoint links constituents/campaigns/designations. | Add dry-run parity checks and rollback tooling for donation imports. |
| Data Tools | Field mapping engine | Working | Real API Data | `fieldMap.ts` + `donationFieldMap.ts` provide mapping aliases and required-field behavior. | Keep maps synchronized whenever schema fields are added. |
| Data Tools | Duplicate review + merge | Partial | Mixed Real/Demo Data | `MergeWorkflow.tsx` provides review UI but no backend merge write endpoint. | Implement `POST /api/constituents/merge` with conflict-resolution options. |
| Data Tools | Saved mapping templates | Partial | Mixed Real/Demo Data | Save support exists but load/history flow is not complete end-to-end. | Add mapping template management APIs and selector UI. |
| Data Tools | Compassion import tools | Not Started | Unknown / Needs Verification | No dedicated `/compassion/data-tools/import` with real client schema integration. | Build Compassion import flow after client/case models are implemented. |

## Real Data vs Demo Data Audit

- **Real:** constituent import and donation import endpoints are live and used by UI.
- **Mixed:** advanced mapping and duplicate merge UX includes preview-only pieces without backend merge finalization.
- **Missing:** import history, rollback/undo, and Compassion-side import support.

## Required Next Steps (Production)

1. Add import run history with operator, timestamp, file, and row-level outcome stats.
2. Add rollback/safe-revert workflow for recent imports.
3. Complete merge endpoint and replace preview-only finalize flow.
4. Keep `app/data-tools/import/fieldMap.ts` and docs aligned with every schema field added to importable entities.
