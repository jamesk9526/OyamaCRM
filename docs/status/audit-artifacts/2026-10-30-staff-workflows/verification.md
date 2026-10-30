# Staff workflows, matched labels and donor UI — verification

Date: 2026-10-30. Repository: `C:/Users/James/Documents/GitHub/OyamaCRM`. Branch: `codex/donor-staff-workflows`.

## Changes

- Check-in feedback no longer changes document height; team row scroll remains stable.
- Month-giving, donor-count and constituent-count drill-downs; current/previous UTC first-gift cohorts with pagination.
- Shared durable donor reminders with day/week snooze and dismiss; donor enrollment timeline and donor-specific task handoff.
- Keyset backlog scanning reaches due tasks/pledges after the first 100 already-processed records and retries failed batches before advancing.
- Letter generation restores selected order and reports unavailable contacts. Exact preview/production PDF-part label exports preserve order, fail atomically for unavailable recipients, retain repeated recipients for distinct letters, and support sheet start positions/alignment guides. All generated IDs appear in 500-letter parts; the old 100-letter truncation is removed. Production PDF exports reject missing requested letters.
- Contact history separately displays persisted generated/printed/mailed/email-sent dates and can reveal all 100 loaded records.
- Donor UI adopts the preferred letters/email Microsoft-style command workspace: neutral surfaces/dividers, Segoe UI, restrained geometry, compact controls and subtle accessible motion. Personal accent choices and authored/event/clinical exclusions remain.

## Automated checks

Passed: 84 focused tests across 12 files:

- `tests/api/matched-mailing-labels.test.ts`
- `tests/api/constituent-giving-filter.test.ts`
- `tests/unit/steward-paths-backlog.test.ts`
- `tests/api/donor-dashboard-metrics.api.test.ts`
- `tests/api/tasks-workflow.test.ts`
- `tests/api/notifications-workflow.api.test.ts`
- `tests/unit/donor-dashboard-data.test.ts`
- `tests/unit/donor-dashboard-charts.test.ts`
- `tests/unit/avery-labels.test.ts`
- `tests/unit/mail-merge-label-eligibility.test.ts`
- `tests/unit/letters-merge.test.ts`
- `tests/unit/letters-print-layout.test.ts`

Web/server typechecks and production Next.js build passed. Focused ESLint passed with zero errors; existing hook/unused-variable warnings remain in the large letters workspace, check-in page and report routes. Newly added components/tests and contact-history changes pass lint. `git diff --check` passed.

## Browser checks

`tests/e2e/staff-workflows.e2e.mjs` and `tests/e2e/matched-mailing-labels.e2e.mjs` run against a local production Next.js server with synthetic authenticated API responses. All business requests are intercepted; no live donor records, emails or print jobs are created.

- Dashboard month and donor metric links carry matching record filters; month switch exposes profile links.
- One-week snooze sends the persisted notification command and removes the active alert without completing a task.
- Completed donor enrollment remains visible and expands its actual recorded timeline. Contact history displays recorded generation/print/mailing dates separately.
- Two sequential team guest check-ins preserve row position and every scrolled ancestor when feedback appears and expires.
- A synthetic 501-letter response exposes 500+1 PDF parts; matched labels send all exact first-part letter IDs and settings. A simulated unavailable recipient displays an error rather than downloading a partial sheet.
- Responsive dashboard/mail-generation screenshots and check results are in this directory.
- The UI subagent additionally compared visible controls before/after CSS (18 buttons, 29 links, one input), exercised month switching and constituent search, and checked focus/reduced motion at 1440/768/390px. Its exact-stylesheet injection results are preserved in `microsoft-ui-checks.json`; final integrated production screenshots use the compiled styles.

Results: `browser-checks.json`, `mailing-browser-checks.json`, `microsoft-ui-checks.json`.

## Limits

No database migrations, production deployment, live legacy-backlog repair, external communication or physical printing. API tests mock Prisma; deployed MySQL concurrency, multi-worker claims, Rebecca’s legacy ownership and actual worker delivery are unverified. Synthetic browser fixtures verify UI behavior, not live database reconciliation.

The development webpack server intermittently produced a layout-bundle eval syntax error on event navigation; diagnostics are retained separately. Production browser runs completed without page errors. No unrelated development-bundle repair is claimed.

Current-run letter IDs/preview part IDs are the ordered manifest for matched exports. Cross-session batch manifests, immutable address snapshots, campaign mailing ledgers, mailing calendar/schedules, recurring preparation/emailing, outreach sequences and report-request search remain explicit TODOs in [the checklist](../../../plans/staff-workflows.md). Addresses/preferences are revalidated when labels are requested; regenerate letters after changes. Generating/downloading either PDF does not mark anything printed or mailed. Physical printer/media compatibility remains required before envelope/window-layout implementation.
