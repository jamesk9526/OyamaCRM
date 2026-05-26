# UI Refresh Readiness Report

Date: May 19, 2026

## Completed

- Shared workspace ribbons now use a green-accented Explorer-style command surface with only functional grouped commands, larger icon-first actions, and square control geometry. Nonfunctional static tabs were removed until they have real behavior.
- Shared `CRMActionBar` now uses the same Explorer-style command surface as `WorkspaceRibbon`, and the Constituents, Donations, Meetings, and Tasks command rows now use grouped ribbon commands instead of separate rounded toolbar treatments.
- Workspace-ribbon companion primitives (wizard shell, step indicator, project library, inspector drawer) now use the same square-edged green-accented treatment.
- Custom report ribbons outside the shared `WorkspaceRibbon` path (`ReportViewer`, OShareview reports command bar) were aligned to the same functional command-group style.
- Donor shell chrome now uses a pale green titlebar treatment and tinted navigation rail inspired by the reference app while preserving DonorCRM's green accent language.
- Shared CRM cards, action bars, filter bars, metric cards, quick action cards, data tables, page headers, and breadcrumb bars were tightened to flatter Explorer-like borders, compact gradients, and less rounded control styling.
- DonorCRM dashboard refreshed into the same desktop-workspace style with a compact title strip, dashboard filter bar, tighter KPI cards, a live priority inspector panel, and square-edged widget/edit controls.
- DonorCRM dashboard tools now use a compact filter bar limited to dashboard-local filters, chart focus, widget expansion, metric drill-ins, and refresh controls instead of a workspace ribbon or global navigation surface.
- DonorCRM dashboard graphics now use Recharts for the giving trend area chart, designation donut, giving-source bar chart, and retention radial gauge, with lightweight entrance and chart animations.
- Top bar interaction reliability pass completed: search keyboard handling now avoids editable fields, Escape closes active overlays, and top-bar panels now coordinate so overlapping tool sheets are reduced on mobile and desktop.
- Donor shell compact-desktop pass completed: at `1024-1439px`, donor shell now falls back from mega menu to sidebar navigation for clearer, denser small-laptop workflows.
- Donor Email Builder reliability pass completed: stable save callback wiring, unsaved-change guard before browser/tab close, and a direct desktop Review Checklist action to reduce workflow confusion.
- Donor Email Builder visual refresh pass completed: compact mockup-style top chrome, draft status strip, two-column block tiles, lighter preview canvas, simplified inspector tabs, and top-level Send Test wiring.
- Shared CRM UI primitives created.
- Dashboard metric card surface refreshed through existing `StatCard`.
- Dashboard command center softened.
- Constituents page first pass completed with shared action, metric, filter, table, and badge primitives.
- Constituent tags now show a calmer max-two display with `+N more`.
- Constituents row three-dot More menu is present alongside the visible Edit action.
- Donations page first pass completed with shared action, metric, filter, and table primitives.
- Donations row three-dot quick-actions menu remains intact.
- Meetings page first pass completed with shared action, metric, filter, badge, and empty-state primitives.
- Dashboard ribbon controls replaced with a single `CRMActionBar` while preserving existing section jumps, create routes, Steward prompts, refresh, edit layout, lock, and widget controls.
- Dashboard command controls now use `CRMFilterBar` instead of a workspace ribbon, keeping the top dashboard surface focused on range, campaign, refresh, and dashboard widget drill-ins.
- Dashboard quick action cards now use the shared `CRMQuickActionCard` pattern.
- Dashboard command center received a second polish pass with a reference-style greeting, KPI row, revenue pace card, priority action card, and compact quick actions.
- DonorCRM dashboard default landing view now uses the latest mockup-inspired SaaS grid with live KPI cards, giving overview, recent gifts, top campaigns, retention, due-soon tasks, and quick actions.
- Giving Trends fiscal-year mode now requests the configured fiscal year, compares against the prior fiscal year, and orders months from the fiscal start month.
- DonorCRM dashboard now includes a "Who Gave This Month" widget with a modal donor list, per-donor task creation, bulk follow-up task saving, saved email audience-list creation, and email template draft starters.
- Top bar refreshed with a light SaaS-style surface and a dark diagonal brand block using `oyama-darklogocrm.png`; Steward runtime status tokens remain readable.
- Workspace selector and DonorCRM mega menu now use dark surfaces with green active states.
- Donor sidebar grouping/style refreshed with a separate Home group and Core CRM group while preserving existing destinations.
- Tasks page now uses the shared action strip and `CRMDataTable` shell without replacing task complete/delete behavior.
- Letter builder scroll containment fixed so the builder header, side panels, floating command bar, canvas, and bottom status stay inside the document workspace instead of sliding under the global top bar.
- Letter builder insert/format bars received icons.
- Messenger panel refreshed with its own top bar, denser conversation surface, sender message editing, image attachments, and optional 2-day image auto-delete metadata.
- Messenger runtime uploads are ignored at `/public/uploads/messenger/`.
- Plan/checklist and component-system docs created.
- Oyama Reports app replaced the legacy `/reports` workspace with a dedicated reporting product surface: left category rail, searchable prebuilt report cards, live API report runner, Recharts-powered summaries, dense data grid, presentation summary, and guided Report Builder Lite.

## Not Yet Complete

- Donations row/status styling cleanup.
- Meetings row/card styling cleanup.
- Dashboard 1366x768 and 1280x720 browser screenshot verification.
- Full e2e/build verification.
- Reports app follow-up: saved views are browser-session only, PDF export uses browser print placeholder, letter-list handoff is placeholder-only, and event-scoped donor joins remain partial.

## Verification

Last known focused checks from this pass:

```bash
pnpm exec eslint app/components/workspace-ribbon/WorkspaceRibbon.tsx app/components/workspace-ribbon/WorkspaceRibbonGroup.tsx app/components/workspace-ribbon/WorkspaceRibbonButton.tsx app/components/workspace-ribbon/WorkspaceWizard.tsx app/components/workspace-ribbon/WorkspaceStepIndicator.tsx app/components/workspace-ribbon/WorkspaceProjectLibrary.tsx app/components/workspace-ribbon/WorkspaceInspectorDrawer.tsx app/components/dashboard/DonorDashboardVisualRefresh.tsx app/components/dashboard/DashboardWidget.tsx app/components/donor-reports/ReportViewer.tsx app/components/reports/ReportsCommandBar.tsx app/components/reports/ReportsModuleToolbar.tsx app/components/layout/WorkspaceBreadcrumbBar.tsx app/components/layout/CrmSidebar.tsx app/components/ui/crm/CRMCard.tsx app/components/ui/crm/CRMActionBar.tsx app/components/ui/crm/CRMFilterBar.tsx app/components/ui/crm/CRMMetricCard.tsx app/components/ui/crm/CRMDataTable.tsx app/components/ui/crm/CRMQuickActionCard.tsx app/components/ui/crm/CRMPageHeader.tsx
pnpm typecheck:web
pnpm typecheck:server
pnpm exec vitest run tests/smoke/crm-visual-refresh-source.test.ts tests/smoke/letter-builder-ui-source.test.ts
```

Current note: `pnpm typecheck:web` is blocked by an unrelated existing `app/components/email-builder/BlockEditor.tsx` `EmailBlock` inference error where a new block literal is typed as `type: string` instead of the `"text"` literal.

Build note: a prior sandboxed `npm run build` failed because Turbopack could not read `node_modules/.pnpm/remark-gfm@4.0.1/node_modules/remark-gfm/index.js` due to Windows access denied. The elevated rerun was declined, so build remains unverified in this pass.
