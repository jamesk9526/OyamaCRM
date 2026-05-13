# DonorCRM Letters & Printables Production Plan

## Objective

Deliver a production-grade letters operations loop:

1. Author templates with merge fields.
2. Generate single and batch letters.
3. Process print queue.
4. Process mail queue.
5. Hand off to communications email drafts when needed.

## Current Readiness

| Lane | Status | Notes |
|---|---|---|
| Template authoring | Working | Rich TipTap editing with merge insertion is live. |
| Single generation | Working | Merge preview and persisted generation are live. |
| Batch generation | Working | Real endpoint with dry-run and skip reasons is live. |
| Print queue | Working | Queue list and bulk actions are live. |
| Mail queue | Working | Queue list and bulk actions are live. |
| PDF export | Partially Working | Endpoint intentionally returns partial notice until server rendering is wired. |

## Completed In This Pass

- Added dedicated queue routes and pages for print and mail operations.
- Added queue APIs for list and bulk actions.
- Replaced batch placeholder endpoint with real generation logic.
- Added queue-aware dashboard widgets.
- Added queue-specific permission keys and admin toggles.
- Added TipTap form-letter editor and template integration.
- Added persisted workflow policy settings API (`GET/PUT /api/letters/workflow-settings`) for batch-to-print defaults, approval requirements, SLA targets, and PDF fallback mode.
- Replaced static workflow settings UI with API-backed controls in `app/components/letters/LetterWorkflowSettingsPage.tsx`.

## Remaining Work

1. Server-side PDF rendering pipeline with retry and output metadata.
2. Enforce workflow policy settings at queue execution points (print/mail transitions and batch generation runtime).
3. API/e2e test expansion focused on queue transitions and batch run edge cases.

## Guardrails

- Keep existing routes/contracts stable.
- Keep draft-first and review-first behavior.
- Do not remove explicit partial notices for incomplete lanes.
- Keep status labels restricted to: Working, Partially Working, Demo Only, Broken, Not Implemented.
