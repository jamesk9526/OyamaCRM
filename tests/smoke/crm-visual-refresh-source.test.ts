/** Source-level smoke checks for the non-breaking Donor CRM visual refresh foundation. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("Donor CRM visual refresh foundation", () => {
  it("keeps shared CRM primitives available for phased page refreshes", () => {
    const files = [
      "app/components/ui/crm/CRMCard.tsx",
      "app/components/ui/crm/CRMPageHeader.tsx",
      "app/components/ui/crm/CRMMetricCard.tsx",
      "app/components/ui/crm/CRMActionBar.tsx",
      "app/components/ui/crm/CRMFilterBar.tsx",
      "app/components/ui/crm/CRMDataTable.tsx",
      "app/components/ui/crm/CRMStatusBadge.tsx",
      "app/components/ui/crm/CRMEmptyState.tsx",
      "app/components/ui/crm/CRMQuickActionCard.tsx",
    ];

    for (const file of files) {
      expect(read(file).length).toBeGreaterThan(200);
    }
  });

  it("keeps the dashboard refresh non-breaking by preserving existing dashboard entry points", () => {
    const page = read("app/page.tsx");
    const dashboardState = read("app/components/dashboard/useDashboardPageState.ts");
    const naturalDashboard = read("app/components/dashboard/NaturalisticDonorDashboard.tsx");
    const dashboardService = read("app/features/donor-dashboard/services/dashboard-client-service.ts");
    const dashboardTypes = read("app/features/donor-dashboard/types.ts");
    const dashboardConfig = read("app/components/dashboard/dashboardPageConfig.ts");
    const campaignGoalHealth = read("app/components/dashboard/CampaignGoalHealthWidget.tsx");
    const donationsPage = read("app/donations/page.tsx");
    const donationsRoute = read("server/src/routes/donations.ts");
    const monthlyDonations = read("app/components/dashboard/MonthlyDonationsWidget.tsx");
    const statCard = read("app/components/dashboard/StatCard.tsx");
    const quickActionCard = read("app/components/ui/crm/CRMQuickActionCard.tsx");

    expect(page).toContain("NaturalisticDonorDashboard");
    expect(page).toContain("useDashboardPageState");
    expect(page).not.toContain("WorkspaceRibbonGroup");
    expect(dashboardState).toContain("/api/reports/summary");
    expect(dashboardState).toContain("/api/reports/donor-retention");
    expect(naturalDashboard).toContain("loadDonorDashboardData");
    expect(naturalDashboard).toContain("setSuggestions(data.stewardshipAlerts)");
    expect(naturalDashboard).toContain("Recent Gifts");
    expect(naturalDashboard).toContain("Giving Overview");
    expect(naturalDashboard).toContain("Steward Recommendations");
    expect(naturalDashboard).toContain("Recent Activity");
    expect(naturalDashboard).toContain("Needs Attention");
    expect(naturalDashboard).toContain("Active Campaigns");
    expect(naturalDashboard).toContain("Dashboard quick actions");
    expect(naturalDashboard).toContain("xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.95fr)]");
    expect(naturalDashboard).toContain("sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]");
    expect(naturalDashboard).toContain("min-w-0");
    expect(naturalDashboard).toContain("sm:grid-cols-[auto_minmax(0,1fr)_auto]");
    expect(naturalDashboard).toContain("Calendar-year view");
    expect(naturalDashboard).toContain("Create Email");
    expect(naturalDashboard).toContain("Create Letter");
    expect(naturalDashboard).toContain("Overdue donor tasks");
    expect(naturalDashboard).not.toContain("2 emails failed to send");
    expect(naturalDashboard).not.toContain("Math.max(1, Math.round");
    expect(dashboardService).toContain("/api/reports/giving-trend");
    expect(dashboardService).toContain("/api/reports/designations-summary");
    expect(dashboardService).toContain("/api/settings/dashboard-appearance");
    expect(dashboardService).toContain("acknowledgment=pending");
    expect(naturalDashboard).toContain("pendingAcknowledgmentCount");
    expect(donationsPage).toContain('searchParams.get("acknowledgment")');
    expect(donationsRoute).toContain('acknowledgment === "pending"');
    expect(dashboardTypes).toContain("DashboardData");
    expect(dashboardConfig).toContain("DEFAULT_DASHBOARD_INSIGHT_WIDGETS");
    expect(dashboardConfig).toContain("DEFAULT_HIDDEN_WIDGETS");
    expect(dashboardConfig).toContain("DASHBOARD_WIDGET_DEFAULTS_VERSION");
    expect(campaignGoalHealth).toContain("No active campaign goal is set");
    expect(campaignGoalHealth).toContain("if (safeGoal === 0)");
    expect(monthlyDonations).toContain("/api/reports/donors-this-month");
    expect(monthlyDonations).toContain("/api/email-campaigns/lists");
    expect(monthlyDonations).toContain("Save task with selected donors");
    expect(monthlyDonations).toContain("This month's donor report could not be loaded.");
    expect(statCard).toContain("CRMMetricCard");
    expect(quickActionCard).toContain("actionLabel");
  });

  it("applies the visual refresh to the shared shell without changing navigation ownership", () => {
    const topBar = read("app/components/layout/TopBar.tsx");
    const megaMenu = read("app/components/layout/DonorMegaMenu.tsx");
    const sidebar = read("app/components/layout/sidebar-configs.tsx");
    const actionButton = read("app/components/ui/ActionButton.tsx");
    const ribbonButton = read("app/components/workspace-ribbon/WorkspaceRibbonButton.tsx");
    const globals = read("app/globals.css");

    expect(topBar).toContain("bg-white/98");
    expect(topBar).toContain("resolveTopBarModuleKey");
    expect(topBar).toContain("getDonorAccentTheme");
    expect(topBar).toContain("Switch Workspace");
    expect(topBar).toContain("bg-slate-950/25");
    expect(topBar).toContain("Search records, workflows, reports, and tools");
    expect(topBar).toContain('aria-label="Open command search"');
    expect(topBar).toContain("Command Search");
    expect(topBar).toContain("autoFocus wide");
    expect(topBar).toContain('bg-[#061a36]');
    expect(topBar).toContain("crm:toggle-donor-nav");
    expect(topBar).toContain('aria-haspopup="menu"');
    expect(topBar).toContain('aria-expanded={open}');
    expect(topBar).toContain('data-mobile-touch="true"');
    expect(topBar).toContain("min-[420px]:grid-cols-2");
    expect(actionButton).toContain('data-mobile-touch="true"');
    expect(actionButton).toContain("min-h-11");
    expect(actionButton).toContain("sm:whitespace-nowrap");
    expect(ribbonButton).toContain('data-mobile-touch="true"');
    expect(globals).toContain('[data-mobile-touch="true"]');
    expect(globals).toContain("min-height: 44px");
    expect(globals).toContain(".crm-card-surface");
    expect(globals).toContain(".crm-page-header-surface");
    expect(globals).toContain(".crm-filter-surface");
    expect(megaMenu).toContain("LIGHT_ACCENT_THEMES");
    expect(megaMenu).toContain("bg-slate-950/25");
    expect(megaMenu).toContain("accentTheme.navActive");
    expect(megaMenu).toContain('bg-[#0a2140]/[0.98]');
    expect(megaMenu).toContain("mobileNavOpen");
    expect(sidebar).toContain('label: "Overview"');
    expect(sidebar).toContain('label: "Donor Records"');
    expect(sidebar).toContain('label: "Constituents"');
    expect(sidebar).toContain('label: "Donations"');
  });

  it("uses a stable full-width Donor CRM bar at every breakpoint", () => {
    const appShell = read("app/components/layout/AppShell.tsx");
    const topBar = read("app/components/layout/TopBar.tsx");
    const megaMenu = read("app/components/layout/DonorMegaMenu.tsx");
    const globals = read("app/globals.css");

    expect(appShell).toContain("const donorMegaMenuEnabled = donorShellVisible");
    expect(appShell).not.toContain("MobileSidebarDrawer");
    expect(appShell).not.toContain('import Sidebar from "./Sidebar"');
    expect(appShell).toContain('const contentTopPaddingClass = donorShellVisible ? "pt-14 md:pt-26" : "pt-14"');
    expect(appShell).toContain("useBrowserLayoutEffect");
    expect(appShell).not.toContain('hidden h-full lg:flex');
    expect(topBar).toContain('xl:h-[72px]');
    expect(topBar).toContain("OyamaCRM v1.3 home");
    expect(topBar).toContain("Steward Workspace");
    expect(topBar).toContain("Quick Add");
    expect(topBar).toContain("lg:hidden");
    expect(megaMenu).toContain("top-14");
    expect(megaMenu).not.toContain("Use Sidebar");
    expect(globals).toContain("scrollbar-gutter: stable");
  });

  it("applies the next visual pass to Constituents without removing existing behavior", () => {
    const page = read("app/constituents/page.tsx");
    const table = read("app/components/constituents/ConstituentTable.tsx");

    expect(page).toContain("apiFetch<ConstituentsPageResponse | ConstituentRow[]>");
    expect(page).toContain("CRMActionBar");
    expect(page).toContain("CRMFilterBar");
    expect(page).toContain("CRMDataTable");
    expect(page).toContain("DirectoryViewCard");
    expect(page).toContain("interactive views, not duplicated dashboard metrics");
    expect(table).toContain("CRMStatusBadge");
    expect(table).toContain("+{hiddenCount} more");
    expect(table).toContain("ConstituentRowMoreMenu");
    expect(table).toContain("aria-label=\"Open constituent actions\"");
    expect(table).toContain("handleSort");
    expect(table).toContain("onDelete");
  });

  it("applies the next visual pass to Donations while preserving the row quick-actions menu", () => {
    const page = read("app/donations/page.tsx");
    const table = read("app/components/donations/DonationTable.tsx");

    expect(page).toContain("apiFetch<{ items?: DonationRow[]; total?: number }>");
    expect(page).toContain("CRMActionBar");
    expect(page).toContain("CRMMetricCard");
    expect(page).toContain("CRMFilterBar");
    expect(page).toContain("CRMDataTable");
    expect(table).toContain("RowQuickActionsMenu");
    expect(table).toContain("aria-label=\"Open donation quick actions\"");
    expect(table).toContain("Complete Loop");
    expect(table).toContain("Letter Template");
  });

  it("brings Campaigns into the donor workspace visual system without changing campaign actions", () => {
    const page = read("app/campaigns/page.tsx");
    const card = read("app/components/campaigns/CampaignCard.tsx");

    expect(page).toContain("Campaign command center");
    expect(page).toContain("Fundraising portfolio");
    expect(page).toContain("Campaign view");
    expect(page).toContain("CRMActionBar");
    expect(card).toContain("Goal reached — review next stewardship move.");
    expect(card).toContain("onDelete");
    expect(card).toContain("StewardContextButton");
  });

  it("applies the next visual pass to Meetings without replacing meeting behavior", () => {
    const page = read("app/meetings/page.tsx");

    expect(page).toContain("apiFetch<{ items?: Meeting[]; total?: number }>");
    expect(page).toContain("ScheduleMeetingModal");
    expect(page).toContain("MeetingCard");
    expect(page).toContain("CRMActionBar");
    expect(page).toContain("CRMMetricCard");
    expect(page).toContain("CRMFilterBar");
    expect(page).toContain("CRMEmptyState");
    expect(page).toContain("handleComplete");
    expect(page).toContain("handleCancel");
  });

  it("adopts shared action and data table primitives in Tasks without replacing task behavior", () => {
    const page = read("app/tasks/page.tsx");
    const table = read("app/components/tasks/TaskTable.tsx");

    expect(page).toContain("apiFetch<{ items?: Task[]; total?: number }>");
    expect(page).toContain("CRMActionBar");
    expect(page).toContain("WorkspaceBreadcrumbBar");
    expect(page).toContain("WorkspaceRibbonButton");
    expect(table).toContain("CRMDataTable");
    expect(table).toContain("CRMEmptyState");
    expect(table).toContain("onComplete");
    expect(table).toContain("onDelete");
  });

  it("documents the active checklist and non-breaking rules", () => {
    const plan = read("docs/design/OYAMA_CRM_VISUAL_REFRESH_PLAN.md");
    const agents = read("AGENTS.md");

    expect(plan).toContain("First-Pass Checklist");
    expect(plan).toContain("Not Done");
    expect(agents).toContain("OyamaCRM Agent Guide");
    expect(agents).toContain("Use real data and working actions");
  });

  it("keeps communication rendering ownership on the server instead of a competing browser layout", () => {
    const letters = read("app/components/letters/OyamaLettersWorkspace.tsx");
    const emailWorkspace = read("app/components/oyama-email/OyamaEmailWorkspace.tsx");
    const constituentRibbon = read("app/components/ui/crm/ribbon/config.ts");

    expect(letters).not.toContain("buildLetterPublishHtml");
    expect(letters).toContain('renderAuthority: "server-rendered production PDF"');
    expect(emailWorkspace).toContain('renderAuthority: "server email render service"');
    expect(constituentRibbon).toContain("Directory, segmentation, and relationship management");
    expect(constituentRibbon).not.toContain("4,163 total");
  });
});
