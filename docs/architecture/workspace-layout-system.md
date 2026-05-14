# Workspace Layout System

Last updated: 2026-05-13

## Purpose

The Workspace Layout System standardizes page-level controls so complex tools stop inventing unique tab bars and control strips.

Hierarchy:

1. Global module navigation: left sidebar from AppShell
2. Focused tool work area: center workspace content
3. Local tool controls: right Workspace Control Rail

This system applies inside page content and does not replace the global sidebar.

## Core Components

Location: `app/components/workspace/`

- `WorkspaceFrame.tsx`: page-level layout wrapper (header + center content + optional right rail)
- `WorkspaceHeader.tsx`: reusable title/description/actions region
- `WorkspaceMain.tsx`: center workspace content container
- `WorkspaceControlRail.tsx`: grouped contextual controls with sticky behavior and collapse
- `WorkspaceControlRailGroup.tsx`: section wrapper for grouped controls
- `WorkspaceControlRailItem.tsx`: button/link item renderer with badges/status/disabled handling
- `workspace-types.ts`: shared item/group interfaces and status labels
- `workspace-presets.ts`: preset builders for reusable rail definitions

## Item and Group Model

`WorkspaceControlItem` supports:

- Local view items (button + `onSelect`)
- Related workspace links (`href`, optional external marker)
- Badges/counts
- Readiness status labels: Working, Partially Working, Demo Only, Broken, Not Implemented
- Disabled state with reason

`WorkspaceControlGroup` provides sectioned rail organization.

## Current Rollout

Current DonorCRM refactor targets:

- Communications workspace
- Steward Paths legacy operations workspace (`/automations?view=legacy`)
- Grants case-file workspace (`/grants/[id]`)
- Constituent detail workspace (`/constituents/[id]`)

Evidence:

- `app/communications/page.tsx`
- `app/automations/page.tsx`
- `app/grants/[id]/page.tsx`
- `app/constituents/[id]/page.tsx`
- `app/components/workspace/*`

Rollout changes:

- Replaced page-local horizontal tab strips with grouped right-side control rails.
- Preserved existing content branches and state behavior for local views.
- Kept related tools as explicit cross-workspace links in control rail sections.
- Kept quick actions in the rail so primary operations stay one click away.

## Ownership Boundaries (Communications Example)

- Communications owns: email campaigns, drafts, send queue, communication log.
- Letters & Printables owns: printable templates, generated letters, print queue, mail queue, physical mail operations.

The control rail keeps Letters & Printables as a related workspace link, not a local Communications tab.

## Rollout Guidance

Apply Workspace Control Rail to pages that have:

- More than three local views
- Mixed modes (overview, queue, settings, logs, templates, builders)
- Related workspace cross-links
- Horizontal tab crowding that reduces focus area

Suggested next candidates:

- Letters & Printables
- Reports
- Events scoped tools
- Compassion client workspace tabs
- Data Tools importer
- Settings subsections

## Accessibility and Responsiveness

- Local controls render as buttons.
- Route navigation controls render as links.
- Active item uses `aria-current`.
- Disabled controls prevent selection and expose context via title/description.
- Rail supports collapse on desktop and drawer fallback on smaller screens.
