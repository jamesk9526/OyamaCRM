# OyamaCRM Feature Status Audit

_Last deep audit: 2026-05-13_

## 2026-05-14 OyamaWebMaster Full Visual Editor + Preview + Publishing Workspace Pass

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Full-tab visual editor workspace | Partially Working | `app/webmaster/editor/page.tsx`, `app/components/webmaster/editor/*` | New editor layout includes top command bar, left tool rail, center live canvas, and right inspector with page/section/block editing. |
| Shared page renderer for edit + preview | Working | `app/components/webmaster/rendering/WebmasterPageRenderer.tsx`, `WebmasterSectionRenderer.tsx`, `WebmasterBlockRenderer.tsx` | Canvas now renders page-like output instead of only section-card stacks; edit overlays appear only during active editing. |
| Draft preview route | Working | `app/webmaster/preview/[siteId]/[pageId]/page.tsx`, `app/components/webmaster/WebmasterDraftPreviewPage.tsx` | Preview now opens a real draft route without editor chrome, supports desktop/tablet/mobile widths, and listens for editor save updates via BroadcastChannel. |
| Publish readiness API + command center | Working | `server/src/routes/webmaster.ts`, `server/src/services/webmaster-publish-readiness.ts`, `app/webmaster/publishing/page.tsx`, `app/components/webmaster/WebmasterPublishingWorkspace.tsx` | Replaced generic publish warning path with readiness checklist workspace and site-level preflight endpoint. |
| Publish execution and rollback execution | Not Implemented | `app/components/webmaster/WebmasterPublishingWorkspace.tsx`, `server/src/services/webmaster-publish-readiness.ts` | Workspace is real and actionable for readiness, but deployment execution and rollback actions remain intentionally disabled/not implemented. |

## 2026-05-14 Steward AI Bridge Pairing Automation Pass

| Area | Status | Evidence | Notes |
|---|---|---|---|
| CRM-side bridge readiness + pairing key APIs | Working | `server/src/routes/steward-ai.ts` | Added `GET /api/steward-ai/bridge/readiness` and `POST /api/steward-ai/bridge/pairing-key` so admins can validate readiness and generate URL/token/key payloads for desktop bridge pairing. |
| AI settings pairing workflow UI | Working | `app/components/settings/ai/BridgePairingPanel.tsx`, `app/components/settings/ai/AISettingsPage.tsx` | Added in-app controls to generate pairing URL, copy token, download key JSON, and run live readiness checks before bridge setup. |
| Desktop Bridge Manager pairing import/apply flow | Working | `Desktopapp/shell.html`, `Desktopapp/shell.js`, `Desktopapp/styles.css` | Bridge modal now supports paste-from-URL/token and key-file import that auto-applies config and starts bridge when autostart is enabled in pairing payload. |

## 2026-05-13 DonorCRM Browser-Driven QA and Screenshot Refresh

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Donor route pass across desktop/laptop/tablet/mobile | Working | `scripts/qa/donor-browser-pass.mjs`, `docs/modules/donor-crm/browser-qa-metrics-2026-05-13.json` | Executed browser checks across 1440, 1280, 768, and 390 widths with per-route metrics and screenshot output. |
| Donor screenshot pack refresh | Working | `docs/screenshots/donor-crm/2026-05-13/*`, `docs/screenshots/donor-crm/README.md` | Captured fresh dashboard, constituents, donations, campaign, communications, letters, steward paths, reports, data tools, and settings visuals. |
| Legacy donor screenshot retirement | Working | `docs/screenshots/donor-crm/archive/2026-05-13-legacy-readme/*` | Outdated donor screenshot files were archived and docs now point to dated production captures. |
| Constituent profile route stability + mobile action layout | Working | `app/constituents/[id]/page.tsx` | Fixed hook-order runtime crash (`Rendered more hooks than during the previous render`) by moving `useMemo` hooks ahead of loading/error early returns, and improved mobile quick-action stacking for the profile CTA cluster. |
| Donor workflow QA report | Working | `docs/modules/donor-crm/browser-qa-report.md` | Added page-level status matrix, workflow test outcomes, known issues, and validation lane results. |

## 2026-05-13 Donor Stewardship Vertical Loop Slice (Donation -> Follow-up)

| Area | Status | Evidence | Notes |
|---|---|---|---|
| One-click `Complete Loop` action on Donations rows | Working | `app/donations/page.tsx`, `app/components/donations/DonationTable.tsx` | Added row-level orchestration trigger in desktop and mobile action layouts so staff can run the full stewardship handoff from one click. |
| Server-side donation stewardship orchestration endpoint | Working | `server/src/routes/donations.ts` (`POST /api/donations/:id/quick-actions/stewardship-loop`) | Endpoint now creates or reuses an email draft, a follow-up task, and a steward path enrollment with duplicate guards and deterministic redirect selection. |
| Timeline + audit evidence for complete-loop runs | Working | `server/src/routes/donations.ts` | Runs now write a constituent activity note and audit event (`DONATION_STEWARDSHIP_LOOP_EXECUTED`) with per-action status metadata. |
| Cross-workspace artifact visibility smoke coverage | Working | `tests/smoke/donations-crud.test.ts` | Smoke verifies loop artifacts are visible through communications (`/api/email-campaigns/:id`), tasks (`/api/tasks`), steward paths (`/api/steward-paths/enrollments`), and constituent timeline (`/api/constituents/:id`). |
| Steward Paths workspace default + saved-path builder access | Working | `app/automations/page.tsx` | `/automations` remains the main operations workspace while saved visual paths expose direct `Open in Builder` actions. |
| Legacy card `Edit workflow` behavior | Working | `app/automations/page.tsx` | Edit action now routes to `/steward-paths/builder` (`Edit in Builder`) so open/edit workflow actions consistently land in the visual builder. |

## 2026-05-13 Steward Paths Full Node Execution + Drag-and-Drop Activation

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Builder branch-aware persistence/export | Working | `app/components/steward-paths/workflow-transformers.ts` | Visual branch lanes now export to executable branch step sequences with resolved jump order indexes. |
| Palette node execution coverage | Working | `app/components/steward-paths/palette-catalog.ts`, `app/components/steward-paths/workflow-transformers.ts`, `server/src/services/steward-paths-sequence-engine.ts` | Palette nodes now map to runnable step payloads (including delay modes, manual command nodes, and internal-note operations for tag/letter status actions). |
| Sequence engine delay/branch/manual/internal-note expansion | Working | `server/src/services/steward-paths-sequence-engine.ts` | Added `between` branch operator, delay scheduling modes (`until_date`, `until_weekday_time`, `after_last_gift`), manual commands (`pause/stop/notify`), and internal-note side effects (tag add/remove, print/mail status updates). |
| True drag-and-drop in builder canvas | Working | `app/components/steward-paths/WorkflowNodeCard.tsx`, `WorkflowMap.tsx`, `WorkflowCanvas.tsx`, `NodePalette.tsx`, `workflow-utils.ts` | Drag existing nodes across root/lane containers and drag palette blocks directly into drop targets. Up/down controls remain as secondary fallback controls. |
| Steward Paths workflow test coverage refresh | Working | `tests/unit/steward-paths-workflow-builder.test.ts`, `tests/unit/engagement-orchestration.test.ts` | Updated branch activation expectations, added relocate-node utility test, and added `between` operator coverage. |

## 2026-05-13 Workspace Control Rail System (DonorCRM rollout)

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Reusable WorkspaceFrame and control rail component set | Working | `app/components/workspace/WorkspaceFrame.tsx`, `WorkspaceHeader.tsx`, `WorkspaceMain.tsx`, `WorkspaceControlRail.tsx`, `WorkspaceControlRailGroup.tsx`, `WorkspaceControlRailItem.tsx`, `workspace-types.ts`, `workspace-presets.ts` | New reusable page-level layout keeps center work area focused while moving local controls into a right contextual rail. |
| Communications page migrated from horizontal tab strip | Working | `app/communications/page.tsx` | Local workspace controls now live in grouped right-rail sections (Workspace Views, Related Workspaces, Quick Actions). Existing content behavior is preserved. |
| Steward Paths legacy workspace migrated from horizontal tab strip | Working | `app/automations/page.tsx` (`/automations?view=legacy`) | Legacy page tabs are now represented as right-rail Workspace Views with quick actions for create and refresh. |
| Grant case-file detail migrated from horizontal tab strip | Working | `app/grants/[id]/page.tsx` | Grant detail views (overview/research/requirements/reminders/tasks/resources/writing/decision/activity) now route through right-rail controls. |
| Constituent detail profile migrated from horizontal tab strip | Working | `app/constituents/[id]/page.tsx` | Giving/tasks/timeline/notes/household views now use right-rail selection and preserve existing content and actions. |
| Communications query-driven view support | Partially Working | `app/communications/page.tsx` (`?view=` sync) | Supports deep-linking for local views while preserving local state switching. |
| Workspace layout architecture documentation | Working | `docs/architecture/workspace-layout-system.md` | Pattern and rollout guidance are documented for future workspace refactors. |

## 2026-05-13 Documentation Consolidation and Source-of-Truth Alignment

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Canonical master plan location | Working | `docs/MASTER_PLAN.md` | `MASTER_PLAN.md` authority is consolidated under docs and no longer split with `docs/backlog/master-plan-backlog.md`. |
| Backlog and phase-packet hierarchy | Working | `docs/backlog/master-plan-backlog.md`, `docs/plans/phase-index.md`, `docs/plans/*` | Legacy `PLAN_FILES/*.md` content was moved into docs-owned planning folders and relinked. |
| Office operations guide location | Working | `docs/howto/HOW_TO_USE.md` | Operations guidance is now under docs with updated references. |
| Markdown documentation audit coverage | Working | `docs/audits/markdown-documentation-audit.md` | Full markdown inventory with per-file disposition and destination is recorded. |

## 2026-05-13 Donor Engagement Unified System Refactor — Phase 5 (BRANCH and STATUS_CHANGE step execution)

| Area | Status | Evidence | Notes |
|---|---|---|---|
| `STATUS_CHANGE` step execution | Working | `server/src/services/steward-paths-sequence-engine.ts` `processStatusChangeStep`, `buildStatusChangeUpdate`, `tests/unit/steward-paths-status-change.test.ts` | Updates the linked constituent's `donorStatus` (enum-validated), `engagementScore` (0-100, rounded), or one of the boolean preference flags (`doNotEmail`, `emailOptOut`, `doNotMail`, `doNotCall`, `doNotContact`). Field is allow-listed; invalid configs fail the step with descriptive errors. Writes a `NOTE` activity (with `metadata.kind = "status_change"`) and a timeline event. Skips cleanly when enrollment has no constituent. 16 unit tests. |
| `BRANCH_PLACEHOLDER` step execution | Working | `server/src/services/steward-paths-sequence-engine.ts` `processBranchStep` | Evaluates `configJson.condition` (`field`, `operator`, `value`) against the enrollment's constituent context using the same `evaluateBranchRule` semantics as `app/lib/engagement-orchestration.ts` (mirrored in-engine because the server tsconfig rootDir excludes `app/`). On match, jumps to `whenTrueAdvanceToOrderIndex`; otherwise to `whenFalseAdvanceToOrderIndex`; if either is omitted, advances sequentially. Records `matched`, `field`, `operator`, `compareValue`, and `observed` in the run result for auditability. |
| `advanceEnrollment` jump-to-order-index support | Working | `server/src/services/steward-paths-sequence-engine.ts` `advanceEnrollment` | New optional `targetOrderIndex` parameter lets branch steps skip ahead. Backwards compatible — existing call sites omit the parameter and behave exactly as before (next sequential step). |
| Branch operator parity between engine and shared helper | Working | `server/src/services/steward-paths-sequence-engine.ts` (in-file `evaluateBranchRule`), `app/lib/engagement-orchestration.ts`, `tests/unit/engagement-orchestration.test.ts` | Engine keeps a documented in-file mirror because of the server tsconfig rootDir boundary; algorithms are identical. Both surfaces support `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in` with case-insensitive string compare. |
| Sequence engine cutover to single shared helper module | Partially Working | `server/src/services/steward-paths-sequence-engine.ts` | The mirror keeps semantics in sync without crossing the server tsconfig boundary. A future "shared package" pass can collapse them; not blocking. |
| New step types (wait-until-date, weekday/time, tag mutations, manual approval, retry, notify, stop) | Not Implemented | `server/src/services/steward-paths-sequence-engine.ts`, `app/components/steward-paths/palette-catalog.ts` | Palette items exist with honest "Partially Working / Not Implemented" badges; engine processors are not yet implemented. |

## 2026-05-13 Donor Engagement Unified System Refactor — Phase 4 continuation (visual automation canvas)

| Area | Status | Evidence | Notes |
|---|---|---|---|
| `app/components/steward-paths/` workspace components | Working | `app/components/steward-paths/StewardPathBuilderPage.tsx`, `WorkflowCanvas.tsx`, `WorkflowMap.tsx`, `WorkflowConnector.tsx`, `BranchGroup.tsx`, `BranchLane.tsx`, `NodePalette.tsx`, `NodeInspector.tsx`, `WorkflowNodeCard.tsx`, `workflow-types.ts`, `workflow-utils.ts`, `workflow-layout.ts`, `workflow-transformers.ts` | Visual map-first builder now ships with top bar, searchable palette, center map, branch lane cards, connector plus-buttons, and full-height inspector. Palette still carries honest readiness badges. |
| `/steward-paths/builder` route | Working | `app/steward-paths/builder/page.tsx` | Route is live and interactive as the visual builder workspace while `/automations` remains compatible for current operations. |
| Visual builder persistence (save/load against `/api/steward-paths`) | Working | `app/components/steward-paths/StewardPathBuilderPage.tsx`, `app/components/steward-paths/workflow-transformers.ts` | Builder now loads templates and saves branch-aware workflows via typed adapters with executable order-index mapping. |
| Branch node representation (lanes, labels, conditions, connector lines) | Working | `app/components/steward-paths/WorkflowMap.tsx`, `BranchGroup.tsx`, `BranchLane.tsx`, `NodeInspector.tsx` | If/else blocks render split lanes with condition summaries, empty-lane add states, and lane-level condition editing in inspector. |
| Drag-and-drop reordering | Working | `app/components/steward-paths/NodePalette.tsx`, `WorkflowNodeCard.tsx`, `WorkflowMap.tsx`, `workflow-utils.ts` | Palette-to-canvas and node relocation drag/drop are live across root/lane containers; up/down controls remain as fallback utilities. |
| Builder workflow utility coverage | Working | `tests/unit/steward-paths-workflow-builder.test.ts` | Added tests for node insertion, branch lane add/remove, lane insertion, config update, linear export conversion, and unsupported-branch activation guard. |

## 2026-05-13 Donor Engagement Unified System Refactor — Phase 2 (UI relabeling, shared status) and Phase 3 partial (shared service contracts foundation)

Status labels used in this section are restricted to:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Shared engagement status vocabulary helpers | Working | `app/lib/engagement-status.ts`, `tests/unit/engagement-status.test.ts` | Pure module mapping channel-specific backend statuses (email/letter/path-draft/path-step-run/path-enrollment/task) to the locked user-facing labels with chip tones. 10 unit tests. |
| Shared engagement orchestration helpers | Working | `app/lib/engagement-orchestration.ts`, `tests/unit/engagement-orchestration.test.ts` | Pure helpers for delay math (`addEngagementDuration`, `computeDelayScheduledFor`), communication-preference checks (`canContactConstituent`), and branch rule evaluation (`evaluateBranchRule`). 17 unit tests. Server engine still uses its private copies until cutover in a later Phase-3 pass. |
| Communications "Letters" tab → discovery card | Working | `app/communications/page.tsx` | Tab is now labeled "Letters & Printables ↗" and renders an explicit notice + link cards pointing to `/letters-printables` instead of duplicating queue UI. |
| Steward Paths shared status legend uses tone palette | Working | `app/automations/page.tsx` | Legend now sources `ENGAGEMENT_STATUS_LEGEND` and renders chips with tones from `getEngagementStatusChipClass`. |
| Steward Paths `SEND_EMAIL` UI label | Working | `app/automations/page.tsx`, `app/components/automations/NewAutomationModal.tsx`, `app/components/automations/AutomationWorkflowEditorModal.tsx` | Renamed from "Send email" to "Create review-required email" to match the actual draft-first behavior. Backend value `SEND_EMAIL` unchanged for backwards compatibility. |
| Canonical `/steward-paths` URL | Working | `app/steward-paths/page.tsx` | Thin Next.js redirect points to `/automations`. Establishes the canonical URL ahead of the Phase 4 visual builder; sidebar will be flipped when the new builder lands. |
| Steward Paths visual node-based builder | Working | `app/steward-paths/builder/page.tsx`, `app/components/steward-paths/*` | Real map builder is live with branch visuals, inspector editing, branch-aware persistence, and drag/drop behavior. |
| Steward Paths `BRANCH_PLACEHOLDER` execution | Working | `server/src/services/steward-paths-sequence-engine.ts` | Branch conditions execute with true/false order-index routing and runtime audit metadata. |
| Steward Paths `STATUS_CHANGE` execution | Working | `server/src/services/steward-paths-sequence-engine.ts` | Status-change steps now execute and persist supported field mutations with timeline/audit outputs. |
| Steward Paths `SEND_EMAIL` auto-send | Not Implemented | `server/src/services/steward-paths-sequence-engine.ts` | Routes through draft-first; auto-send remains gated by `email_auto_send` permission and intentionally not enabled. |
| Sequence engine cutover to shared helpers | Not Implemented | `server/src/services/steward-paths-sequence-engine.ts` | Engine still uses private `addDuration`. Cutover deferred until visual builder lands so the cutover and parity tests ship together. |
| Legacy `stewardPathsEngine.ts` retirement | Not Implemented | `server/src/services/stewardPathsEngine.ts`, `server/src/services/steward-paths-worker.ts` | Legacy and sequence engines coexist intentionally. |

## 2026-05-13 Donor Engagement Unified System Refactor — Phase 1 (audit + docs)

Status labels used in this section are restricted to:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

This pass is documentation-only. No application code, schema, or routes were changed. Phase 2 onward will land incrementally per `docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md`.

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Incremental workspace refactor permission | Working | `AGENTS.md` `incremental-workspace-refactor-rules` | New rule explicitly allows controlled, test-backed workspace refactors with backwards-compatibility safeguards. |
| Unified donor engagement refactor plan | Working | `docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md` | Documents current state, ownership boundaries, backwards-compatibility contract, phased plan, test plan, and risks. |
| Steward Paths visual node-based builder | Not Implemented | `app/automations/page.tsx`, no `app/components/steward-paths/` directory | Current page is structured-card automation list; visual builder skeleton planned in Phase 4. |
| Steward Paths `BRANCH_PLACEHOLDER` execution | Not Implemented | `server/src/services/steward-paths-sequence-engine.ts` | Step is skipped at runtime; planned for Phase 5. |
| Steward Paths `STATUS_CHANGE` execution | Not Implemented | `server/src/services/steward-paths-sequence-engine.ts` | Step is skipped at runtime; planned for Phase 5. |
| Steward Paths `SEND_EMAIL` auto-send | Not Implemented | `server/src/services/steward-paths-sequence-engine.ts` | Step routes through draft-first behavior; auto-send remains gated by `email_auto_send` permission and intentionally not enabled. |
| Letters tab inside Communications (overlap) | Partially Working | `app/communications/page.tsx` | Letters tab still rendered alongside email tabs; Phase 2 will replace with a discovery card linking to `/letters-printables`. |
| Letters & Printables print/mail workflows | Partially Working | `server/src/routes/letters.ts`, `app/components/letters/*` | Templates, generated, queue actions, batch, and letter→email-draft bridge are real; PDF export remains partial. |
| Communications email lifecycle | Partially Working | `app/communications/page.tsx`, `server/src/routes/email-campaigns.ts` | Campaign CRUD/scheduling/send/delivery events live; deeper log filtering and export remain partial. |
| Shared engagement status vocabulary surfaced in UI | Partially Working | `docs/DONOR_ENGAGEMENT_SYSTEM.md` | Vocabulary defined; not yet applied consistently across all channel chips — planned for Phase 2. |
| Legacy `stewardPathsEngine.ts` retirement | Not Implemented | `server/src/services/stewardPathsEngine.ts`, `server/src/services/steward-paths-worker.ts` | Legacy and sequence engines coexist intentionally; retirement is not started until Phase 3 confirms parity. |

## 2026-05-12 Readiness Audit Refresh

This file remains useful for feature context, but release-readiness authority is:
`docs/status/production-readiness-checklist.md`

Centralized status labels are locked to:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

Current release-gate snapshot from the 14-command audit run:

- Lint lane: Broken (`pnpm lint` exited 1 with 13 errors)
- Typecheck lane: Working (`pnpm typecheck`, `pnpm typecheck:web`, `pnpm typecheck:server` all exited 0)
- Smoke lane: Working (`pnpm test:smoke` 151 passed)
- E2E lane: Broken (`pnpm test:e2e`, `pnpm test:e2e:mobile`, `pnpm test:e2e:livecom` all exited 1)
- Test + coverage lane: Working (`pnpm test` and `pnpm test:coverage` exited 0)
- Build lane: Working (`pnpm build`, `pnpm build:server` exited 0)
- Prisma generation lane: Broken (`pnpm db:generate` exited 1 with Windows `EPERM` rename failure)
- Migration safety lane: Working (`pnpm db:verify:linux-casing` exited 0)

Dated evidence docs:

- `docs/status/readiness-audit-2026-05-12.md`
- `docs/status/testing-coverage-audit-2026-05-12.md`
- `docs/status/e2e-coverage-audit-2026-05-12.md`
- `docs/status/smoke-coverage-audit-2026-05-12.md`
- `docs/status/build-and-typecheck-audit-2026-05-12.md`

Do not use this file alone to declare production readiness.

## 2026-05-13 Full-App Testing Expansion Pass

Status labels used in this section are restricted to:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Testing command lanes (`unit`, `api`, `regression`, `ci`) | Working | `package.json` | Added dedicated scripts so test matrix is runnable by lane instead of one mixed command. |
| E2E contract reliability defaults | Working | `tests/e2e/ui-production-smoke.mjs`, `tests/e2e/livecom-ui-smoke.mjs`, `tests/e2e/mobile-readiness-audit.mjs` | Web base defaults now target `localhost:3000`; mobile login now uses API base `localhost:4000`. |
| Shared test helpers and fixtures | Working | `tests/helpers/auth.ts`, `tests/helpers/e2e-auth.mjs`, `tests/fixtures/*` | Added deterministic fixture data for importer and Watchdog testing flows. |
| API lane expansion | Partially Working | `tests/api/auth.api.test.ts`, `tests/api/watchdog.api.test.ts` | Auth and Watchdog safety checks added; module-wide API coverage remains partial. |
| E2E lane expansion | Partially Working | `tests/e2e/auth.e2e.mjs`, `tests/e2e/routes-smoke.mjs`, `tests/e2e/watchdog.e2e.mjs` | Added auth flow, multi-route smoke, and watchdog safety browser checks. |
| Full-app validation rerun evidence (2026-05-13) | Working | `docs/audits/full-app-testing-validation.md`, `docs/status/production-readiness-checklist.md` | Typecheck/smoke/unit/api/regression/test/coverage/build and `test:e2e` are now green in local rerun context; lint remains Broken and mobile audit remains Partially Working due warn-only findings. |
| Regression lane expansion | Partially Working | `tests/regression/e2e-contracts.test.ts` | Added guardrail tests for E2E base URL and auth contract; additional regression cases still pending. |
| Testing documentation set | Working | `docs/testing/*.md`, `docs/audits/full-app-testing-audit.md`, `docs/audits/full-app-testing-validation.md` | Added audit, runbook, coverage map, and validation artifacts for this expansion pass. |

## 2026-05-13 Steward Paths Canonicalization Pass

Status labels used in this section are restricted to:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Canonical saved visual paths workspace route | Working | `app/steward-paths/page.tsx`, `app/components/steward-paths/StewardPathsWorkspacePage.tsx` | `/steward-paths` now serves the canonical list + actions. |
| Legacy `/automations` deprecation redirect | Working | `app/automations/page.tsx` | Redirects users to `/steward-paths?deprecated=automations`. |
| Saved visual path action parity (enable/disable/share/test-run/duplicate/archive/history) | Working | `app/components/steward-paths/StewardPathsWorkspacePage.tsx`, `server/src/routes/steward-paths.ts` | Action panel now uses stewardship APIs instead of legacy-only controls. |
| Steward Paths API parity endpoints | Working | `server/src/routes/steward-paths.ts` | Added `PATCH /templates/:id/share`, `POST /templates/:id/duplicate`, `POST /templates/:id/test-run`, `GET /templates/:id/history`. |
| Legacy automation migration utility | Working | `server/src/routes/steward-paths.ts` | Added `POST /migrations/automations` import endpoint for staged deprecation flow. |
| Canonical builder/detail/history routes | Working | `app/steward-paths/builder/[id]/page.tsx`, `app/steward-paths/[id]/page.tsx`, `app/steward-paths/[id]/history/page.tsx` | Route structure now supports direct edit and history viewing by template id. |
| Inspector options parity for linked email/template controls | Partially Working | `app/components/steward-paths/NodeInspector.tsx` | Email node remains minimal and does not yet expose campaign/template linkage controls requested for full parity. |

## 2026-05-12 Donor Engagement Integration Pass

Status labels used in this section are restricted to:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Donor engagement architecture docs | Working | `docs/DONOR_ENGAGEMENT_SYSTEM.md`, `docs/DONOR_CRM_COMMUNICATIONS_AUDIT.md` | Shared tool relationships are now documented as one system. |
| Communications workspace as outreach hub | Partially Working | `app/communications/page.tsx` | New tabbed hub (overview/campaigns/drafts/letters/templates/segments/queue/log/settings) is live; deeper filters/export remain in progress. |
| Donation acknowledgment quick-action loop | Working | `app/components/donations/DonationTable.tsx`, `app/donations/page.tsx`, `server/src/routes/donations.ts` | Mark Thanked persists via API and donations now include a one-click Complete Loop action that orchestrates email draft, follow-up task, and steward path enrollment. |
| Constituent quick actions into engagement tools | Working | `app/constituents/[id]/page.tsx` | Added direct actions for communication, letters, paths, tasks, meetings. |
| Campaign quick actions into engagement workflows | Working | `app/campaigns/[id]/page.tsx` | Added campaign-level links for email campaign, appeal letter, follow-up path. |
| Email Builder campaign studio UX and donor block library | Partially Working | `app/components/email-builder/EmailBuilderApp.tsx`, `app/components/email-builder/BlockPalette.tsx`, `app/lib/email-builder-types.ts` | Workflow stage indicator, review checklist, grouped merge fields, canvas controls, and donor-specific blocks were added; reusable sections persistence and revision history remain not implemented. |
| Shared email subscription and unsubscribe compliance layer | Partially Working | `server/src/routes/email-preferences.ts`, `server/src/services/email-compliance.ts`, `docs/DONOR_CRM_EMAIL_COMPLIANCE.md` | Tokenized preferences/unsubscribe flows, suppression-aware eligibility checks, and donor profile preference controls are now wired; webhook ingestion and full cross-tool propagation remain in progress. |
| Steward Paths visual clarity upgrades | Partially Working | `app/automations/page.tsx` | Added shared status legend and sequence-node cards; full visual canvas builder remains in progress. |

## 2026-05-12 Donor Grants Research Workspace Pass

Status labels used in this section are restricted to:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Grants research-workspace reframing | Working | `app/grants/page.tsx`, `app/components/grants/GrantStats.tsx`, `app/components/grants/GrantsCommandPanel.tsx` | Primary grants language shifted from pipeline framing to research/deadline/writing workflows. |
| Grant case-file detail tabs | Working | `app/grants/[id]/page.tsx`, `app/components/grants/GrantCaseItemPanel.tsx` | Added dedicated requirements, reminders, tasks, resources, research, and decision views. |
| Grant case-file persistence APIs | Working | `server/src/routes/grants.ts` | Added workspace and grant-level case-item endpoints for reminder/task/resource/requirement records. |
| Grant-specific permissions | Working | `server/src/lib/permissions.ts`, `server/src/routes/grants.ts` | Added and enforced grants permission keys for viewing, editing, funders, deadlines, tasks, resources. |
| Donation separation for grants | Working | `app/grants/[id]/page.tsx`, `app/donations/new/page.tsx` | Award handoff now routes to Donations flow; grants do not auto-create donation ledger rows. |
| Grant calendar/reporting depth | Partially Working | `app/grants/page.tsx` | Deadline and task workspace tabs are live; dedicated calendar and deeper analytics remain in progress. |

## Audit Rules

This document treats a feature as complete only when it uses real data, saves correctly, handles error/empty/loading states, and supports the intended user workflow.

## Master Status Table

| Area | Feature | Status | Data Source | Notes | Next Step |
|---|---|---|---|---|---|
| Donor CRM | Dashboard cards + KPI summary | Working | Real API Data | `app/page.tsx` loads `/api/reports/summary` and `/api/reports/donor-retention`. | Add explicit loading/error UI for every widget card. |
| Donor CRM | Constituent list + search/filter | Working | Real API Data | `app/constituents/page.tsx` reads `/api/constituents` with query filters. | Add pagination + saved filters/segments. |
| Donor CRM | Constituent profile + notes + timeline | Working | Real API Data | `app/constituents/[id]/page.tsx` reads `/api/constituents/:id`; notes saved through `POST /api/constituents/:id/notes`. | Add richer timeline grouping and event filtering. |
| Donor CRM | Donations CRUD + donation import | Working | Real API Data | `app/donations/page.tsx`, `server/src/routes/donations.ts`, `/api/donations/import` are wired. | Add rollback support and receipt automation. |
| Donor CRM | Campaign management | Working | Real API Data | `app/campaigns/page.tsx` now links to `app/campaigns/[id]/page.tsx` for campaign info, full edit, recent donations, and delete workflows backed by `/api/campaigns` CRUD. | Add campaign attribution reporting from events + communications and multi-campaign comparison analytics. |
| Donor CRM | Grants research workspace | Partially Working | Real API Data | Grants route/module now supports case-file reminders/tasks/resources/requirements and donation handoff separation from grant records. | Add dedicated grant calendar view and expanded cross-grant workload/reporting surfaces. |
| Donor CRM | Tasks | Working | Real API Data | `app/tasks/page.tsx` is backed by `/api/tasks` CRUD. | Add task templates and bulk assignment from segment results. |
| Donor CRM | Communications campaign CRUD | Partially Working | Mixed Real/Demo Data | Email campaign records are persisted via `/api/email-campaigns`; delivery analytics are simulated in current flow. | Add provider webhook ingestion for delivery/open/click metrics and unsubscribe events. |
| Donor CRM | Letters & Printables workspace | Partially Working | Real API Data | `/api/letters` plus `/letters-printables` now support template CRUD, rich letter authoring, merge preview, single-letter generation, batch generation, print queue actions, mail queue actions, timeline logging, email draft creation, and persisted workflow policy settings via `/api/letters/workflow-settings`. | Wire true server-side PDF rendering/export and enforce workflow policy settings in queue execution lanes. |
| Donor CRM | Steward Paths (automation + sequence workflows) | Partially Working | Real API Data | Legacy `/api/automations` trigger/action rules remain active, and new sequence APIs at `/api/steward-paths` now support template steps, enrollments, timeline, draft email review, and due-step processing in the worker. | Add full sequence builder UI, branch/status-change execution, and retry/backoff operations tooling. |
| Donor CRM | Email/newsletter builder | Partially Working | Mixed Real/Demo Data | Builder stores structure/content in DB and now includes strict review checks for unknown/malformed merge tokens; advanced saved sections/history and provider validation lanes remain incomplete. | Add reusable sections, revision history, and delivery/timeline writeback per recipient. |
| Donor CRM | Reports | Working | Real API Data | `app/reports/page.tsx` now includes compact scope/tool switching, expanded module tools, filter controls, and admin operational reporting backed by `/api/reports/admin-summary`. | Add scheduled report delivery and server-side export jobs. |
| Donor CRM | Import wizard (constituents + donations) | Working | Real API Data | Import wizard posts to `/api/constituents/import`; donation wizard posts to `/api/donations/import`. | Add import history and rollback tooling. |
| Donor CRM | Merge workflow | Demo Only | Static Demo UI | `app/data-tools/merge/MergeWorkflow.tsx` is preview-first and not yet wired to merge endpoint writes. | Implement backend merge endpoint and explicit conflict resolution. |
| Donor CRM | Volunteers page | Partially Working | Real API Data | `app/volunteers/page.tsx` uses direct `fetch` to `/api/constituents?type=VOLUNTEER`; behavior differs from `apiFetch` helper pattern. | Switch to `apiFetch` and validate auth/session consistency. |
| Compassion CRM | Dashboard | Demo Only | Hardcoded Placeholder | `app/compassion/dashboard/page.tsx` uses static arrays and TODO markers for live API replacement. | Create Compassion API + schema and wire dashboard cards/charts. |
| Compassion CRM | Clients, cases, appointments, services, reports | Demo Only | Static Demo UI | Most `/app/compassion/*` routes render placeholder shells/coming soon pages only. | Build models and API routes, then replace placeholders incrementally. |
| Compassion CRM | Search/filtering + intake/import tools | Not Implemented | Unknown / Needs Verification | No Compassion-specific search endpoints or import routes found. | Add Compassion data tools and scoped filters after client/case schema launch. |
| Compassion CRM | Module permissions | Partially Working | Unknown / Needs Verification | `app/compassion/layout.tsx` includes TODO for workspace permission enforcement. | Add module-level authorization middleware and role checks. |
| Events CRM | Event registry + setup | Working | Real API Data | `app/events/list` + `app/events/dashboard` call events APIs in `server/src/routes/events.ts`. | Add visibility policy controls and registration publishing controls. |
| Events CRM | Orders + guests + tables + check-in | Working | Real API Data | `app/events/orders|guests|tables|check-in` are wired to DB-backed event endpoints. | Add reconciliation workflows for unlinked/duplicate guests. |
| Events CRM | Event reports + donor activity sync | Working | Real API Data | `/events/reports` uses `/api/events/reports/*`; event actions write `Activity` entries in `events.ts`. | Add sponsor, ticket-type, and export reporting slices. |
| Events CRM | Tickets, sponsors, communications, tasks, volunteers, files, settings | Demo Only | Static Demo UI | These routes use `app/components/events/EventsWorkspacePage.tsx` with static metrics/text only. | Build dedicated APIs and replace each scaffold with live data pages. |
| Events CRM | Public ticketing page + hosted checkout | Not Implemented | Unknown / Needs Verification | No public ticket storefront route/API is currently wired. | Implement event ticket type CRUD + public registration page generation. |
| OyamaWatchdog | Security feed + encrypted vault + admin controls | Partially Working | External DB + Real API Data | `/watchdog` module and `/api/watchdog/*` routes are scaffolded with encrypted secret storage and permission key checks. | Add full permission matrix UI, runbook actions, and production-ready health/alert wiring. |
| OyamaWebMaster | Website command center + site manager + builder shell | Partially Working | Real API Data + Builder Shell | `/webmaster` now includes persisted site metadata, type-based filtering, archive/restore/duplicate lifecycle APIs, quick page creation, and visual builder shell persistence via `/api/webmaster`. | Expand templates, CMS/forms, preflight checks, publish targets, version history, and rollback controls. |
| Platform | Authentication + session | Working | Real API Data | JWT auth, refresh, logout, and `/api/auth/me` are active. | Add MFA, session list, and revocation UI. |
| Platform | Users management | Working | Real API Data | Settings users page is wired to `/api/users` CRUD + password reset. | Add invite flow and user onboarding emails. |
| Platform | Audit logs | Working | Real API Data | Settings audit page reads `/api/audit-logs` with filter/pagination. | Add exports and saved filter presets. |
| Platform | Roles & scopes matrix | Demo Only | Hardcoded Placeholder | `app/settings/roles/page.tsx` currently presents static role content. | Build persisted role matrix editor + permission inheritance controls. |
| Platform | Payments portal | Demo Only | Mock Data | `app/components/payments/*` tabs are mock/simulated data with TODO comments. | Build `/api/payments/*` and provider integration flows. |
| Platform | Version/build/status visibility | Working | Real API Data | `/api/health`, settings system page, and system status show version/build metadata. | Add release notes/changelog UI and deployment history. |
| Growth Tools | Blog Builder | Not Implemented | Unknown / Needs Verification | No blog model/API/UI exists in app or server directories. | Implement blog module (editor, publish flow, public feed/post, embeds). |
| Growth Tools | Website Embed System | Not Implemented | Unknown / Needs Verification | No generic embed generator for widgets/forms/blog/events is present. | Build iframe/script/hosted embed pipeline with branding controls. |
| Growth Tools | Event Manager CRM expansion | Partially Working | Mixed Real/Demo Data | Core operations exist; ticketing/sponsor/public workflows are still scaffolded. | Prioritize ticket types, sponsor CRUD, and public event registration pages. |

## Real Data vs Demo Data Audit

### Donor CRM

- **Real data confirmed:** dashboard summaries/reports (`app/page.tsx` + `server/src/routes/reports.ts`), constituent CRUD and profile timeline (`app/constituents/*`, `server/src/routes/constituents.ts`), donation CRUD/import (`app/donations/page.tsx`, `server/src/routes/donations.ts`), campaign CRUD (`server/src/routes/campaigns.ts`), tasks (`server/src/routes/tasks.ts`), audit/users/settings routes.
- **Mixed/partial:** email campaigns are persisted but runtime delivery telemetry is incomplete; Steward Paths now includes both legacy automations and new sequence processing (`server/src/routes/automations.ts`, `server/src/routes/steward-paths.ts`, `server/src/services/stewardPathsEngine.ts`, `server/src/services/steward-paths-sequence-engine.ts`, `server/src/services/steward-paths-worker.ts`) and still needs retry/backoff and deeper operations tooling.
- **UI/demo-only:** merge workflow actions are still preview-focused without backend merge write (`app/data-tools/merge/MergeWorkflow.tsx`).

### Compassion CRM

- **Real data confirmed:** module shell/auth gate only (`app/compassion/layout.tsx`).
- **Placeholder/demo:** dashboard metrics/charts/schedules are hardcoded static datasets (`app/compassion/dashboard/page.tsx`).
- **UI-only routes:** clients/cases/appointments/reports/data-tools/settings paths are mostly placeholder pages under `app/compassion/*`.

### Events CRM

- **Real data confirmed:** event CRUD, orders, guests, tables, check-in, reports, and donor timeline sync (`server/src/routes/events.ts`; `app/events/orders`, `app/events/guests`, `app/events/tables`, `app/events/check-in`, `app/events/reports`).
- **Mixed:** dashboard/registry combine real API responses with static narrative/status cards (`app/events/dashboard/page.tsx`, `app/events/list/page.tsx`).
- **UI-only:** tickets/sponsors/communications/tasks/volunteers/files/settings/fundraising scaffolds are static workspace pages (`app/events/*/page.tsx` using `app/components/events/EventsWorkspacePage.tsx`).

### OyamaWatchdog

- **Real data confirmed:** module status, feed, and vault APIs are wired through `server/src/routes/watchdog.ts` and `server/src/services/watchdog-store.ts` (with external DB + encryption key requirements).
- **Partial:** dashboard actions and access matrix management are foundational; broader response workflows and automated alerting still need implementation.

### OyamaWebMaster

- **Real data confirmed:** persisted site/page records and site lifecycle APIs are active (`server/src/routes/webmaster.ts`, `server/src/services/webmaster-store.ts`).
- **Partially working:** dashboard site manager and visual builder shell are active (`app/webmaster/*`, `app/components/webmaster/WebmasterStarterDashboard.tsx`) with lifecycle actions and metadata visibility.
- **Not implemented:** production publish targets, rollback history/version table, and full preflight validation pipeline.

## Major Planned TODOs (Requested Additions)

1. **Blog Builder Tool (major tool):** blog editor, draft/publish, tags/categories, SEO fields, slug control, revisions, public feed/page, embed-safe styling, iframe/script embeds, RSS/sitemap support.
2. **Website Embed Tools:** reusable widget output for donation forms, newsletter signup, blog feed, event tickets, volunteer signup, contact/resource forms, appointment requests as iframe/script/hosted links.
3. **Event Manager CRM Expansion:** ticket types, public registration pages, sponsors, seating, QR check-in, walk-ins, badges, event communications, post-event donor follow-up.
4. **Data Mapping Import Tool Completion:** saved templates, duplicate detection and merge actions, import history, error reporting, rollback/safe review, support for donor/client/event/sponsor datasets.
5. **Email/Newsletter Builder Completion:** richer blocks/media support, merge fields, audience segments, scheduling, test sends, delivery/open/click metrics, profile history, unsubscribe compliance.
6. **Shared Constituent Timeline Completion:** donation, event attendance/orders, sponsorships, communications, tasks, imports, and Compassion interactions in one timeline model.
7. **Versioning + Production Readiness Visibility:** explicit app version/build/changelog page plus status labels showing complete/partial/demo-only features.

## Donor CRM Completion Plan (2026-05-10)

## DonorCRM Feature Key Registry (2026-05-12)

| Key | Status | Source Route Or API | Notes |
|---|---|---|---|
| donor.dashboard | Partially Working | `app/page.tsx` | Command-center triage widgets are improving; continue action-first workflow links. |
| donor.constituents | Working | `app/constituents/page.tsx` + `/api/constituents` | API-backed list/search/filter. |
| donor.constituentProfile | Working | `app/constituents/[id]/page.tsx` + `/api/constituents/:id` | Includes giving/tasks/timeline and letters panel hooks. |
| donor.donations | Working | `app/donations/page.tsx` + `/api/donations` | CRUD and stats endpoints live. |
| donor.campaigns | Working | `app/campaigns/*` + `/api/campaigns` | List/detail/edit workflows are API-backed. |
| donor.grants | Partially Working | `app/grants/*` + `/api/grants` | Research workspace + case-file APIs are live; calendar/reporting depth remains in progress. |
| donor.payments | Partially Working | `app/payments/page.tsx` | Ledger is live; processor tooling intentionally in development. |
| donor.tasks | Working | `app/tasks/page.tsx` + `/api/tasks` | Task CRUD and bulk assignment live. |
| donor.meetings | Working | `app/meetings/page.tsx` + `/api/meetings` | Scheduling and completion flows are live. |
| donor.communications | Partially Working | `app/communications/*` + `/api/email-campaigns` | Core persistence is live; delivery telemetry depth varies by provider setup. |
| donor.lettersPrintables | Partially Working | `app/letters-printables/*` + `/api/letters` | Single and batch generation plus print/mail queue workflows are functional; server-side PDF export remains partial. |
| donor.livecom | Working | `app/livecom/page.tsx` + `/api/livecom` | Interaction capture writes to timeline activity. |
| donor.stewardPaths | Partially Working | `app/automations/page.tsx`, `/api/automations`, `/api/steward-paths` | Legacy and sequence workflows run together; builder depth still growing. |
| donor.stewardSignals | Partially Working | `app/steward-signals/page.tsx` + `/api/steward-signals` | Suggestion-first insights; keep human review required. |
| donor.volunteers | Partially Working | `app/volunteers/page.tsx` | Real data list with auth-helper consistency gap. |
| donor.reports | Working | `app/reports/page.tsx` + `/api/reports/*` | Broad report coverage, admin operations summaries, and PDF packet print exports are available. |
| donor.dataTools | Partially Working | `app/data-tools/*` | Import/export/data-quality tooling is live; merge depth still in progress. |
| donor.customFields | Working | `app/custom-fields/page.tsx` + `/api/custom-fields` | Full CRUD for custom donor schema extensions. |

This plan targets donor-side partial features in delivery order and keeps campaign improvements as the first completed step.

### Step 0 (Started)

- Campaign detail and edit/remove completion:
	- Added dedicated campaign info route (`app/campaigns/[id]/page.tsx`).
	- Added list-to-detail navigation from campaign cards.
	- Added full campaign edit fields (name/category/goal/dates/description/active) and delete action in detail page.

### Step 1 (Next)

- Communications telemetry hardening:
	- Persist provider send lifecycle webhooks (delivered/open/click/bounce/unsubscribe).
	- Show campaign-level delivery diagnostics in communications workspace.

### Step 2

- Merge workflow completion:
	- Wire backend merge endpoint for constituent conflict resolution.
	- Replace preview-only merge actions with explicit write + audit events.

### Step 3

- Reports and export readiness:
	- Add permission-gated export endpoints and queued export jobs.
	- Add saved report presets and report freshness indicators.

### Step 4

- Task and stewardship acceleration:
	- Add task templates and segment-driven bulk task assignment.
	- Add stewardship template automation hooks and run diagnostics.

### Step 5

- Volunteer/auth consistency cleanup:
	- Move volunteer route calls to `apiFetch` pattern everywhere.
	- Validate auth/session behavior parity with donor pages.

## CRM Organization And Usability Audit (2026-05-10)

Audit objective: reduce duplicated paths, clarify module boundaries, and make unfinished surfaces visibly in development.

Completed in this pass:

- Added Event Workspace Selector route (`app/events/workspace/page.tsx`) as the clear event-first entry path.
- Rewired Events dashboard quick actions to event-scoped workflow entry instead of ambiguous global paths.
- Updated event overview quick actions to scoped routes (`/events/[eventId]/...`).
- Added compatibility warning banner for legacy global events tool routes in `app/events/layout.tsx`.
- Added explicit in-development warning banner to scaffolded Events workspace pages (`app/components/events/EventsWorkspacePage.tsx`).
- Simplified Apps launcher to core modules/shared workspaces and removed overlapping duplicate app tiles (`app/components/layout/AppsDrawer.tsx`).
- Reduced Settings sidebar overlap by removing duplicate/low-signal entries from primary navigation (`app/components/settings/SettingsSidebar.tsx`).
- Clarified StewardAI vs OGentic roles in workspace headers (`app/components/ai/StewardAIWorkspace.tsx`, `app/components/ogentic/OGenticWorkspace.tsx`).

Source-of-truth organization map:

- `docs/status/crm-organization-map.md`
