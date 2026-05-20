# OyamaCRM Visual Refresh

Date: May 19, 2026

## Summary

This refresh keeps OyamaCRM's existing application structure and working behavior while standardizing the Donor CRM visual language. Screenshots supplied by product are inspiration only; implementation should follow OyamaCRM's routes, data models, and component boundaries.

## Visual Language

- Background: very light gray/green-tinted workspace.
- Cards: white, soft border, 12-18px radius, subtle shadow.
- Accent: green-600 for primary actions, active navigation, and positive status.
- Text: deep slate primary, muted slate/gray secondary.
- Buttons: green primary, white secondary, low-noise ghost actions, red only for destructive work.
- Badges: soft backgrounds and readable text.
- Tables: taller rows, softer dividers, fewer vertical grid lines.

## First Pass Completed

- Shared CRM primitives added under `app/components/ui/crm/`.
- Dashboard metric card styling moved to the new shared `CRMMetricCard` surface through the existing `StatCard` API.
- Dashboard command center visual weight reduced while preserving data loading, quick links, and next-move logic.
- Plan/checklist created at `docs/design/OYAMA_CRM_VISUAL_REFRESH_PLAN.md`.

## Remaining Priority

1. Top bar polish.
2. Sidebar grouping and calmer active states.
3. Constituents page shared header/metrics/filter/table pass.
4. Donations page shared header/metrics/filter/table pass.
5. Meetings page shared header/metrics/list-card pass.
6. Full responsive QA at 1366x768 and 1280x720.
