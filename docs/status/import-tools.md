# Import Tools Status

_Last deep audit: 2026-05-16_

## Summary

Donor-side and Compassion-side import tooling is operational and API-backed for constituent/client and donation imports. Import parsing/mapping was hardened for real eKYROS exports (including wrapped multiline cells and legacy header names), but merge/writeback lifecycle features (history, rollback, backend merge execution) are still incomplete.

## Status Matrix

| Area | Feature | Status | Data Source | Notes | Next Step |
|---|---|---|---|---|---|
| Data Tools | Constituent import wizard | Working | Real API Data | `app/data-tools/import/ImportWizard.tsx` posts to `/api/constituents/import` with dry-run support. | Add import history UI + rollback support for accepted imports. |
| Data Tools | Import CSV into Contacts Manager list | Working | Real API Data | `/data-tools/import?target=list` opens the constituent importer with audience-list creation enabled. Imported email rows can create a reusable Contacts Manager list, and the Data Tools/Import UI warns staff that Compassion client files must be imported in the Compassion workspace instead of donor contacts. | Add import history entries that link created audience lists back to the import run. |
| Data Tools | Guided donor/client import launcher | Working | Real API Data | `GuidedImportWizard` asks whether the file is donor/outreach or Compassion client data, then routes to the donor importer or Compassion client importer with source presets. HubSpot contact exports map `Record ID`, `Email Lists`, opt-out fields, owner, and activity dates. | Add saved preset templates and import-run history. |
| Data Tools | Duplicate resolution and unsubscribe import | Working | Real API Data | Constituent imports now match duplicates by external ID, email, or normalized phone. When duplicates are detected, the wizard asks staff to merge/update the existing contact or skip duplicate rows. HubSpot unsubscribe/opt-out fields persist into `doNotEmail` and `emailOptOut`. | Add a full duplicate review table before final import for row-by-row decisions. |
| Data Tools | Unified guided import entry | Working | Real API Data | `/data-tools/import` now opens the guided import chooser by default. Contacts, audience lists, donations, and Compassion client imports are routed from one guided workflow, while direct mapper URLs remain as deep-link targets from the chooser. | Add source-specific saved mapping templates and import history. |
| Data Tools | Edge-case CSV parsing | Working | Real API Data | Shared `csvParser.ts` now handles Excel `sep=` directives, null bytes, duplicate headers, extra cells, quoted multiline rows, BOMs, and parser warnings surfaced in donor, donation, and Compassion import UIs. | Add downloadable parser diagnostics for support review. |
| Events CRM | Event guest roster CSV import | Working | Real API Data | Guided Import now includes an Event Guest Roster path. `/data-tools/import/events-guests` imports guest CSVs with RSVP, payment status, check-in code/status, meal, dietary, party, seat, and notes fields into a selected event via `/api/events/:eventId/guests/import`. | Add table/ticket type reconciliation against existing Events CRM ticket/table records. |
| Data Tools | Donation import wizard | Working | Real API Data | `DonationImportWizard.tsx` posts to `/api/donations/import`; endpoint links constituents/campaigns/designations and now skips duplicate rows within the same uploaded file (receipt #, transaction ID, or normalized full-row fingerprint). Auto-map aliases include eKYROS `Donations_List` headers (e.g. `FormDate1`, `AmountReceived`, `PaymentTypeDesc`, `EventName`). | Add dry-run parity checks and rollback tooling for donation imports. |
| Data Tools | Field mapping engine | Working | Real API Data | `fieldMap.ts` + `donationFieldMap.ts` + `compassionFieldMap.ts` provide mapping aliases and required-field behavior, including real export headers from office datasets. | Keep maps synchronized whenever schema fields are added. |
| Data Tools | Donor/non-donor tagging on constituent import | Working | Real API Data | Constituent import now maps Contact Type / Constituent Type into `Constituent.type` and applies Donor or Non-Donor tags alongside imported Tags / Keywords. Contacts Manager now provides tag library creation and bulk tag add/remove cleanup after imports. | Add import history UI + rollback support for accepted imports. |
| Data Tools | Duplicate review + merge | Partial | Mixed Real/Demo Data | `MergeWorkflow.tsx` provides review UI but no backend merge write endpoint. | Implement `POST /api/constituents/merge` with conflict-resolution options. |
| Data Tools | Saved mapping templates | Partial | Mixed Real/Demo Data | Save support exists but load/history flow is not complete end-to-end. | Add mapping template management APIs and selector UI. |
| Data Tools | Compassion client import wizard | Working | Real API Data | `app/compassion/import/clients/CompassionClientImportWizard.tsx` posts to `/api/compassion/clients/import` with dry-run, auto-delimiter, paste-text, downloadable error report, in-file dedup, and `Full Name(Preferred)` parsing. Import flow now preserves additional non-modeled demographics/source metadata in private notes for real eKYROS datasets. Validation lives in `clientImportValidator.ts` (unit-tested). | Add import-history page + rollback (Batch 2). |
| Data Tools | Compassion linked-record field mapping | Partial | Real API Data + Planned | `app/compassion/import/clients/compassionFieldMap.ts` now includes planned mappings for case/visit/assessment/pregnancy-test/referral/class/boutique fields so legacy headers can be mapped today. | Add backend write paths for linked entities and surface per-entity import results. |
| Data Tools | Compassion duplicate review center | Not Started | n/a | Today the importer warns on in-file dups but the server upserts on email match without a review queue. | Persist duplicate candidates and add `app/compassion/clients/duplicates/page.tsx` (Batch 3). |

## Real Data vs Demo Data Audit

- **Real:** constituent import, donation import, and Compassion client import endpoints are live and used by UI.
- **Mixed:** advanced mapping and duplicate merge UX includes preview-only pieces without backend merge finalization.
- **Missing:** import history and rollback/undo for completed imports.

## Required Next Steps (Production)

1. Add import run history with operator, timestamp, file, and row-level outcome stats.
2. Add rollback/safe-revert workflow for recent imports.
3. Complete merge endpoint and replace preview-only finalize flow.
4. Keep `app/data-tools/import/fieldMap.ts` and docs aligned with every schema field added to importable entities.
5. Complete planned Compassion linked-record import paths so mapped non-client fields are persisted to client-scoped entities with audit events.
