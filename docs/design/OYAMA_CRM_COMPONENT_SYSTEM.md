# OyamaCRM CRM Component System

Date: May 19, 2026

## Components

- `CRMCard`: standard white card surface.
- `CRMPageHeader`: page hierarchy with breadcrumb, status, title, description, and actions.
- `CRMMetricCard`: KPI card with icon badge, value, helper text, and tone.
- `CRMActionBar`: single clean action strip for page actions.
- `CRMFilterBar`: consistent search/filter strip.
- `CRMDataTable`: soft table scroll shell.
- `CRMStatusBadge`: calm status/tag badge.
- `CRMEmptyState`: no-data state with optional action.
- `CRMQuickActionCard`: dashboard/workspace launcher card.

## Rules

- Keep primitives presentational. Do not put API calls or route-specific behavior inside them.
- Preserve existing props and handlers when wrapping older components.
- Prefer composing these primitives around current page logic before deeper refactors.
- Use green sparingly for primary actions and active states, not every control.
- Keep cards shallow; do not put card-like page sections inside card-like wrappers.
