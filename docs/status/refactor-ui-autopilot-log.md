# Refactor UI Autopilot Log

## 2026-05-14 - Stage 1 Header Cleanup + Ribbon Standardization

Phase name:
- Phase 1 CRM-Wide Header Cleanup (initial high-impact slice)

Files changed:
- app/components/layout/WorkspaceBreadcrumbBar.tsx
- app/components/workspace-ribbon/WorkspaceRibbonFrame.tsx
- app/components/workspace-ribbon/WorkspaceWizard.tsx
- app/components/communications/CommunicationsWizardStep.tsx
- app/components/steward-paths/StewardPathsWorkspacePage.tsx
- app/tasks/page.tsx
- app/grants/page.tsx
- app/settings/page.tsx
- app/data-tools/page.tsx
- app/communications/page.tsx
- app/components/letters/LettersRibbonHome.tsx
- app/components/layout/TopBar.tsx
- AGENTS.md
- docs/status/features.md

Features completed:
- Added canonical compact breadcrumb header component for workspace pages.
- Migrated shared ribbon frame and wizard shell away from bulky title/subtitle cards.
- Replaced the Steward Paths "Saved Visual Paths" intro card with breadcrumb + ribbon controls.
- Migrated top-level headers to breadcrumb + ribbon on Tasks, Grants, Settings, and Data Tools.
- Added explicit breadcrumb/metadata wiring for Communications and Letters ribbon homes.
- Added explicit "Current Product Direction" rule block to AGENTS guidance.

Features removed:
- Removed bulky top title/action card from Steward Paths workspace.
- Removed bulky standalone top title blocks from Tasks, Grants, Settings, and Data Tools pages.

Tests run:
- pnpm typecheck:web (pass)
- pnpm typecheck:server (pass)

Remaining issues:
- Full CRM-wide header cleanup is not complete yet (additional routes still use legacy header/rail patterns).
- Tasks workspace still needs full board/calendar/detail drawer command-center completion.
- Communications and Letters guided workflows still need deeper persistence/validation completion in later phases.

Production-ready for this phase:
- Partially Working
- Notes: This stage is stable and type-safe for migrated pages, but full plan completion requires additional phases.

## 2026-05-14 - Stage 1 Extension (DonorCRM Core Workspaces)

Phase name:
- Phase 1 CRM-Wide Header Cleanup (core donor workspace extension)

Files changed:
- app/constituents/page.tsx
- app/campaigns/page.tsx
- app/donations/page.tsx
- docs/status/features.md
- docs/status/production-readiness-checklist.md

Features completed:
- Constituents workspace now uses compact breadcrumb + ribbon command groups instead of the large title/subtitle action row.
- Campaigns workspace now uses compact breadcrumb + ribbon command groups with create/view/scope actions.
- Donations workspace now uses compact breadcrumb + ribbon command groups with create/status/scope/filter controls.

Features removed:
- Removed legacy top title/subtitle action headers from Constituents, Campaigns, and Donations pages.

Tests run:
- pnpm typecheck:web (pass)
- get_errors on touched pages (pass)

Remaining issues:
- Additional CRM routes still need Phase 1 migration (reports, meetings, volunteers, quickbooks queue, edit/new detail pages).
- Tasks full command-center and calendar phases are still pending.
- Guided-flow completion phases (communications and letters) still need deeper end-to-end validation/persistence work.

Production-ready for this phase:
- Partially Working
- Notes: Core donor workspace header consistency improved; CRM-wide completion still pending.

## 2026-05-14 - Stage 1 Continuation (Secondary Workspace Surfaces)

Phase name:
- Phase 1 CRM-Wide Header Cleanup (secondary workspace pass)

Files changed:
- app/volunteers/page.tsx
- app/meetings/page.tsx
- app/quickbooks-sync/page.tsx
- app/reports/page.tsx
- docs/status/features.md
- docs/status/production-readiness-checklist.md

Features completed:
- Volunteers workspace moved to compact breadcrumb + ribbon entry controls.
- Meetings workspace moved to compact breadcrumb + ribbon entry controls.
- QuickBooks Sync workspace moved to compact breadcrumb + ribbon controls in both enabled and disabled plugin states.
- Reports command center moved from large title card to compact breadcrumb row while keeping command bar behavior intact.

Features removed:
- Removed legacy top title/subtitle action blocks in Volunteers, Meetings, QuickBooks Sync, and Reports.
- Removed duplicate QuickBooks tab-strip controls after ribbon queue controls became canonical.

Tests run:
- pnpm typecheck:web (pass)
- get_errors on touched pages (pass)

Remaining issues:
- Additional route surfaces still need header cleanup (`/donations/new`, `/donations/[id]/edit`, and other detail/edit pages).
- Phase 3+ canonical workflow cleanup is still pending in multiple modules.
- Tasks calendar and advanced command-center phases are still not implemented.

Production-ready for this phase:
- Partially Working
- Notes: Header/ribbon consistency improved across major workspaces, but full plan completion remains in progress.

## 2026-05-14 - Stage 1 Continuation (Donation Entry Surfaces)

Phase name:
- Phase 1 CRM-Wide Header Cleanup (donation create/edit alignment)

Files changed:
- app/donations/new/page.tsx
- app/donations/[id]/edit/page.tsx
- docs/status/features.md
- docs/status/production-readiness-checklist.md

Features completed:
- Donation create route now uses compact breadcrumb bar with contextual metadata and direct return action to donation ledger.
- Donation edit route now uses compact breadcrumb bar with contextual donor metadata and direct return action to donation ledger.

Features removed:
- Removed large standalone heading blocks from donation create/edit pages.

Tests run:
- pnpm typecheck:web (pass)
- get_errors on touched files (pass)

Remaining issues:
- Additional module pages still need ribbon-first header cleanup in later passes.
- Workflow completion phases (communications/letters/tasks calendar) still pending.

Production-ready for this phase:
- Partially Working
- Notes: Donation flow entry surfaces now match the workspace standard; broader plan phases remain active.

## 2026-05-14 - Stage 1 Continuation (Compassion Workspace Alignment)

Phase name:
- Phase 1 CRM-Wide Header Cleanup (Compassion pass)

Files changed:
- app/components/layout/WorkspaceBreadcrumbBar.tsx
- app/components/workspace-ribbon/WorkspaceRibbonButton.tsx
- app/compassion/clients/page.tsx
- app/compassion/cases/page.tsx
- app/compassion/follow-ups/page.tsx
- docs/status/features.md
- docs/status/production-readiness-checklist.md

Features completed:
- Added module-aware accent support to shared breadcrumb and ribbon button primitives.
- Migrated Compassion Clients, Cases, and Follow-ups pages to compact breadcrumb + ribbon controls using blue accent tone.

Features removed:
- Removed bulky icon/title/action header rows from Compassion Clients/Cases/Follow-ups pages.

Tests run:
- pnpm typecheck:web (pass)
- get_errors on touched files (pass)

Remaining issues:
- Compassion dashboard and client detail route still include large top header sections that need migration.
- Events workspace routes remain largely on legacy top-header patterns.
- Workflow-completion phases (communications/letters/tasks calendar) remain pending.

Production-ready for this phase:
- Partially Working
- Notes: Compassion list workspaces now follow ribbon-first standards with proper module color boundaries.

## 2026-05-14 - Stage 1 Continuation (Events Workspace Alignment)

Phase name:
- Phase 1 CRM-Wide Header Cleanup (events pass)

Files changed:
- app/components/layout/WorkspaceBreadcrumbBar.tsx
- app/components/workspace-ribbon/WorkspaceRibbonButton.tsx
- app/events/guests/page.tsx
- app/events/orders/page.tsx
- app/events/check-in/page.tsx
- docs/status/features.md
- docs/status/production-readiness-checklist.md

Features completed:
- Added amber accent tone support to shared breadcrumb/ribbon primitives for Events CRM pages.
- Migrated Events Guests, Orders, and Check-In pages to compact breadcrumb + ribbon command controls.

Features removed:
- Removed bulky top title/subtitle header blocks from Events Guests, Orders, and Check-In pages.

Tests run:
- pnpm typecheck:web (pass)
- get_errors on touched files (pass)

Remaining issues:
- Additional Events pages still need migration (tickets, tables, sponsors, event overview).
- Workflow-completion phases outside header cleanup are still pending.

Production-ready for this phase:
- Partially Working
- Notes: Events operational workspaces now follow the ribbon-first layout with module-appropriate styling.

## 2026-05-14 - Stage 1 Continuation (Events Management Surfaces)

Phase name:
- Phase 1 CRM-Wide Header Cleanup (events management extension)

Files changed:
- app/events/tickets/page.tsx
- app/events/tables/page.tsx
- app/events/sponsors/page.tsx
- docs/status/features.md
- docs/status/production-readiness-checklist.md

Features completed:
- Migrated Events Tickets, Tables, and Sponsors pages to compact breadcrumb + ribbon command controls.
- Removed duplicated top-level action rows where ribbon actions became canonical.

Features removed:
- Removed bulky top title/subtitle headers from Events Tickets, Tables, and Sponsors pages.
- Removed duplicate "Create Table" button row after ribbon migration.

Tests run:
- pnpm typecheck:web (pass)
- get_errors on touched files (pass)

Remaining issues:
- Events event-level overview routes still use legacy top-header patterns.
- Full workflow completion phases are still pending beyond header cleanup.

Production-ready for this phase:
- Partially Working
- Notes: Events management surfaces now mostly match ribbon-first layout; remaining event-level routes still need migration.

## 2026-05-14 - Stage 1 Continuation (Event Overview Route)

Phase name:
- Phase 1 CRM-Wide Header Cleanup (event detail overview)

Files changed:
- app/events/[eventId]/overview/page.tsx
- docs/status/features.md
- docs/status/production-readiness-checklist.md

Features completed:
- Migrated event-scoped overview route to compact breadcrumb + ribbon controls with direct operations/setup actions.

Features removed:
- Removed legacy event overview top title/subtitle header block.

Tests run:
- pnpm typecheck:web (pass)
- get_errors on touched file (pass)

Remaining issues:
- Additional event detail sub-routes may still need pass-by-pass migration.
- Non-header workflow phases still pending.

Production-ready for this phase:
- Partially Working
- Notes: Event overview now follows the same command-ribbon pattern as the other event workspaces.

## 2026-05-15 - Enterprise Chrome Foundation Pass

Phase name:
- CRM-wide enterprise chrome and dashboard layout foundation

Files changed:
- app/components/layout/TopBar.tsx
- app/components/layout/CrmSidebar.tsx
- app/components/layout/EnterprisePageShell.tsx
- app/components/workspace-ribbon/WorkspaceRibbon.tsx
- app/components/workspace-ribbon/WorkspaceRibbonButton.tsx
- app/components/workspace-ribbon/WorkspaceRibbonFrame.tsx
- app/components/dashboard/DashboardWidget.tsx
- app/page.tsx
- docs/status/refactor-ui-autopilot-log.md

Features completed:
- Restored the brand diagonal TopBar split as a restrained dark/light chrome element without the previous gradient/glow treatment.
- Reintroduced Apple-style glass treatment for TopBar search, workspace switcher, and icon controls.
- Quieted shared CRM sidebars by reducing rings, shadows, icon backgrounds, and card-like group treatment; active items now use a subtle background plus left accent bar.
- Added EnterprisePageShell as the shared page wrapper for consistent width, spacing, and content rhythm.
- Refined workspace ribbon styling into a compact Microsoft-style command bar and routed WorkspaceRibbonFrame through EnterprisePageShell.
- Expanded the built-in ribbon icon map so common commands no longer collapse to generic plus icons.
- Changed workspace ribbons to wrap/stack command groups instead of forcing horizontal scrolling.
- Reworked the DonorCRM dashboard example into breadcrumb/ribbon controls plus Overview, Stewardship, Intelligence, Giving Analytics, and Recent Activity sections.
- Increased dashboard widget padding, header height, and card breathing room.

Features removed:
- Removed TopBar reactive glow and heavy gradient treatment while preserving the diagonal brand split.
- Removed dashboard-level duplicate header controls that are now represented in the page ribbon.

Tests run:
- pnpm typecheck (pass)
- pnpm exec eslint app/page.tsx app/components/workspace-ribbon/WorkspaceRibbon.tsx app/components/workspace-ribbon/WorkspaceRibbonButton.tsx app/components/workspace-ribbon/WorkspaceRibbonGroup.tsx app/components/workspace-ribbon/WorkspaceRibbonFrame.tsx app/components/layout/EnterprisePageShell.tsx app/components/dashboard/DashboardWidget.tsx (pass)
- pnpm lint (fails on existing repo-wide lint backlog, including unrelated no-html-link-for-pages, hook-order, preserve-manual-memoization, prefer-const, and TopBar React Compiler warnings)
- Existing dev server detected at http://localhost:3000.

Remaining issues:
- Compassion, Events, HRM, Watchdog, Webmaster, and standalone app dashboards still need route-by-route adoption of EnterprisePageShell where their local shells diverge.
- TopBar still owns many behaviors in one component; visual chrome is calmer, but a future split into smaller client components would reduce maintenance risk.

Production-ready for this phase:
- Partially Working
- Notes: Shared chrome and the DonorCRM dashboard now establish the enterprise layout direction without changing data boundaries or removing working workflows.

## 2026-05-15 - Sidebar Compactness And Modular Dashboard Layout

Phase name:
- Sidebar maintainability and dashboard card layout controls

Files changed:
- app/components/layout/CrmSidebar.tsx
- app/components/dashboard/DashboardWidget.tsx
- app/components/dashboard/DashboardLayoutModal.tsx
- app/page.tsx
- docs/status/refactor-ui-autopilot-log.md

Features completed:
- Made the shared CRM sidebar more compact for at-a-glance scanning by tightening section spacing, row height, typography, and badge weight.
- Added a reusable custom sidebar scrollbar treatment to the shared sidebar scroll container.
- Consolidated sidebar active-accent styling into the variant style map instead of hard-coded inline variant checks.
- Added persisted dashboard widget size tokens: compact, standard, wide, and hero.
- Added edit-mode resize controls directly on dashboard cards.
- Added widget size controls to the Customize Layout modal.
- Updated dashboard grid sections to use modular 12-column spans driven by widget size instead of hard-coded one-off card spans.

Tests run:
- pnpm typecheck (pass)
- pnpm exec eslint app/page.tsx app/components/dashboard/DashboardWidget.tsx app/components/dashboard/DashboardLayoutModal.tsx app/components/layout/CrmSidebar.tsx (pass)

Remaining issues:
- Dashboard drag/drop remains section-aware through the current widget grouping; future work can add full freeform cross-section placement if staff need a canvas-style dashboard.
- Full repo lint remains blocked by existing unrelated lint backlog documented above.

Production-ready for this phase:
- Partially Working
- Notes: Sidebar rendering is cleaner and dashboard widgets are now modular, draggable, and resizable with persisted layout settings.

## 2026-05-15 - Donor Sidebar IA And Core Page Layout Pass

Phase name:
- DonorCRM navigation cleanup and core list workspace polish

Files changed:
- app/components/layout/sidebar-configs.tsx
- app/constituents/page.tsx
- app/donations/page.tsx
- app/campaigns/page.tsx
- docs/status/refactor-ui-autopilot-log.md

Features completed:
- Renamed the Donor sidebar System group to Settings & Tools.
- Moved Settings, Imports, Data Tools, and Custom Fields into the same Settings & Tools group.
- Removed Watchdog, Webmaster, and feedback-ticket links from the Donor sidebar.
- Migrated Constituents, Donations, and Campaigns to EnterprisePageShell with breadcrumb/ribbon header composition.
- Reworked the three core pages into clearer metric, filter, and content surfaces with more consistent borders, spacing, and shadows.

Tests run:
- pnpm typecheck (pass)
- pnpm exec eslint app/components/layout/sidebar-configs.tsx app/constituents/page.tsx app/donations/page.tsx app/campaigns/page.tsx (pass)

Remaining issues:
- Settings landing page should eventually reflect the "Settings & Tools" sidebar naming and surface Imports/Data Tools/Custom Fields as first-class settings tools.
- Table internals can still be refined in a future pass for denser enterprise scanning and sticky headers.

Production-ready for this phase:
- Partially Working
- Notes: Donor navigation is less cross-module cluttered and the core donor record pages now align with the enterprise shell direction.

## 2026-05-15 - DonorCRM Reports Tool Catalog

Phase name:
- Donor-owned reports navigation and template library

Files changed:
- app/components/donor-reports/donor-report-catalog.ts
- app/components/donor-reports/DonorReportsPage.tsx
- app/reports/donor-crm/page.tsx
- app/components/layout/sidebar-configs.tsx
- app/components/layout/AppShell.tsx
- app/lib/navigation-boundaries.ts
- app/page.tsx
- server/src/routes/search.ts
- docs/status/refactor-ui-autopilot-log.md

Features completed:
- Repointed the DonorCRM sidebar Reports item from the shared `/reports` hub to the DonorCRM-owned `/reports/donor-crm` workspace.
- Added a modular donor report catalog with 20 requested report templates across donor intelligence, giving, retention, campaign/fund, stewardship, pledge, and grant categories.
- Added a report library UI with category filtering, search, selected report details, icons, configuration inputs, and output-format planning.
- Kept live run/export/schedule actions disabled with an explicit backend-endpoint notice so the workspace does not pretend report jobs are complete.

Tests run:
- pnpm typecheck (pass)
- pnpm exec eslint app/components/donor-reports/donor-report-catalog.ts app/components/donor-reports/DonorReportsPage.tsx app/reports/donor-crm/page.tsx app/components/layout/sidebar-configs.tsx app/components/layout/AppShell.tsx app/lib/navigation-boundaries.ts app/page.tsx server/src/routes/search.ts (pass)

Remaining issues:
- Backend report execution, export jobs, and scheduling endpoints still need to be implemented before the disabled report actions can become active.

Production-ready for this phase:
- Partially Working
- Notes: Navigation and report template discovery are ready; live report generation remains a backend follow-up.

## 2026-05-15 - Fiscal Year Reporting Mode

Phase name:
- Fiscal-year-aware donor calculations and report mode toggle

Files changed:
- app/lib/fiscal-year.ts
- app/components/layout/TopBar.tsx
- app/page.tsx
- app/components/dashboard/GivingTrendChart.tsx
- app/donations/page.tsx
- app/settings/organization/page.tsx
- server/src/lib/dateRanges.ts
- server/src/routes/settings.ts
- server/src/routes/reports.ts
- server/src/routes/donations.ts
- docs/status/refactor-ui-autopilot-log.md

Features completed:
- Added shared fiscal-year helpers for fiscal start normalization, fiscal end calculation, current fiscal year labeling, and fiscal YTD ranges.
- Exposed fiscal year start and calculated fiscal year end in Organization Settings.
- Added an obvious DonorCRM TopBar Calendar/Fiscal mode toggle that persists locally and broadcasts reporting-mode changes.
- Updated dashboard summary, retention, and giving trend API calls to honor fiscal-year mode.
- Updated report API scope parsing so `dateBasis=fiscal` uses the organization fiscal-year start from settings.
- Updated donation list/stat default YTD mode to use fiscal YTD when the TopBar mode is fiscal and the page is still using its default YTD window.
- Updated constituent giving rollup recalculation to use the organization's fiscal year start for `totalYtdGiving`.

Tests run:
- pnpm typecheck (pass)
- pnpm exec eslint server/src/lib/dateRanges.ts server/src/routes/settings.ts server/src/routes/reports.ts server/src/routes/donations.ts app/lib/fiscal-year.ts app/page.tsx app/components/dashboard/GivingTrendChart.tsx app/donations/page.tsx app/settings/organization/page.tsx (pass)
- pnpm exec eslint app/components/layout/TopBar.tsx (fails on pre-existing React Compiler/manual memoization and unused-state warnings already present in this large component)

Remaining issues:
- The full TopBar component still needs a follow-up decomposition/refactor to clear existing React Compiler lint failures.
- Fiscal mode is currently a local user preference; persisting it as a per-user server preference can be added later if staff need cross-device consistency.

Production-ready for this phase:
- Partially Working
- Notes: Fiscal-year mode is wired through the primary donor dashboard and donation/report API calculations, with transparent remaining cleanup in TopBar lint debt.
