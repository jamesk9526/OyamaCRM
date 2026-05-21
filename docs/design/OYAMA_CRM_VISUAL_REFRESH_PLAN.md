# OyamaCRM Visual Refresh Plan

Date started: May 19, 2026

## Intent

Use the provided screenshots as inspiration only. The refresh should keep current routes, API behavior, page permissions, existing actions, and working workflows intact while making Donor CRM screens calmer, cleaner, and more consistent.

## Design Direction

- Light CRM background: `#f8faf9` / slate-50 family.
- White cards with soft borders and subtle shadows.
- Green accent for primary actions, active navigation, and positive status.
- Deep slate primary text and muted gray secondary text.
- One clear page header, one clean action strip, one consistent metric-card style.
- Reduce heavy segmented toolbars, nested boxes, loud tags, and duplicate action paths.

## Implementation Phases

### Phase 1: Shared Theme Components

Goal: create reusable primitives without changing page behavior.

- [x] Create `app/components/ui/crm/CRMCard.tsx`.
- [x] Create `app/components/ui/crm/CRMPageHeader.tsx`.
- [x] Create `app/components/ui/crm/CRMMetricCard.tsx`.
- [x] Create `app/components/ui/crm/CRMActionBar.tsx`.
- [x] Create `app/components/ui/crm/CRMFilterBar.tsx`.
- [x] Create `app/components/ui/crm/CRMDataTable.tsx`.
- [x] Create `app/components/ui/crm/CRMStatusBadge.tsx`.
- [x] Create `app/components/ui/crm/CRMEmptyState.tsx`.
- [x] Create `app/components/ui/crm/CRMQuickActionCard.tsx`.
- [x] Add first visible usage by refreshing dashboard metric card styling.
- [x] Convert shared data-table patterns after reviewing Constituents and Donations table behavior.

### Phase 2: Dashboard Refresh

- [x] First pass: soften dashboard command center and metric cards without changing data loading or widget customization.
- [x] Replace heavy ribbon controls with a cleaner action strip where safe.
- [x] Add quick-action cards that match the target dashboard pattern.
- [x] Second pass: rebuild the dashboard command center into a calmer reference-style header, KPI row, revenue pace card, priority action card, and compact quick actions.
- [x] Fix Giving Trends fiscal-year comparison so fiscal mode requests the configured fiscal year and orders months from the fiscal start month.
- [ ] Verify dashboard at 1366x768 and 1280x720.

### Phase 3: Constituents Page

- [x] Preserve existing search/filter/table behavior.
- [x] Apply shared `CRMMetricCard`, `CRMActionBar`, `CRMFilterBar`, `CRMDataTable`, and `CRMStatusBadge` surfaces.
- [x] Calm tag display: max 2 visible tags plus `+N more`.
- [x] Move secondary row actions into a More menu only if no behavior is lost.

### Phase 4: Donations Page

- [x] Preserve donation data, filters, record gift flow, row three-dot quick-actions menu, and acknowledgment behavior.
- [x] Apply shared metric cards, action/filter strip, data-table shell, and badge system.
- [x] Make stewardship loop notice an insight card instead of a warning-style banner.
- [ ] Calm DonationTable row/status styling and keep row More menu intact.

### Phase 5: Meetings Page

- [x] Preserve meeting filters, schedule flow, and row/card actions.
- [x] Apply shared action bar, filter bar, metric cards, status badge, and empty state.
- [ ] Convert meeting rows into calmer structured cards if action handlers remain intact.

### Phase 6: Letters & Printables

- [x] First pass already moved builder toward the Notion-style editor: left insert rail, right format panel, floating command bar, no stacked toolbar rows.
- [x] Icons added to insert and format bars.
- [x] Contain builder scrolling so the editor header, panels, floating command bar, and bottom status do not collide with the global top bar.
- [ ] Continue production hardening for duplicate/archive/version history workflows.

### Phase 7: Reports, Steward, Settings

- [ ] Apply the same visual primitives after core CRM pages are stable.

## Non-Breaking Rules

- [x] Keep existing props wherever possible.
- [x] Add optional props rather than changing required contracts.
- [x] Do not change API contracts.
- [x] Do not remove actions unless they are clearly duplicate or dead.
- [x] Keep current test IDs and add new ones only as needed.
- [ ] Run full build/e2e after the environment can read all `node_modules` files without access-denied errors.

## First-Pass Checklist

Done:

- [x] Plan/checklist document created.
- [x] Shared CRM UI primitive components created.
- [x] Dashboard metric card styling refreshed through existing `StatCard` props.
- [x] Dashboard command center visual weight reduced.
- [x] Constituents page first pass completed with shared metrics/filter/table shells and calmer tags.
- [x] Constituents row three-dot menu restored/preserved.
- [x] Donations page first pass completed with shared metrics/action/filter/table shells while keeping the existing row three-dot quick-actions menu.
- [x] Meetings page first pass completed with shared metrics/action/filter/empty-state shells.
- [x] Dashboard heavy ribbon controls replaced with `CRMActionBar` while preserving routes and handlers.
- [x] Dashboard quick-action cards updated to the shared target card pattern.
- [x] Top bar refreshed to a light surface with dark text/icons, including Steward runtime status contrast.
- [x] Top bar updated with a dark diagonal brand block using `public/branding/oyama-darklogocrm.png`.
- [x] Workspace selector and DonorCRM mega menu updated to dark surfaces with green active states.
- [x] Sidebar grouping/style refreshed with Home and Core CRM grouping.
- [x] Shared data table adoption extended to Tasks after Constituents and Donations.
- [x] Letter builder scroll containment fixed after page-scroll QA.
- [x] Messenger panel refreshed with its own top bar, image attachment support, optional 2-day image expiry, and sender message editing.
- [x] AGENTS visual refresh guidance added.
- [x] Focused source smoke test added for shared primitives.
- [x] `pnpm typecheck:web` passed.
- [x] `pnpm typecheck:server` passed after messenger route updates.

Not Done:

- [ ] Donations row/status styling cleanup.
- [ ] Meetings row/card styling cleanup.
- [ ] Dashboard 1366x768 and 1280x720 browser screenshot verification.
- [ ] Full `npm run build` verification, blocked earlier by sandbox access denied on `node_modules/.pnpm/remark-gfm.../index.js`.
