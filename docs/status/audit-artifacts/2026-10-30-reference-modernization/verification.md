# Reference modernization verification — 2026-10-30

## Scope

Centralized typography, colors, controls, cards, tables, metric cards, modal presentation, navy navigation, white header, and responsive module adapters. DonorCRM, Events, Compassion, Settings, Webmaster, Watchdog, Steward Paths, and standalone shell presentation consume shared tokens while retaining existing navigation catalogs. Authored event/website/email documents are excluded from generic CRM styles. Self-hosted Inter includes its OFL license.

The task/notification and donor follow-up functionality in this working tree was separately requested earlier in this conversation. The reference redesign did not replace backend workflows. A donor browse regression found during verification was corrected using Next's supported native history integration: same-page filters update `useSearchParams` immediately and continue fetching their existing client APIs, without starting a server navigation on each keystroke.

## Automated validation

- Production web build: Next.js webpack build, TypeScript, and generation of 218 static pages passed.
- Server TypeScript build passed.
- Focused ESLint for changed shell/module/shared component and donor browsing files passed.
- Twelve focused unit/API suites: **76 tests passed**. Covers tenant-scoped donor summaries, follow-up task validation/idempotency, task permissions/lifecycle, persisted notification lifecycle, SSE authorization, worker reconciliation, and LiveCom/Steward notification producers.

## Real-browser checks

Playwright with isolated synthetic API responses, against a local production build:

- Donor browse: **9 checks**, including restored URL filters/pagination, immediate quick views, selected donor outside initial form choices, scoped gift history, every advanced gift menu action, exact-period metric links, failure/retry, invalid dates, and 390px layout.
- Dashboard charts/customization: **8 checks**, including underlying monthly chart values, comparison and average, layout customization, unavailable chart/retry, authentication, and 1440/768/390px layouts.
- Dashboard tools: **18 checks**, including report period handoffs, acknowledgment queues, recurring giving, annual statements, donor research, data quality, campaign detail, global search, customization, and recommendations.
- Tasks: **9 checks**, including create/edit/complete/reopen, assignments, reminders, bulk assignment, exact-task deep links, deletion confirmation, failure/retry, pagination, and mobile layout.
- Notifications: **8 checks**, including read/unread, dismiss, snooze, workspace scope, exact links, polling/shared feed behavior, and failure recovery.
- Donation follow-up: **4 checks**, including save-once gift behavior, task failure/retry with the same idempotency key, donor/gift/assignee/date linkage, and mobile success state.
- Reference design system: **6 checks**, covering campaigns, reports, recurring giving, settings, donor profile, desktop/mobile overflow, and authored-content color isolation.
- Module check: Events search/white header/teal actions, Compassion navy navigation, and mobile care navigation passed with no page errors.
- Subagent shell check: Quick Add, account controls, notifications, mobile drawer, and viewport widths 390–1586px passed. See sibling `2026-10-30-reference-shell/checks.json`.

Screenshots and machine-readable results accompany this document and the sibling donor/task/notification evidence folders. Test data is explicitly synthetic; no production records or outbound messages were created.

## Limits

Local MySQL was unavailable for the read-only connectivity probe. API persistence tests use mocked storage, so real database concurrency and end-to-end integration remain unverified. In-app notifications use authenticated SSE plus polling and a bounded background reconciliation worker; this does not claim email/SMS/browser-push delivery. No production deployment, production migration, live communication, external integration delivery, or exhaustive manual review of all 218 pages was performed. Representative routes and common components were checked; this is not a claim that every custom module surface matches the mockup pixel-for-pixel.
