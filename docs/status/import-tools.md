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
| Data Tools | Compassion client import wizard | Working | Real API Data | `app/compassion/import/clients/CompassionClientImportWizard.tsx` posts to `/api/compassion/clients/import` with dry-run, auto-delimiter, paste-text, downloadable error report, in-file dedup, and `Full Name(Preferred)` parsing. Validation lives in `clientImportValidator.ts` (39 unit tests). | Add import-history page + rollback (Batch 2). |
| Data Tools | Compassion linked-record field mapping | Partial | Real API Data + Planned | `app/compassion/import/clients/compassionFieldMap.ts` now includes planned mappings for case/visit/assessment/pregnancy-test/referral/class/boutique fields so legacy headers can be mapped today. | Add backend write paths for linked entities and surface per-entity import results. |
| Data Tools | Compassion duplicate review center | Not Started | n/a | Today the importer warns on in-file dups but the server upserts on email match without a review queue. | Persist duplicate candidates and add `app/compassion/clients/duplicates/page.tsx` (Batch 3). |

## Real Data vs Demo Data Audit

- **Real:** constituent import and donation import endpoints are live and used by UI.
- **Mixed:** advanced mapping and duplicate merge UX includes preview-only pieces without backend merge finalization.
- **Missing:** import history, rollback/undo, and Compassion-side import support.

## Required Next Steps (Production)

1. Add import run history with operator, timestamp, file, and row-level outcome stats.
2. Add rollback/safe-revert workflow for recent imports.
3. Complete merge endpoint and replace preview-only finalize flow.
4. Keep `app/data-tools/import/fieldMap.ts` and docs aligned with every schema field added to importable entities.
5. Complete planned Compassion linked-record import paths so mapped non-client fields are persisted to client-scoped entities with audit events.
