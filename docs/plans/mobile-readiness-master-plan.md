# OyamaCRM Mobile Readiness Master Plan

## Objective

Make the full application reliably usable on mobile devices by moving from desktop-first shell behavior to responsive-first module patterns with measurable release gates.

## Definition Of Done

Mobile readiness can be marked Working only when all conditions below are met:

1. All module shells support a mobile navigation pattern with no persistent desktop sidebar on small screens.
2. Primary workflows in each module are completable at 360px width without horizontal page overflow.
3. Data-dense pages provide mobile alternatives to wide table-only layouts.
4. Dialogs, drawers, and setup flows remain fully usable with keyboard-safe viewport constraints.
5. test:e2e:mobile completes with zero fail-level findings.
6. Manual QA pass succeeds on iPhone-class and Android-class viewport sizes for all critical workflows.

## Route Coverage Model

Phase rollout by module and impact instead of route alphabet order:

1. Shared shells and top navigation
2. DonorCRM core workflows
3. Compassion CRM core workflows
4. Events CRM operations flows
5. HRM, Webmaster, Watchdog
6. Settings, data tools, standalone apps

## Phase 0 - Audit Baseline And Tooling

Status: Completed in this pass

Delivered:

- docs/audits/mobile-readiness-audit-2026-05-12.md
- tests/e2e/mobile-readiness-audit.mjs
- package.json script test:e2e:mobile

Exit criteria:

- Baseline risk list documented
- Repeatable automated mobile check available

## Phase 1 - Shared Shell Refactor (Highest Priority)

Goal:

Replace fixed desktop sidebars with responsive shell primitives.

Implementation targets:

- app/components/layout/AppShell.tsx
- app/compassion/layout.tsx
- app/events/layout.tsx
- app/watchdog/layout.tsx
- app/hrm/layout.tsx
- app/webmaster/layout.tsx
- app/components/layout/AppProductShell.tsx
- app/settings/layout.tsx

Required changes:

1. Desktop sidebars hidden below md.
2. Mobile drawer with overlay, close affordance, and focus-safe behavior.
3. Main content padding reduced for small screens.
4. Top-level mobile menu trigger added consistently per shell.

Acceptance checks:

- No shell-level horizontal overflow at 360px.
- Navigation remains accessible on every module route.

Status update (2026-05-12): In Progress

- Implemented responsive drawer navigation pattern in:
	- app/components/layout/AppShell.tsx
	- app/compassion/layout.tsx
	- app/events/layout.tsx
	- app/watchdog/layout.tsx
	- app/hrm/layout.tsx
	- app/webmaster/layout.tsx
	- app/components/layout/AppProductShell.tsx
	- app/settings/layout.tsx
- Desktop sidebars are now hidden below md with a mobile menu trigger and overlay drawer.

## Phase 2 - Mobile Data Surface Refactor

Goal:

Make high-frequency table workflows efficient on phones.

High-priority components:

- app/components/constituents/ConstituentTable.tsx
- app/components/donations/DonationTable.tsx
- app/components/tasks/TaskTable.tsx
- app/components/communications/CampaignSendLogTable.tsx
- app/components/communications/CampaignDeliveryEventsPanel.tsx
- app/components/livecom/LiveComInboxPanel.tsx
- app/components/settings/AuditLogViewer.tsx
- app/settings/project-status/page.tsx

Required changes:

1. Mobile card/list variant below md.
2. Preserve sortable/filterable behavior.
3. Keep desktop table on md+.

Acceptance checks:

- Core list reading and row action workflows are one-handed usable at 360px.

Status update (2026-05-12): In Progress

- Added mobile card/list rendering with preserved desktop table views in:
	- app/components/constituents/ConstituentTable.tsx
	- app/components/donations/DonationTable.tsx
	- app/components/tasks/TaskTable.tsx
	- app/components/communications/CampaignSendLogTable.tsx
	- app/components/livecom/LiveComInboxPanel.tsx
	- app/components/communications/CampaignDeliveryEventsPanel.tsx
	- app/settings/project-status/page.tsx
	- app/components/settings/AuditLogViewer.tsx
	- app/components/settings/FeatureReadinessTable.tsx
	- app/events/reports/EventReportsContent.tsx
	- app/components/quickbooks/QBSyncQueueTable.tsx
- Table actions (edit/delete/save/complete) remain available on mobile cards.

## Phase 3 - Dialog And Utility Overlay Hardening

Goal:

Ensure modal, drawer, and workspace utility surfaces are mobile-safe.

High-priority components:

- app/components/ui/WorkspaceSetupModal.tsx
- app/components/layout/AppsDrawer.tsx
- app/components/layout/TopBar.tsx notifications and workspace switcher popovers
- app/components/ai/StewardChatPanel.tsx
- app/components/email-builder/BlockEditor.tsx

Required changes:

1. Standardized mobile max-height and inner scrolling behavior.
2. Full-width mobile treatment for complex editing panels.
3. Touch target and spacing normalization.

Acceptance checks:

- No clipped action controls at 360px height-constrained viewport.

## Phase 4 - Workflow Verification And Regression Gates

Goal:

Bind mobile readiness to release operations.

Required actions:

1. Integrate test:e2e:mobile into release validation checklist.
2. Add module-level mobile QA checklist with owner sign-off.
3. Update docs/status/production-readiness-checklist.md with mobile gate state.

Exit criteria:

- Mobile gate tracked with allowed labels only.
- Release cannot be marked Working if mobile audit has fail findings.

## Critical Workflow QA Matrix

DonorCRM:

1. Login and dashboard load
2. Add constituent
3. Record donation
4. Create and complete task
5. Open report and export action

Compassion CRM:

1. Open client list
2. Open client workspace
3. Schedule appointment
4. Complete case follow-up

Events CRM:

1. Enter workspace and choose event
2. Open guest list
3. Run check-in flow
4. Open event report

Watchdog, Webmaster, HRM:

1. Open module dashboard
2. Navigate module sidebar actions
3. Complete one primary create/update action

## Delivery Cadence

1. Week 1: Phase 1 shells and settings layout
2. Week 2: Phase 2 core donor and compassion tables
3. Week 3: Phase 2 events plus Phase 3 overlays
4. Week 4: Phase 4 release gates and cleanup

## Ownership

1. Platform UI owner: shared shells and top-level responsive primitives
2. Module owners: route and workflow refactors
3. QA owner: mobile matrix execution and evidence capture

## Reporting

For each phase completion, publish:

1. Updated audit deltas
2. Mobile e2e results summary
3. Remaining blocker list with severity and owner
