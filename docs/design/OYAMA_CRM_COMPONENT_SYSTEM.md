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

## Guidelines

- Keep primitives presentational by default. Route-specific behavior and data loading should usually stay in feature code.
- Preserve existing props and handlers when wrapping older components unless a broader refactor intentionally changes the contract.
- Prefer composing these primitives around current page logic before deeper refactors.
- Keep card nesting shallow where practical so pages do not become visually heavy.
