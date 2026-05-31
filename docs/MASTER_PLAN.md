# OyamaCRM Master Plan and Reality Audit

Last updated: 2026-05-31
Canonical owner: Platform architecture and delivery planning

This is the canonical project master plan.

## Project Vision

OyamaCRM is a modular nonprofit platform with separated workspaces:

- DonorCRM for fundraising and stewardship
- Compassion CRM for client-service workflows
- Events CRM for event operations and follow-up
- Standalone apps under `/apps/*` that are not CRM modules

The target outcome is a reliable stewardship loop with protected data boundaries, auditable operations, and clear status truth.

## Current Architecture

- Web app: `app/*` (Next.js App Router)
- API layer: `server/src/routes/*` (Express)
- Data model: `prisma/schema.prisma`
- Operational status sources: `docs/status/features.md`, `docs/status/production-readiness-checklist.md`
- Planning and backlog: `docs/plans/*`, `docs/backlog/*`
- Workspace layout system: `app/components/workspace/*` with `WorkspaceFrame` and `WorkspaceControlRail`

## Module Map

- DonorCRM routes: top-level `app/*` donor pages (for example `app/constituents`, `app/donations`, `app/campaigns`)
- Compassion routes: `app/compassion/*`
- Events routes: `app/events/*`
- Standalone apps: `app/apps/*`

## Current Status by Area

Status labels are restricted to: Working, Partially Working, Demo Only, Broken, Not Implemented.

### DonorCRM

Status: Partially Working

Evidence:

- Core donor workflows and APIs: `server/src/routes/constituents.ts`, `server/src/routes/donations.ts`, `server/src/routes/campaigns.ts`, `server/src/routes/tasks.ts`
- Donor UI routes: `app/constituents/page.tsx`, `app/donations/page.tsx`, `app/campaigns/page.tsx`, `app/tasks/page.tsx`
- Detailed matrix: `docs/status/features.md`

Summary:

- Core CRUD and core stewardship loops are operational.
- Some advanced workflows and quality gates remain partial.

### Compassion CRM

Status: Partially Working

Evidence:

- Module shell/routes: `app/compassion/layout.tsx`, `app/compassion/*`
- Public scheduling and slot validation are documented and represented in status docs.
- Status references: `docs/status/features.md`, `docs/CLIENT_CRM_AUDIT.md`

Summary:

- Working core surfaces exist.
- Full workspace-permission enforcement and advanced flows remain partial.

### Events CRM

Status: Partially Working

Evidence:

- Core event APIs: `server/src/routes/events.ts`
- Event routes and scoped workspace: `app/events/*`
- Status docs: `docs/status/events-crm-status.md`, `docs/status/features.md`

Summary:

- Core event operations are present.
- Several tool areas remain scaffolded or partially wired.

### Standalone Apps

Status: Partially Working

Evidence:

- App routes under `app/apps/*`
- Boundary requirements in `AGENTS.md` standalone app rules

Summary:

- App boundary model exists.
- Broader app catalog and integration hardening remain partial.

### OyamaWebMaster

Status: Partially Working

Evidence:

- Site manager, editor, preview, and publishing routes: `app/webmaster/*`
- Publishing APIs and versioned rollback: `server/src/routes/webmaster.ts`, `server/src/services/webmaster-store.ts`
- Readiness and delta reporting: `server/src/services/webmaster-publish-readiness.ts`
- Architecture plans: `docs/OYAMA_WEBMASTER_REBUILD_PLAN.md`, `docs/OYAMA_WEBMASTER_PUBLISHING_ARCHITECTURE.md`, `docs/OYAMA_WEBMASTER_DATA_SAFETY.md`

Summary:

- Core publish-readiness, confirmation-gated publish execution, and rollback execution are now working with immutable snapshot history.
- External deployment target adapters and several secondary workspace surfaces (templates/cms/assets/forms/settings/theme depth) remain partial or not implemented.
- Webmaster remains outside production-ready claims until remaining workspace surfaces and deployment adapters are delivered with tests.

### Steward AI and Steward Paths

Status: Partially Working

Evidence:

- Builder and workflow components: `app/components/steward-paths/*`
- Builder routes: `app/steward-paths/builder/page.tsx`, `app/automations/page.tsx`
- Engine/routes: `server/src/routes/steward-paths.ts`, `server/src/services/steward-paths-sequence-engine.ts`
- Detailed status: `docs/status/features.md`

Summary:

- Visual builder workspace is present.
- Branch-aware save/load and export are implemented.
- Execution support now includes branch routing, expanded delay modes, and manual command operations; remaining gaps are primarily release-gate quality lanes rather than missing builder persistence.

### Communications, Letters, and Printables Unified Engagement System

Status: Partially Working

System ownership model:

- Steward Paths: orchestration and automation
- Communications: email campaigns, drafts, send queue/logs, engagement events
- Letters and Printables: form letters, print queue, mail queue, printable outputs
- Tasks: human follow-up
- Activities/Timeline: source-of-truth event history

Evidence:

- Communications route and components: `app/communications/page.tsx`, `app/components/communications/*`
- Workspace layout and controls: `app/components/workspace/WorkspaceFrame.tsx`, `app/components/workspace/WorkspaceControlRail.tsx`, `docs/architecture/workspace-layout-system.md`
- Letters routes/components: `app/letters-printables/*`, `server/src/routes/letters.ts`
- Engagement architecture docs: `docs/DONOR_ENGAGEMENT_SYSTEM.md`, `docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md`

### Data Import and Export

Status: Partially Working

Evidence:

- Import tooling docs: `docs/status/import-tools.md`
- Feature matrix references in `docs/status/features.md`

Summary:

- Core import flow exists.
- Merge-finalize and rollback depth remain partial.

### Auth, Roles, Permissions, and Workspace Boundaries

Status: Partially Working

Evidence:

- Auth endpoints and usage are present in platform routes.
- Permission gaps and release blockers are tracked in `docs/status/production-readiness-checklist.md`.

Summary:

- Authentication is working.
- Permission matrix and workspace-enforcement depth remain partial.

## Production Readiness Summary

Current gate status: Broken

Evidence:

- Release gate source of truth: `docs/status/production-readiness-checklist.md`
- Latest audited command evidence set under `docs/status/audit-artifacts/2026-05-12/`
- Current cleanup audit and gate matrix: `docs/audits/OYAMACRM_REPO_CLEANUP_AUDIT.md`

Blocking lanes currently documented as Broken include lint, e2e lanes, and Prisma generate in the latest recorded pass.

### Latest Cleanup Gate Snapshot (2026-05-31)

Current run outcomes:

- `pnpm lint`: Broken (`166 problems`, including `28 errors`)
- `pnpm typecheck`: Working
- `pnpm test`: Working (`66/66` files, `570/570` tests)
- `pnpm build`: Working
- `npx depcheck`: findings present (unused/missing dependency candidates)
- `npx knip`: findings present (unused files/exports/deps candidates)

Cleanup detail packets for this pass:

- `docs/audits/OYAMACRM_REPO_CLEANUP_AUDIT.md`
- `docs/audits/DELETABLE_MARKDOWN_FILES.md`
- `docs/audits/UNUSED_CODE_CANDIDATES.md`
- `docs/audits/UI_CLUTTER_REDUCTION_PLAN.md`

## Current Blockers

- Release-gate lane failures tracked in `docs/status/production-readiness-checklist.md`
- Primary gate blocker: lint errors across hooks, Next.js Link usage, and ref-access rules
- Workspace-permission enforcement is incomplete in parts of the platform
- Remaining scaffold/partial surfaces in Events, Compassion advanced workflows, and some engagement depth

## Next Implementation Priorities

1. Triage lint errors by severity category and remove hook-order/linking/ref blockers first.
2. Complete workspace permission enforcement and policy coverage.
3. Execute phased UI clutter reduction with functional-only controls.
4. Run staged dependency/unused-code cleanup from knip/depcheck candidate lists.
5. Keep all status docs evidence-backed and synchronized after each pass.

## Documentation Source-of-Truth Map

- Canonical master plan and reality audit: `docs/MASTER_PLAN.md`
- Feature-by-feature implementation status: `docs/status/features.md`
- Production release gate: `docs/status/production-readiness-checklist.md`
- OyamaWebMaster architecture and delivery plans: `docs/OYAMA_WEBMASTER_REBUILD_PLAN.md`, `docs/OYAMA_WEBMASTER_PUBLISHING_ARCHITECTURE.md`, `docs/OYAMA_WEBMASTER_DATA_SAFETY.md`
- Active planning packets: `docs/plans/*`
- Backlog-focused planning: `docs/backlog/*`
- Historical audits: `docs/audits/*`
- 2026-05-31 cleanup packet: `docs/audits/OYAMACRM_REPO_CLEANUP_AUDIT.md`, `docs/audits/DELETABLE_MARKDOWN_FILES.md`, `docs/audits/UNUSED_CODE_CANDIDATES.md`, `docs/audits/UI_CLUTTER_REDUCTION_PLAN.md`
- Office operations guide: `docs/howto/HOW_TO_USE.md`
- Workspace layout architecture: `docs/architecture/workspace-layout-system.md`

Legacy docs retired and merged into canonical sources:

- `docs/IMPLEMENTATION_STATUS.md` (merged into `docs/MASTER_PLAN.md` and `docs/status/features.md`)
- `docs/status/oyama-webmaster.md` (merged into `docs/OYAMA_WEBMASTER_REBUILD_PLAN.md` and `docs/MASTER_PLAN.md`)

## Agent Operating Rules Summary

- Guardrails must protect safety boundaries (privacy, permissions, route compatibility, auditability).
- Agents are allowed to perform incremental refactors when requested or when structure blocks clean implementation.
- Refactors should ship as vertical slices: audit, plan, change, tests, status update.
- Documentation and status files must be updated alongside meaningful architecture changes.
- Strict rules are guardrails, not handcuffs.
