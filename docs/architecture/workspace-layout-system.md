# Workspace Layout System

Last updated: 2026-05-31

## Purpose

This document defines the required workspace model for new major product surfaces and for major workspace refactors.

It is not just visual reference material. It is the architecture contract for dedicated workspaces and one-direction user flow.

Hierarchy:

1. Global module navigation: left sidebar from AppShell
2. Global top bar: workspace switcher, search, quick add, Steward, notifications, and user controls
3. Context header: route identity, readiness status, live metadata, and one primary page action
4. Context-aware ribbon: page-specific tabs and grouped commands for only the current module/page
5. Focused tool work area: center workspace content with project-library-first entry blocks
6. Contextual inspector only when editing detail (drawer/panel, not permanent nav)

When used, this system applies inside page content and does not replace the global sidebar.

The contextual ribbon must be a shared system, not one global command dump. Dashboard, Constituents, donor profiles, Donations, Campaigns, OyamaEmail, OyamaLetters, and Steward Paths each declare their own tabs and commands. Commands that are not relevant to the current page are hidden; commands that are relevant but blocked must be disabled with a reason.

## Mandatory workspace standards

All new major workspaces (and major rewrites of existing workspaces) must follow these rules:

1. Dedicated workspace ownership
	- One canonical route family per major tool.
	- Clear workspace shell identity (sidebar/topbar/action model) appropriate to that module.
	- Cross-module access should deep-link into canonical routes, not duplicate local variants.
2. One-direction workflow
	- Primary path should move forward: list/overview -> build/edit -> review/validate -> publish/activate -> activity/history.
	- Avoid competing parallel flows for the same operation.
3. Functional-only UI
	- No fake lists, fake counters, or fake chart points in production-facing surfaces.
	- No dead controls that appear available without explicit not-implemented messaging.
4. Legacy transition discipline
	- Keep compatibility redirects/wrappers while parity is being proven.
	- Remove duplicate legacy surfaces only after feature/safety parity and validation evidence.

Status labels across all workspace documentation must remain: Working, Partially Working, Demo Only, Broken, Not Implemented.

## Core Components

Primary location: `app/components/workspace-ribbon/`

- `WorkspaceRibbonFrame.tsx`: page-level layout wrapper (header + ribbon + content)
- `WorkspaceRibbon.tsx`: grouped action strip container
- `WorkspaceRibbonGroup.tsx`: labeled action group wrapper
- `WorkspaceRibbonButton.tsx`: action/link button renderer with status handling
- `WorkspaceProjectLibrary.tsx`: project-manager card grid for obvious start paths
- `WorkspaceWizard.tsx`: guided multi-step workflow shell
- `WorkspaceStepIndicator.tsx`: wizard step status indicator
- `WorkspaceInspectorDrawer.tsx`: contextual inspector drawer (only when needed)

Legacy compatibility location: `app/components/workspace/`

- `WorkspaceFrame.tsx`, `WorkspaceControlRail.tsx`, and related rail components remain available for incremental migration and compatibility routes.

## Item and Group Model

`WorkspaceRibbonButton` supports:

- Local view actions (`onClick`)
- Route navigation links (`href`)
- Primary emphasis variant for main starts/actions
- Badges/counts where needed in project library cards
- Readiness status labels: Working, Partially Working, Demo Only, Broken, Not Implemented
- Disabled state with reason

`WorkspaceRibbonGroup` provides sectioned ribbon organization.

## Current Rollout

Current workspace-ribbon adoption targets:

- Donor dashboard, Constituents, constituent profile, Donations, and Campaigns
- OyamaEmail and OyamaLetters dedicated workspaces
- Steward Paths Library, Builder, and Playground route families
- Communications workspace
- Letters & Printables workspace
- Steward Paths legacy operations workspace (`/automations?view=legacy`)
- Grants case-file workspace (`/grants/[id]`)
- Constituent detail workspace (`/constituents/[id]`)

Evidence:

- `app/communications/page.tsx`
- `app/letters-printables/page.tsx`
- `app/automations/page.tsx`
- `app/grants/[id]/page.tsx`
- `app/constituents/[id]/page.tsx`
- `app/components/workspace-ribbon/*`
- `app/components/workspace/*`

Rollout changes:

- Replaced page-local horizontal tab strips and permanent right-rail navigation with grouped top ribbons.
- Added project-library-first entry cards so each workspace has one obvious starting path.
- Added guided wizard routes for creation flows instead of requiring tab-hunting.
- Kept related tools as explicit links from ribbon groups and project cards.

## Ownership Boundaries (Communications Example)

- Communications owns: email campaigns, drafts, send queue, communication log.
- Letters & Printables owns: printable templates, generated letters, print queue, mail queue, physical mail operations.

Ribbon groups and project-library cards keep Letters & Printables linked as a related workspace while preserving ownership boundaries.

## Rollout Guidance

Consider Workspace Ribbon on pages that have:

- More than three local views
- Mixed modes (overview, queue, settings, logs, templates, builders)
- Related workspace cross-links
- Horizontal tab crowding that reduces focus area
- A need for a single obvious start path via project cards/wizards

Suggested next candidates:

- Reports
- Events scoped tools
- Compassion client workspace tabs
- Data Tools importer
- Settings subsections

Mandatory evidence for a major workspace rollout:

- Route inventory (canonical + redirect compatibility map)
- API boundary list for live data behavior
- Safety defaults check (draft-first/review-first where applicable)
- Validation proof (typecheck/build/tests relevant to changed scope)

## Accessibility and Responsiveness

- Local controls render as buttons.
- Route navigation controls render as links.
- Active item uses `aria-current`.
- Disabled controls prevent selection and expose context via title/description.
- Avoid permanent right-side nav rails as the default workspace navigation pattern.
- Inspectors should open only for contextual editing and should collapse into drawers on compact widths.

## Compact Desktop Standard

OyamaCRM treats small laptops as a first-class layout target rather than a degraded desktop view.

Target widths:

- `1024x768`
- `1180x720`
- `1280x720`
- `1280x800`
- `1366x768`
- `1440x900`
- `1536x864`

Shared layout expectations:

- Below `1024px`, side navigation uses a drawer pattern.
- From `1024px` through `1439px`, CRM sidebars default to icon-only compact mode.
- From `1024px` through `1439px`, permanent right-side workspace navigation rails are not used.
- Inspectors and contextual detail panes must collapse behind explicit triggers/drawers on compact desktop widths.
- Global shell content uses `min-w-0`, `max-w-full`, and contained overflow so routes do not create page-level horizontal scrolling.
- The TopBar must stay on a single intentional row on compact desktop widths by shortening spacing and moving lower-priority tools into a compact actions menu.
- Tables should scroll inside their own rounded container instead of forcing page-wide overflow.

Validation expectations:

- New workspaces should be checked at `1366x768` and `1280x720` before being considered layout-complete.
- Responsive audit evidence can be written to `docs/status/responsive-ui-audit.json` and `docs/status/responsive-ui-audit.md` via `scripts/qa/responsive-ui-pass.mjs` when that audit pass is part of the work.
