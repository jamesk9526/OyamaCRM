# Module UI clarity and stale-state pass — 2026-11-02

Four distinct subagents reviewed Letters, Email, Donor CRM and Donor Profiles. Changes preserve existing routes and server authorization.

## Delivered

- Letters: template access no longer depends on recipient lookup success; independent lookup/template retries; accurate New draft status; upload pending state blocks overlapping upload/save/preview; stale page counts identified; original-PDF actions require a loaded document.
- Email: removed recipient preview overwrites by generic saved HTML, added request cancellation/identity checks and timeout feedback, blocked dirty test sends, saved current content before printable conversion. Sender/SMTP settings links to organization settings; compliance text describes readiness rather than fake editable controls.
- Donor CRM: superseded directory requests abort; quick views no longer imply active filtering when hidden search/period filters differ; selecting a quick view resets those hidden constraints; dashboard distinguishes refreshing/unavailable data.
- Donor profiles: identity-keyed page resets tabs/dialogs/data, cancelled profile/merge-history requests, visible Retry profile error state. Letter history distinguishes failed loading from empty history. Email preferences reset for donor/email and failed loads block editing unknown defaults.

## Verification

Web and server TypeScript checks passed. Targeted lint passes for donor/profile/letter files. Email targeted lint has no errors and five existing warnings. Focused donor browse/dashboard and Email render/conversion suites: 35 tests pass. Separate letter assets/pagination/document/conversion selection: 12 tests pass. The updated Letters browser fixture passes.

A synthetic module browser run verified directory quick-view state/reset and Email's canonical SMTP link. A subsequent expanded run reached simulated profile failure, Retry profile, and recovered QA Individual content; the recovered screenshot was visually reviewed. The expanded run failed its final no-page-errors assertion because intermittent local dev compilation produced `Invalid or unexpected token`; therefore there is no clean combined browser sign-off. Screenshots are fixture evidence, not live records. Earlier results.json covers the initial three checks only.

The Email agent also ran a broader smoke selection with 26 passing and two pre-existing donor source-label assertion failures (old labels Send To Email Workspace / Use Email Template). Those source assertions were not weakened in this pass.

No live email sends, database writes, deployment, or production API validation were performed. Actual outbound delivery and multi-user concurrency remain unverified.
