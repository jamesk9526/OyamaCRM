# CRM Sidebar Navigation

Last updated: 2026-05-12

## Current Navigation Problem

As OyamaCRM modules expanded, sidebars mixed major workspaces with supporting tools, making it harder to scan where to do core work versus supporting tasks.

Specific donor issues addressed in this pass:

- Steward Paths appeared too low in Engagement despite being a major workspace.
- Letters and LiveCom appeared as peers with core action workflows without clear tool classification.
- Steward Signals was grouped with daily action tools instead of intelligence workflows.
- Sidebar collapse behavior was inconsistent across Donor, Compassion, Events, HRM, and Watchdog.

## New Donor CRM Group Structure

The donor sidebar now uses config-driven groups:

1. Fundraising
2. Engagement Workspace
3. Communication Tools
4. Insights
5. People
6. System

### Group details

- Fundraising: Dashboard, Constituents, Donations, Campaigns, Grants, Payments (+ QB Sync when plugin is enabled)
- Engagement Workspace: Steward Paths, Tasks, Meetings, Communications
- Communication Tools: Contacts Manager, Letters & Printables, LiveCom
- Insights: Steward Signals, Reports
- People: Volunteers
- System (collapsible): Imports, Data Tools, Custom Fields, Settings, Help, admin-only Feedback Tickets, admin-only Watchdog/WebMaster links

Donor-specific IA companion doc: [docs/DONOR_CRM_SIDEBAR_NAVIGATION.md](docs/DONOR_CRM_SIDEBAR_NAVIGATION.md)

## Why Steward Paths Is Treated As A Major Workspace

Steward Paths now appears at the top of Engagement Workspace and carries an App badge to indicate it is a primary operational workspace, not a supporting utility.

## Why Letters & Printables Is A Supporting Communication Tool

Letters & Printables now lives in Communication Tools with a Tool badge and description:

Create thank-you letters, receipts, newsletters, and printable donor communication.

This keeps it close to Communications and LiveCom while visually distinguishing it from daily action workflows.

## Contacts Manager

Contacts Manager lives in Communication Tools and opens `/contacts-manager`. It is the shared audience workspace for Communications and Letters & Printables: staff can search constituents, distinguish donors and non-donors, update tags, and save reusable audience lists that email campaigns can send to and printable workflows can use for mailing context.

## Badge Model

Sidebar badges are intentionally sparse:

- App: major workspace surfaces (for example Steward Paths)
- Tool: supporting utility surfaces (for example Letters & Printables)
- New: newly surfaced features where applicable (for example LiveCom)

Badges are optional and should only be used when they improve orientation.

## Collapsed Mode Behavior

Shared collapsed mode now exists across Donor, Compassion, Events, HRM, and Watchdog sidebars.

Expanded mode:

- shows group labels, item labels, badges, and group toggles
- preserves active route highlighting and chevrons for collapsible groups

Collapsed mode:

- shows icon-only rows
- preserves active route styling
- shows hover/focus tooltips with label, optional description, and optional badge
- keeps keyboard and screen-reader labels via aria-label and aria-current

## Sidebar State Persistence

Collapse state persists in localStorage per module:

- oyamacrm.sidebar.donor.collapsed
- oyamacrm.sidebar.compassion.collapsed
- oyamacrm.sidebar.events.collapsed
- oyamacrm.sidebar.hrm.collapsed
- oyamacrm.sidebar.watchdog.collapsed

Mobile drawers force expanded mode to avoid icon-only navigation on touch screens.

## Permission-Based Visibility

Sidebar items now support config metadata for role and permission context:

- allowedRoles
- hiddenForRoles
- permissions (for future front-end permission checks)

Current implementation uses role-based visibility where required (for example admin-only Watchdog links).

## Shared Sidebar Architecture

Shared sidebar renderer:

- app/components/layout/CrmSidebar.tsx

Module config map:

- app/components/layout/sidebar-configs.tsx

Current module wrappers:

- app/components/layout/Sidebar.tsx
- app/components/layout/CompassionSidebar.tsx
- app/components/layout/EventsSidebar.tsx
- app/components/layout/HrmSidebar.tsx
- app/components/layout/WatchdogSidebar.tsx

## How To Add A New Sidebar Item

1. Add item metadata in app/components/layout/sidebar-configs.tsx within the correct module group.
2. Provide id, label, href, icon, kind, and optional description.
3. Add badge only when needed for orientation.
4. Add allowedRoles/hiddenForRoles when route should be role-scoped.
5. If item uses hash navigation, set activePath and activeHash.
6. Confirm active state in the UI and update tests.

## How To Add Sidebar Configs For New Modules

1. Add a module builder function in app/components/layout/sidebar-configs.tsx.
2. Reuse CrmSidebar in the module-specific sidebar wrapper.
3. Assign a module-specific storage key for collapse persistence.
4. Provide a module variant style or extend CrmSidebar variants as needed.
5. Update module layout mobile drawer to pass forceExpanded.

## Volunteer And HRM Coordination Note

Volunteers remain in Donor CRM under People & Service for now. Future volunteer/staff data governance should coordinate with OyamaHRM ownership to avoid duplicate people-source logic.
