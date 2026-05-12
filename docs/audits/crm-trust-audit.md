# CRM Trust Audit

This audit tracks places where UI/metrics suggest correctness but data behavior is stale, generic, or misleading.

## Scope

- Module: DonorCRM
- Start date: 2026-05-12
- Goal: Ensure visible CRM outputs are backed by live, deterministic, verifiable data behavior.

## Status Labels

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

## Findings

1. Steward Signals donor widget last gift amount displayed `$0` while giving history showed non-zero donations.
- Area: `GET /api/steward-signals/donors/:id/widget`
- Root cause: server numeric conversion helper did not parse Prisma Decimal-like objects.
- Status: Working
- Fix: `asNumber` now parses numeric `toString()` object values.

2. Steward Signals donor widget could show a generic action-oriented best-next-step even when no live opportunity trigger existed.
- Area: `GET /api/steward-signals/donors/:id/widget`
- Root cause: fallback recommendation text was generic and not trigger-aware.
- Status: Working
- Fix: fallback now reports no urgent task due and includes live trigger context (gift count, days since last gift, lapse risk).

3. Steward task suggestions were missing a dedicated rules-based list endpoint/UI for staff action.
- Area: Steward Signals workspace
- Root cause: queue existed, but no explicit deterministic task suggestion surface.
- Status: Working
- Fix: added `/api/steward-signals/task-suggestions` and a live table in Steward Signals page.

4. Opportunity Engine appeared active when AI runtime was disabled in settings.
- Area: Steward Signals opportunity queue + actions
- Root cause: queue endpoints and UI loaded regardless of Steward AI runtime toggle.
- Status: Working
- Fix: gated Opportunity Engine APIs behind `steward_ai` enabled flag and updated UI to show an empty paused bar until AI is enabled.

5. Suggested Tasks confidence score was not transparent enough for staff trust.
- Area: Steward Signals task suggestion confidence
- Root cause: confidence used opaque heuristic clamps without visible factor breakdown.
- Status: Working
- Fix: replaced with evidence-based deterministic confidence model (trigger fit, recency, lapse severity, donor status, amount signal, open-task penalty) and exposed confidence reason text in Suggested Tasks UI.

6. SMTP readiness was only testable through campaign-specific send-test flows, not directly from organization settings.
- Area: Settings SMTP configuration
- Root cause: no first-class settings-level SMTP test-send endpoint or UI action for administrators.
- Status: Working
- Fix: added `POST /api/settings/smtp/test` with real transport verify + test send and wired a Settings UI test panel that can test with current form values before saving.

## Next Audit Queue

1. Dashboard widget truthfulness audit
- Verify each visible KPI source and denominator.
- Validate date windows (YTD/current year/custom) against API filters.
- Status: Partially Working

2. Constituents profile totals cross-check
- Ensure profile cards (lifetime/YTD/gift count/last gift) always match donation ledger rows.
- Add a diagnostics endpoint or script for mismatch detection.
- Status: Partially Working

3. Steward Signals explanation fidelity
- Ensure explanation text always references concrete trigger facts for every recommendation path.
- Status: Partially Working

4. In-development labels audit
- Replace stale notices where functionality is now live.
- Keep explicit warnings only where behavior is truly incomplete.
- Status: Partially Working
