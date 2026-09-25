# Donor dashboard cleanup TODOs

The mounted home route is `app/page.tsx` → `NaturalisticDonorDashboard.tsx`. Its detailed-insights drawer still uses `DashboardWidgetRenderer`, `DashboardLayoutModal`, `useDashboardPageState`, and the widget catalog. Preserve those paths while cleaning up older code.

- [ ] Inventory every file under `app/components/dashboard/` against route imports and the widget ID registry. Remove components with no runtime or test consumer only after confirming import aliases and dynamic references.
- [ ] Split the large dashboard home component into the header, priorities, and overview sections while keeping current data ownership and saved widget preferences intact.
- [ ] Reconcile the repeated attention, focus, and at-a-glance metrics into one presentation model so the same queue is not described with conflicting counts.
- [ ] Replace legacy browser-local dashboard layout settings with a documented preference owner, or explicitly keep them as per-browser settings in the UI.
- [ ] Audit widget actions and drill-ins for real destinations; remove unsupported controls and update the widget registry together with saved-layout migration.
- [ ] Run authenticated desktop/mobile, keyboard, empty/error, and data refresh checks before deleting compatibility code.

This list is an inventory and follow-up plan, not a claim that mounted widget components are dead code.
