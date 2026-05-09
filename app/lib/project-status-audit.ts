/** Project status audit data backing the Settings -> Project Status page. */

export type ProjectStatusLabel =
  | "Complete"
  | "Working"
  | "Partial"
  | "UI Only"
  | "Placeholder Data"
  | "Broken"
  | "Not Started"
  | "Needs Review";

export type ProjectDataSourceLabel =
  | "Real Database Data"
  | "Real API Data"
  | "Mixed Real/Demo Data"
  | "Mock Data"
  | "Hardcoded Placeholder"
  | "Static Demo UI"
  | "Unknown / Needs Verification";

/** One audit row for the project status table. */
export interface ProjectStatusItem {
  area: string;
  feature: string;
  status: ProjectStatusLabel;
  dataSource: ProjectDataSourceLabel;
  notes: string;
  nextStep: string;
}

/** Last deep-audit date for this matrix. */
export const PROJECT_STATUS_AUDIT_DATE = "2026-05-09";

/** Evidence-backed cross-module status matrix for production-readiness work. */
export const PROJECT_STATUS_ITEMS: ProjectStatusItem[] = [
  {
    area: "Donor CRM",
    feature: "Dashboard cards and KPIs",
    status: "Working",
    dataSource: "Real API Data",
    notes: "Home dashboard loads /api/reports/summary and /api/reports/donor-retention in app/page.tsx.",
    nextStep: "Replace silent catch blocks with visible error states and freshness metadata.",
  },
  {
    area: "Donor CRM",
    feature: "Giving trend + recent/top donor widgets",
    status: "Working",
    dataSource: "Real API Data",
    notes: "Widgets consume report endpoints via apiFetch in dashboard components.",
    nextStep: "Add loading/empty/error consistency across all widget cards.",
  },
  {
    area: "Donor CRM",
    feature: "Constituent list + search/filter",
    status: "Working",
    dataSource: "Real API Data",
    notes: "Constituent page calls /api/constituents with live search/type/status filters.",
    nextStep: "Add server-side pagination and segment presets.",
  },
  {
    area: "Donor CRM",
    feature: "Constituent profile (giving/tasks/timeline/notes)",
    status: "Working",
    dataSource: "Real API Data",
    notes: "Profile page loads /api/constituents/:id with donations/tasks/activities + notes updates.",
    nextStep: "Add timeline event categorization and merge communication history.",
  },
  {
    area: "Donor CRM",
    feature: "Donations CRUD + import",
    status: "Working",
    dataSource: "Real API Data",
    notes: "Donations page + /api/donations and /api/donations/import are wired; import auto-links campaigns/designations.",
    nextStep: "Add rollback/undo for import batches and receipt generation.",
  },
  {
    area: "Donor CRM",
    feature: "Campaign management",
    status: "Working",
    dataSource: "Real API Data",
    notes: "Campaign cards use /api/campaigns create/update/delete with DB-backed totals.",
    nextStep: "Add campaign-to-event rollups and attribution reporting.",
  },
  {
    area: "Donor CRM",
    feature: "Task management",
    status: "Working",
    dataSource: "Real API Data",
    notes: "Tasks page uses /api/tasks for list/create/complete/delete.",
    nextStep: "Add template library and bulk task creation from segments.",
  },
  {
    area: "Donor CRM",
    feature: "Communications campaigns",
    status: "Partial",
    dataSource: "Mixed Real/Demo Data",
    notes: "Campaign CRUD and audience preview are real; delivery/open/click data is simulated in send flow.",
    nextStep: "Integrate provider webhooks for real delivery/open/click/unsubscribe telemetry.",
  },
  {
    area: "Donor CRM",
    feature: "Email/newsletter builder",
    status: "Partial",
    dataSource: "Mixed Real/Demo Data",
    notes: "Editor persists templateJson/body to /api/email-campaigns/:id, but media/video hosting and merge fields are incomplete.",
    nextStep: "Add media upload pipeline, merge fields, and timeline logging per recipient.",
  },
  {
    area: "Donor CRM",
    feature: "Automations",
    status: "Partial",
    dataSource: "Mixed Real/Demo Data",
    notes: "Automation records/actions are DB-backed, but /api/automations/:id/run only increments counters.",
    nextStep: "Build execution engine + run history + retry/failure handling.",
  },
  {
    area: "Donor CRM",
    feature: "Volunteers page",
    status: "Needs Review",
    dataSource: "Real API Data",
    notes: "Reads /api/constituents?type=VOLUNTEER via raw fetch in app/volunteers/page.tsx instead of apiFetch auth helper.",
    nextStep: "Move to apiFetch and validate auth/session behavior in production.",
  },
  {
    area: "Donor CRM",
    feature: "Import tools (constituent + donation)",
    status: "Working",
    dataSource: "Real API Data",
    notes: "Both wizards post to real endpoints; dry-run and mapping are implemented.",
    nextStep: "Add import history, rollback support, and merge endpoint wiring.",
  },
  {
    area: "Donor CRM",
    feature: "Merge workflow",
    status: "UI Only",
    dataSource: "Static Demo UI",
    notes: "Duplicate detection and side-by-side UI exist, but merge is preview-only in app/data-tools/merge/MergeWorkflow.tsx.",
    nextStep: "Implement POST /api/constituents/merge with explicit conflict resolution.",
  },
  {
    area: "Donor CRM",
    feature: "Reports page",
    status: "Working",
    dataSource: "Real API Data",
    notes: "Reports tab fetches summary/monthly/retention/top-donor/campaign endpoints and exports CSV client-side.",
    nextStep: "Add permission-scoped export endpoints and scheduled report delivery.",
  },
  {
    area: "Compassion CRM",
    feature: "Dashboard",
    status: "Placeholder Data",
    dataSource: "Hardcoded Placeholder",
    notes: "app/compassion/dashboard/page.tsx explicitly uses static arrays and TODO to replace with live API.",
    nextStep: "Create Compassion API + models, then wire dashboard cards/charts to real queries.",
  },
  {
    area: "Compassion CRM",
    feature: "Clients, cases, appointments, reports, tasks, settings",
    status: "UI Only",
    dataSource: "Static Demo UI",
    notes: "Most /compassion/* pages are ComingSoonBadge placeholders with no API calls.",
    nextStep: "Implement client/case schema and CRUD routes, then replace placeholder routes one-by-one.",
  },
  {
    area: "Compassion CRM",
    feature: "Workspace permission boundary",
    status: "Partial",
    dataSource: "Unknown / Needs Verification",
    notes: "Compassion layout is auth-gated but includes TODO for workspace permission enforcement.",
    nextStep: "Add workspace-aware authorization middleware and module-scoped RBAC checks.",
  },
  {
    area: "Events CRM",
    feature: "Event dashboard and registry",
    status: "Partial",
    dataSource: "Mixed Real/Demo Data",
    notes: "Summary/event list are API-backed, but several dashboard action cards/status chips are hardcoded narrative values.",
    nextStep: "Replace hardcoded queue/status cards with API-derived counters.",
  },
  {
    area: "Events CRM",
    feature: "Event CRUD and setup",
    status: "Working",
    dataSource: "Real API Data",
    notes: "/api/events create/update/list/detail are live and used by setup/registry pages.",
    nextStep: "Add event visibility/registration policy validation and owner assignment workflows.",
  },
  {
    area: "Events CRM",
    feature: "Orders + guests + check-in + tables",
    status: "Working",
    dataSource: "Real API Data",
    notes: "Orders/guests/tables/check-in pages call live /api/events endpoints and persist to EventOrder/EventGuest/EventTable.",
    nextStep: "Add optimistic error handling and guest merge/reconciliation workflows.",
  },
  {
    area: "Events CRM",
    feature: "Event reports",
    status: "Working",
    dataSource: "Real API Data",
    notes: "/events/reports reads /api/events/reports/summary and /api/events/:eventId/report from DB aggregates.",
    nextStep: "Add sponsor-level reporting and CSV/PDF export.",
  },
  {
    area: "Events CRM",
    feature: "Sponsors, tickets, communications, tasks, volunteers, files, settings pages",
    status: "UI Only",
    dataSource: "Static Demo UI",
    notes: "These routes are EventsWorkspacePage shells with static metrics/action text and no backing API reads.",
    nextStep: "Wire each page to dedicated endpoints starting with ticket types and sponsor management.",
  },
  {
    area: "Events CRM",
    feature: "Donor timeline sync from events",
    status: "Working",
    dataSource: "Real Database Data",
    notes: "events.ts logs EVENT_REGISTRATION/EVENT_ATTENDANCE activities on order creation, guest creation, and check-in.",
    nextStep: "Expose event timeline entries directly on constituent profile timeline filters.",
  },
  {
    area: "Core Platform",
    feature: "Authentication",
    status: "Working",
    dataSource: "Real API Data",
    notes: "JWT auth + refresh + logout + /me with protected routes mounted in server index.",
    nextStep: "Add MFA and session management UI.",
  },
  {
    area: "Core Platform",
    feature: "Users management",
    status: "Working",
    dataSource: "Real API Data",
    notes: "Settings Users UI calls /api/users CRUD + password reset + permission overrides.",
    nextStep: "Add invite-email onboarding flow and role audit snapshots.",
  },
  {
    area: "Core Platform",
    feature: "Audit log viewer",
    status: "Working",
    dataSource: "Real API Data",
    notes: "Settings Audit UI consumes /api/audit-logs with filters/pagination.",
    nextStep: "Expand entity filters and export capabilities for compliance.",
  },
  {
    area: "Core Platform",
    feature: "Roles & scopes settings page",
    status: "UI Only",
    dataSource: "Hardcoded Placeholder",
    notes: "settings/roles/page.tsx displays static role matrix; no persisted matrix editor.",
    nextStep: "Build editable role-permission matrix persisted in DB.",
  },
  {
    area: "Core Platform",
    feature: "Settings workspace sections",
    status: "UI Only",
    dataSource: "Static Demo UI",
    notes: "Branding/Workspaces/Donor/Compassion/Scheduling/Forms/Email/Integrations/Import-Export use SettingsPlaceholderPage.",
    nextStep: "Prioritize Workspaces + Integrations to remove placeholder-only admin paths.",
  },
  {
    area: "Core Platform",
    feature: "Payment Portal",
    status: "Placeholder Data",
    dataSource: "Mock Data",
    notes: "Processors, transaction log, payout settings, and webhook tabs rely on client-only mock/simulated data.",
    nextStep: "Create /api/payments endpoints and provider connection state model.",
  },
  {
    area: "Core Platform",
    feature: "Versioning and health visibility",
    status: "Working",
    dataSource: "Real API Data",
    notes: "/api/health and Settings System/System Status expose version/build metadata.",
    nextStep: "Add changelog surface and deployment history card.",
  },
  {
    area: "Growth Tools",
    feature: "Blog Builder",
    status: "Not Started",
    dataSource: "Unknown / Needs Verification",
    notes: "No blog models/routes/UI found in app or server.",
    nextStep: "Create blog schema + editor + public feed + embed delivery API.",
  },
  {
    area: "Growth Tools",
    feature: "Website Embed System",
    status: "Not Started",
    dataSource: "Unknown / Needs Verification",
    notes: "No generic widget/embed generator route exists.",
    nextStep: "Define embeddable widget framework (iframe/script/hosted links) with branding controls.",
  },
  {
    area: "Growth Tools",
    feature: "Event Manager CRM expansion (public tickets, sponsors, check-in suite)",
    status: "Partial",
    dataSource: "Mixed Real/Demo Data",
    notes: "Core event operations exist; ticket/sponsor/public registration/communications workflows remain shell-only.",
    nextStep: "Ship ticket type manager + sponsor CRUD + public registration pages first.",
  },
];
