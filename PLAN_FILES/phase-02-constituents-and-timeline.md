# Phase 02 — Constituents and Timeline

## Goal

Deliver complete constituent profiles with relationship history and stewardship context.

## Scope

- Constituents CRUD + profile pages
- Household/relationship support
- Tags/groups hooks
- Timeline event model and rendering
- Search and filtering

## Manageable steps

1. Align constituent schema fields with profile UX and import needs.
2. Finish create/edit/detail/list flows with modular components.
3. Implement household + relationship links (person/org).
4. Attach timeline event writes to key actions (create/update/gift/task).
5. Add quick filters (type, status, engagement, tags).
6. Add profile tabs for gifts, tasks, notes, activity.
7. Add placeholder markers for not-yet-functional profile sections.

## Exit criteria

- Staff can create/search/open/update constituents.
- Relationship history is visible in timeline form.
- Major profile surfaces are modular and reusable.

## Audit snapshot — 2026-05-08

- [x] Constituents list/create/edit/detail flows are working — verified in `app/constituents/*` and `server/src/routes/constituents.ts`.
- [x] Timeline writes for create/update are present — verified in `server/src/routes/constituents.ts`.
- [x] Household detail panel exists — verified in `app/components/constituents/HouseholdPanel.tsx`.
- [~] Tag and relationship foundations exist in schema (`Tag`, `ConstituentTag`), but management UI and advanced segmentation are missing.
- [ ] CSV import, dedupe, bulk edit, custom fields, and saved segments have not started in usable code.
