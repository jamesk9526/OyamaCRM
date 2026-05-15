# Production Readiness Matrix

Last updated: 2026-05-14 (production pass phase 2 + user-friendliness wave 1)

Status labels:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented
- Removed From UI
- Backlog

A system may be marked Working only when UI wiring, API behavior, persistence, permissions, error handling, navigation clarity, tests, and docs are all aligned.

| System | Status | Evidence | Current gaps | Next action |
|---|---|---|---|---|
| Donor Dashboard | Working | app/page.tsx, app/components/dashboard/*, app/components/ui/WorkspaceHelpTip.tsx | Start Here and plain-language focus cards are now live; additional refinement remains for broader role personalization and preference-driven dashboard defaults. | Keep regression checks in smoke and donor browser QA lanes while iterating role-specific dashboard tailoring. |
| Donor Records | Partially Working | app/constituents/page.tsx, app/constituents/[id]/page.tsx | Record detail experience is broad but some adjacent stewardship actions still rely on legacy confirm/prompt interactions. | Convert destructive/input dialogs to shared modal patterns and expand record workflow tests. |
| Constituents | Working | app/constituents/page.tsx, server/src/routes/constituents.ts | Core list/profile flows are active and linked into stewardship loops. | Continue coverage and perf tuning under normal release cadence. |
| Donations | Working | app/donations/page.tsx, app/donations/new/page.tsx, server/src/routes/donations.ts | Minor UX consistency follow-up remains; core persistence and workflows are live. | Maintain with regression tests and command-center polish. |
| Campaigns | Partially Working | app/campaigns/page.tsx, app/campaigns/[id]/page.tsx, server/src/routes/campaigns.ts | Route-level destructive dialog UX is now modal-based, but full campaign workflow hardening and deeper regression coverage remain pending. | Complete guided campaign workflow polish and expand campaign lifecycle tests. |
| Communications | Partially Working | app/communications/page.tsx, app/communications/new/*, server/src/routes/email-campaigns.ts | Route-level clone/delete dialogs are now modal-based, but full guided flow validation/persistence consistency is still in progress. | Complete guided flow criteria and end-to-end workflow tests across create/review/schedule/send. |
| Email Builder | Partially Working | app/email-builder/page.tsx, app/components/email-builder/* | Rich editor still uses native prompt in link insertion; advanced workflow claims need additional integration tests. | Migrate prompt actions to controlled modals and extend builder integration tests. |
| Letters & Printables | Partially Working | app/letters-printables/*, server/src/routes/letters.ts | PDF export endpoint still returns 501 partial implementation. | Implement server PDF pipeline and add API/UI verification tests. |
| Tasks | Partially Working | app/tasks/page.tsx, server/src/routes/tasks.ts | Lifecycle API expanded, but full enterprise board/calendar/command-center UX remains incomplete. | Complete phase-6 task experience and timeline write-backs for all actions. |
| Notifications | Partially Working | app/components/layout/TopBar.tsx, server/src/routes/notifications.ts | Durable model exists; producer coverage and cross-module notification completeness still maturing. | Expand notification producers and add module-level end-to-end checks. |
| Steward Paths | Partially Working | app/steward-paths/builder/page.tsx, server/src/services/steward-paths-sequence-engine.ts | Core orchestration is live but production hardening and action UX consistency still in flight. | Complete guided path acceptance criteria and broaden high-risk regression tests. |
| Steward AI | Partially Working | app/components/layout/StewardAiRuntimePill.tsx, server/src/routes/steward-ai.ts | Runtime status/fallback are in place; not all suggested action pathways are fully wired. | Complete action execution bindings with confirmation gates and audit coverage. |
| Reports | Partially Working | app/reports/page.tsx, server/src/routes/reports.ts | Report UX still contains browser alert fallback paths and mixed export behavior. | Replace alert paths with structured error states and normalize export workflows. |
| Grants | Partially Working | app/grants/page.tsx, app/grants/[id]/page.tsx, server/src/routes/grants.ts | Grant workspace is functional but still in active refactor/coverage expansion. | Complete remaining case-file workflow tests and readiness evidence. |
| Events CRM | Partially Working | app/events/*, app/components/layout/sidebar-configs.tsx | Navigation defects were fixed in this pass, but several deep event-scoped workflows remain incomplete. | Continue event workflow completion and ensure every visible action has real persistence. |
| Compassion CRM | Partially Working | app/compassion/*, docs/status/PARTIAL_IMPLEMENTATION_AUDIT.md | Multiple placeholder routes and permission TODOs remain, with some pages now removed from nav. | Finish or hide remaining placeholder features and complete permission enforcement. |
| Appointments | Partially Working | app/compassion/appointments/page.tsx, app/components/compassion/appointments/* | Core scheduling exists; enterprise interaction and module permission hardening remain. | Add full appointment workflow tests and complete permission gates. |
| HRM | Partially Working | app/hrm/*, app/components/layout/sidebar-configs.tsx | Workspace exists but production-depth validation across HRM tools is incomplete. | Run focused HRM readiness audit and promote only verified flows. |
| Watchdog | Partially Working | app/watchdog/*, server/src/routes/watchdog.ts | Broad functionality is present; final readiness requires full lane validation and UX consistency checks. | Complete production lane evidence and tighten command confirmations where needed. |
| Webmaster | Partially Working | app/webmaster/page.tsx, app/webmaster/editor/page.tsx, app/webmaster/preview/[siteId]/[pageId]/page.tsx, app/webmaster/publishing/page.tsx, server/src/routes/webmaster.ts, app/components/webmaster/* | Core dashboard/editor/preview/publishing workflows are real and publish/rollback execution is working with immutable snapshots, but multiple secondary workspace routes remain placeholder/in-development and external deployment adapters are not implemented. | Complete remaining workspace APIs, hide or finish placeholder-only routes, and deliver deployment adapter execution with test evidence. |
| Settings | Partially Working | app/settings/page.tsx, app/settings/system-status/page.tsx | Several settings subpages are placeholders; one placeholder card was removed in this pass. | Continue removing placeholder entries or fully implementing each settings area. |
| Imports | Partially Working | app/data-tools/import/*, app/compassion/data-tools/page.tsx, app/data-tools/import/fieldMap.ts | Core import flow exists but module parity and complete history workflow are not fully closed. | Complete import history surfaces and ensure validation/merge parity across modules. |
| Exports | Partially Working | app/reports/page.tsx, app/compassion/data-tools/page.tsx, server/src/routes/letters.ts | Export coverage is uneven; client export is coming soon and letter PDF export is partial. | Implement missing export endpoints and standardize error/success handling. |
| User/role permissions | Partially Working | server/src/lib/permissions.ts, app/compassion/layout.tsx | Role system exists but multiple compassion routes still include TODO permission notes. | Enforce module-specific permission checks consistently across all protected routes. |
| Organization settings | Working | app/settings/organization/page.tsx, server/src/routes/settings.ts | Core organization configuration route is active and integrated into settings workspace. | Maintain through regression and schema compatibility checks. |
| Audit/activity timelines | Partially Working | server/src/routes/donations.ts, server/src/routes/letters.ts, app/constituents/[id]/page.tsx | Audit/timeline coverage is strong in donor flows but uneven across newer module surfaces. | Expand audit event coverage across Compassion and Events critical actions. |
| Calendar views | Partially Working | app/tasks/page.tsx, app/components/compassion/appointments/* | Calendar patterns exist in module workspaces but full enterprise task calendar requirements are not complete. | Deliver complete month/week/day/agenda task calendar behavior with persistence. |
| Search | Partially Working | app/constituents/page.tsx, app/components/help/HelpWorkspace.tsx | Search exists in multiple workspaces but global consistency and module parity remain incomplete. | Standardize search interaction patterns and error/empty states across modules. |
| Data quality tools | Partially Working | app/data-tools/page.tsx, app/data-tools/import/* | Core tools are present; full completion and production proof for all quality operations is pending. | Close remaining import/export quality gaps and publish lane-backed evidence. |

## Notes

- This matrix is now the system-level companion to docs/status/PARTIAL_IMPLEMENTATION_AUDIT.md.
- Any status promotion to Working requires command evidence, test coverage, and removal of placeholder/demo-only behavior from visible UI.
