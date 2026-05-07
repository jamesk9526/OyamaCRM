# OyamaCRM Phase Rollout Plan

This plan turns the large master document into executable phase packets with a repeatable workflow.

## Execution workflow

1. **Start with one phase packet** (`phase-0X-*.md`) and its Mermaid map (`phase-0X-*.mmd`).
2. **Convert each phase checklist into SQL todos** before implementation.
3. **Implement in vertical slices**: schema/API/UI/automation for one feature at a time.
4. **Run gate checks** at phase end: build, type-check, smoke paths, seed compatibility.
5. **Checkpoint and document** what shipped, what changed, and what is deferred.
6. **Only then move to the next phase** based on declared dependencies.

## Governance rules per phase

- Keep pages thin and modular, with reusable components under `app/components/*`.
- Keep Express routes thin; move logic to services as modules mature.
- Preserve white + green theme and AppShell layout conventions.
- Mark non-functional surfaces with a clear "not functional yet" badge.
- Add or update AGENTS.md notes when a new architectural rule is introduced.

## Phase order

1. Phase 01: Foundation, auth, and platform standards
2. Phase 02: Constituents and relationship timeline
3. Phase 03: Donations, funds, campaigns, and appeals
4. Phase 04: Receipts, tasks, and communications workflows
5. Phase 05: Dashboard, caching, and core reports
6. Phase 06: Groups, segments, and automation engine
7. Phase 07: Events and gala operations
8. Phase 08: Security hardening, integrations, ops, and AI enablement

## Immediate next step

Use `phase-01-foundation-and-auth.md` as the active work packet, then promote progress phase-by-phase.

