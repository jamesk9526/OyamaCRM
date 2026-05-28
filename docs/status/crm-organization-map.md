# CRM Organization Map

_Last updated: 2026-05-10_

## Purpose

This document describes the default home for major workflows so users are less likely to bounce between duplicated pages, duplicated buttons, or overlapping modules.

## Module Responsibilities

### Donor CRM

Primary home for:
- Constituents and households
- Donations, campaigns, grants, payments
- Donor stewardship tasks and meetings
- Donor-facing communications context
- Donor insights and generosity/lapse analysis

Usually not the home for:
- Client/case management data
- Event operations tooling without event scope
- Cross-module reporting composition (belongs to Reports)

### Events CRM

Primary home for:
- Event registry and setup
- Event-scoped tickets, orders, guests, tables, check-in, sponsors
- Event operations and post-event event-level workflows

Default pattern:
- Select event first, then open event-scoped tool routes (`/events/[eventId]/...`).

### Compassion CRM

Primary home for:
- Client records and service history
- Cases, appointments, follow-ups, notes
- Privacy-sensitive client reporting

Defaults:
- Keep donor and client records separated unless intentionally linked.
- Keep client workflows out of Donor CRM navigation unless there is a clear cross-module reason.

### OyamaHRM

Primary home for:
- Internal people records (staff, employees, board members, internal volunteers)
- Departments, roles, and location assignments
- Internal scheduling and availability controls
- Internal announcements and interoffice communication scaffolding

Defaults:
- Avoid surfacing donor giving data in HRM unless there is a deliberate approved use case.
- Avoid surfacing compassion client/case sensitive data in HRM unless there is a deliberate approved use case.
- Prefer safe staff/schedule references to other CRMs via IDs instead of direct record merges.

### Communications (Shared)

Primary home for:
- Email/newsletter campaign lifecycle
- Drafts, schedules, send history, delivery telemetry

Boundary:
- Email Builder is editor-only and should be launched from campaign actions in Communications.

### Reports (Shared)

Primary home for:
- Cross-module reporting and analytics
- Donor + Events + Compassion + OGentic reporting context

Boundary:
- Avoid duplicate reporting launch paths across operational module sidebars when one shared path already covers the job.

### Settings (Shared)

Primary home for:
- Identity, access, module toggles, AI configuration, integrations, plugins, security, audit visibility

Boundary:
- Operational workflows should remain in their module workspaces.

### StewardAI (Shared Assistant)

Primary home for:
- Quick assistant workflows from the top bar
- Expanded assistant workspace for scoped analysis and drafting

Boundary:
- Steward is assistant-first, not a full agentic control center.

### OGentic (Deep Agentic Workspace)

Primary home for:
- Multi-step agentic planning
- Artifact generation and cross-module handoffs
- Governed analysis pipelines

Boundary:
- OGentic is deeper than Steward quick-assistant actions.

## Consolidation Changes (2026-05-10)

### Removed or Merged Duplicates

1. Apps launcher clutter reduced:
- Removed overlapping launcher tiles that duplicated module navigation (Grant Manager, Data Tools, Payment Portal, Board Portal, standalone Email tile, future placeholders).
- Kept launcher focused on core modules and shared workspaces.

2. Event tool path duplication reduced:
- Added dedicated Event Workspace Selector route (`/events/workspace`) to choose event first, then tool.
- Updated Events dashboard quick actions to route through selector for scoped tools.
- Updated event overview quick actions to event-scoped paths (`/events/[eventId]/...`).

3. Legacy event global tools now clearly marked:
- Added compatibility warning banner on legacy global event routes (`/events/check-in`, `/events/guests`, etc.) with explicit selector link.

4. Settings path overlap reduced:
- Settings sidebar condensed to high-signal governance and module configuration paths.
- Removed redundant/overlapping settings entries from primary nav list.

### Unfinished Tool Warning Standardization

- Scaffolded Events workspace pages now show a visible in-development warning via `FeatureStatusWarning` so placeholder surfaces do not look production-complete.

## Remaining Confusing Workflows

1. Events still has compatibility global routes and event-scoped routes in parallel.
- Current behavior is documented and warned in UI.
- Final cleanup should retire legacy global routes after redirect coverage is complete.

2. Communications still opens Email Builder in a separate tab.
- This is intentional for now, but editor embedding and tighter return flow would reduce context switching.

3. Settings still contains some placeholders behind valid routes.
- Placeholders are less surfaced in primary nav, but still need implementation or explicit deprecation states.

## Next Cleanup Tasks (2-3)

1. Replace legacy global Events tool pages with redirects to `/events/workspace?tool=...` after adding event-preserving redirect logic.
2. Add explicit module landing summaries for Reports and Compassion with action-first CTA groups and consistency checks.
3. Add route-level tests for navigation boundaries: event-first enforcement, module launch paths, and role-based app visibility.
