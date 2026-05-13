# DonorCRM Grants Audit

Last updated: 2026-05-12

## Scope

This audit covers grant-related implementation and dependencies across:

- app/grants/page.tsx
- app/grants/[id]/page.tsx
- app/components/grants/*
- server/src/routes/grants.ts
- prisma/schema.prisma and grant migration SQL
- tests/smoke/grants-crud.test.ts

## Status Labels

Only these labels are used:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

## Baseline Findings (Before This Pass)

- Grants already had dedicated models and routes separate from Donation records: Working.
- Grants UI and vocabulary leaned heavily toward pipeline framing: Partially Working.
- Grant writing sections and timeline existed and were persisted: Working.
- Grant-specific reminders/tasks/resources/requirements were not first-class workflow surfaces: Partially Working.
- Donation auto-creation from grants was not present: Working.

## Current Findings (After This Pass)

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Grant routes and persistence | Working | server/src/routes/grants.ts, prisma/schema.prisma | CRUD, stats, funders, writing sections, activity remain intact. |
| Grant case-file endpoints | Working | server/src/routes/grants.ts (`/workspace/case-items`, `/:id/case-items`) | Supports reminders, tasks, resources, requirements through case-item metadata records. |
| Grant UI framing | Partially Working | app/grants/page.tsx, app/components/grants/GrantStats.tsx, app/components/grants/GrantsCommandPanel.tsx | Primary language now research/deadline/writing oriented; additional calendar/reporting surfaces still evolving. |
| Grant detail case-file tabs | Working | app/grants/[id]/page.tsx, app/components/grants/GrantCaseItemPanel.tsx | Added research, requirements, reminders, tasks, resources, decision tabs while preserving writing/activity tabs. |
| Add Grant workflow | Working | app/components/grants/AddGrantModal.tsx | Captures writer, reminder date, portal URL, eligibility/research notes, and required-doc seed rows. |
| Donations separation | Working | app/grants/[id]/page.tsx, app/donations/new/page.tsx | Added explicit handoff button and donation prefill path without auto-creating donation records. |
| Permission coverage for grants | Working | server/src/lib/permissions.ts, server/src/routes/grants.ts | Added `grants.*` permission keys and route enforcement for view/create/edit/delete and case-file operations. |
| Grant smoke coverage | Working | tests/smoke/grants-crud.test.ts | Added case-item creation/list/update checks and non-donation expectations on grant create. |

## Pipeline-Oriented Elements Reframed

The following were intentionally reworded or reframed:

- Pipeline labels -> Research Board / Grant Library / Deadlines / My Grant Tasks.
- Pipeline health language -> grant workspace health and writing/deadline context.
- Pipeline value wording -> requested amount clearly marked as potential, not received revenue.

## Donation Coupling Audit

### Confirmed Not Coupled

- Grant creation does not create Donation records.
- Grant status changes do not create Donation records.
- Grants continue to use dedicated grant/funder/section/activity models.

### Intentional Handoff Only

- Grant detail includes a handoff action to Donations for recording received grant money.
- Donation page supports grant-aware prefill messaging but remains the financial ledger source-of-truth.

## What Must Be Preserved

- Routes:
  - /grants
  - /grants/[id]
  - /api/grants/*
- Existing grant models and migration compatibility.
- Dashboard/sidebar/report safety and auth/session behavior.
- Existing smoke/e2e/build flows and route contracts used by tests.

## What Was Renamed/Reframed

- User-facing grant language shifted to research, writing, deadlines, submission, decision, and renewal context.
- Grants are now explicitly documented and implemented as a case-file workspace, not a sales-style pipeline.

## Outstanding Gaps

- Grant calendar visualization is still Partially Working (deadline/task tables exist; dedicated calendar UI is not fully implemented).
- Cross-grant reporting for requirement completeness and workload summaries is Partially Working.
- Some legacy internal variable names still reference pipeline terms even where user-facing language has been updated.
