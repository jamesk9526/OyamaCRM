# Mobile Readiness Audit - 2026-05-12

## Scope

This audit covers OyamaCRM web routes and shared UI architecture with a focus on:

- DonorCRM routes under /
- Compassion CRM routes under /compassion
- Events CRM routes under /events
- Watchdog routes under /watchdog
- Webmaster routes under /webmaster
- HRM routes under /hrm
- Standalone apps under /apps

Current app route footprint discovered in code: 142 page routes.

## Executive Status

Overall mobile readiness status: Partially Working

Reason:

- Mobile-safe patterns exist on many individual screens.
- Shared module shells are desktop-first and keep fixed sidebars visible at small widths.
- Multiple data-heavy views rely on overflow scroll with wide table minimums.
- Several dialogs/drawers use fixed desktop widths and need mobile-specific layout rules.

## High Severity Findings

1. Persistent fixed-width sidebars across module shells reduce usable content area on phones.

Representative files:

- app/components/layout/AppShell.tsx
- app/compassion/layout.tsx
- app/events/layout.tsx
- app/watchdog/layout.tsx
- app/hrm/layout.tsx
- app/webmaster/layout.tsx
- app/components/layout/AppProductShell.tsx

2. Desktop-oriented fixed width classes appear in global interaction surfaces.

Representative files:

- app/components/layout/TopBar.tsx
- app/components/layout/AppsDrawer.tsx
- app/components/ai/StewardChatPanel.tsx
- app/components/email-builder/BlockEditor.tsx

3. Data table surfaces include large minimum widths that cause horizontal panning fatigue.

Representative files:

- app/components/livecom/LiveComInboxPanel.tsx
- app/components/communications/CampaignSendLogTable.tsx
- app/components/communications/CampaignDeliveryEventsPanel.tsx
- app/settings/project-status/page.tsx
- app/components/steward/StewardTaskSuggestionsTable.tsx

## Medium Severity Findings

1. Settings and utility side-panels are not consistently collapsible on small screens.

Representative files:

- app/settings/layout.tsx
- app/components/settings/SettingsSidebar.tsx

2. Tap target and small text density risks exist in compact utility rows and badges.

Representative files:

- app/components/layout/TopBar.tsx
- app/components/meetings/MeetingCard.tsx

## Pattern Metrics Snapshot

Regex-assisted scan highlights from app/**/*.tsx:

- 16 matches for large fixed width patterns around 260px+ and 300px+ class usage.
- 28 matches for explicit min-width pixel classes.
- 39 matches for h-screen usage in shell-like structures.
- 36 matches for overflow-x-auto usage (expected for data tables, but many lack mobile card alternatives).
- 29 shell-level and utility-level width/surface constraints requiring mobile variants.

## Operational Gaps

1. No dedicated mobile e2e gate existed before this pass.
2. No route-by-route mobile scorecard was checked into repository status docs.
3. No hard acceptance criteria tied to release gate for mobile usability.

## Added In This Pass

1. New e2e script:

- tests/e2e/mobile-readiness-audit.mjs

2. New npm script:

- test:e2e:mobile

This introduces a repeatable audit run across key routes and mobile/tablet viewports with checks for:

- Horizontal overflow
- Fatal error markers
- Small tap targets
- Tiny text density

## Release Recommendation

Do not mark mobile readiness as Working yet.

Required first milestones:

1. Convert all module shells to responsive sidebar drawer behavior.
2. Refactor high-use tables to mobile card/list representations below md breakpoints.
3. Add mobile dialog sizing standards and enforce them for WorkspaceSetupModal consumers.
4. Pass mobile audit script with zero fail-level issues on key routes.
