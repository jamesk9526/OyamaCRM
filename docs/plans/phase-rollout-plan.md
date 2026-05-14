# OyamaCRM Phase Rollout Plan

This document defines how to execute the active backlog without letting plan drift return.

## Execution workflow

1. Start from `docs/backlog/master-plan-backlog.md` and choose the earliest unfinished phase.
2. Open that phase packet and convert the remaining items into executable todos.
3. Ship vertical slices: schema/API/UI/tests/docs for one feature at a time.
4. Update `docs/backlog/master-plan-backlog.md` first, then sync any changed scope into the phase packet.
5. Run gate checks before closing a phase checkpoint.

## Governance rules

- Keep pages thin and modular, with reusable components under `app/components/*`.
- Keep `"use client"` scoped to the smallest interactive boundary.
- Keep Express routes thin; move substantial logic into shared services/helpers.
- Keep donor and Compassion language, data, and permissions separate.
- Treat long-form legacy briefs as archived references, not active checklists.

## Phase order

1. Phase 00 — Setup, Settings, and Workspace Bootstrap
2. Phase 01 — Foundation and Auth
3. Phase 02 — Constituents and Timeline
4. Phase 03 — Donations, Funds, and Campaigns
5. Phase 04 — Receipts, Tasks, and Communications
6. Phase 05 — Dashboard and Reports
7. Phase 06 — Groups, Segments, and Automation
8. Phase 07 — Events and Gala Operations
9. Phase 08 — Security, Integrations, AI, and Operations
10. Phase 09 — Compassion Workspace

## Current focus

Use `phase-00-setup-onboarding-settings.md` as the first active packet for remaining setup/settings/bootstrap work, then continue phase-by-phase from the master backlog.

