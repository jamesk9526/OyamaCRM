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
    const visualDashboard = read("app/components/dashboard/DonorDashboardVisualRefresh.tsx");
    const monthlyDonations = read("app/components/dashboard/MonthlyDonationsWidget.tsx");
    const statCard = read("app/components/dashboard/StatCard.tsx");
    const quickActionCard = read("app/components/ui/crm/CRMQuickActionCard.tsx");

    expect(page).toContain("DonorDashboardVisualRefresh");
    expect(page).toContain("useDashboardPageState");
    expect(page).toContain("EnterprisePageShell");
    expect(page).not.toContain("WorkspaceRibbonGroup");
    expect(dashboardState).toContain("/api/reports/summary");
    expect(dashboardState).toContain("/api/reports/donor-retention");
    expect(visualDashboard).toContain("DashboardMetricCard");
    expect(visualDashboard).toContain("Who Gave This Month");
    expect(visualDashboard).toContain("Giving by Designation");
    expect(visualDashboard).toContain("Giving by Source");
    expect(visualDashboard).toContain("Today At A Glance");
    expect(visualDashboard).toContain("Dashboard Tools");
    expect(monthlyDonations).toContain("/api/reports/donors-this-month");
    expect(monthlyDonations).toContain("/api/email-campaigns/lists");
    expect(monthlyDonations).toContain("Save task with selected donors");
    expect(statCard).toContain("CRMMetricCard");
    expect(quickActionCard).toContain("actionLabel");
  });

  it("applies the visual refresh to the shared shell without changing navigation ownership", () => {
    const topBar = read("app/components/layout/TopBar.tsx");
    const megaMenu = read("app/components/layout/DonorMegaMenu.tsx");
    const sidebar = read("app/components/layout/sidebar-configs.tsx");

    expect(topBar).toContain("bg-white/95");
    expect(topBar).toContain("resolveTopBarModuleKey");
    expect(topBar).toContain("getDonorAccentTheme");
    expect(topBar).toContain("Switch Workspace");
    expect(topBar).toContain("bg-slate-950/25");
    expect(topBar).toContain("Search constituents, campaigns, tools");
    expect(topBar).toContain('aria-label="Open command search"');
    expect(topBar).toContain("Command Search");
    expect(topBar).toContain("autoFocus wide");
    expect(megaMenu).toContain("LIGHT_ACCENT_THEMES");
    expect(megaMenu).toContain("bg-slate-950/25");
    expect(megaMenu).toContain("accentTheme.navActive");
    expect(sidebar).toContain('label: "Core CRM"');
    expect(sidebar).toContain('label: "Home"');
    expect(sidebar).toContain('label: "Constituents"');
    expect(sidebar).toContain('label: "Donations"');
  });

  it("applies the next visual pass to Constituents without removing existing behavior", () => {
    const page = read("app/constituents/page.tsx");
    const table = read("app/components/constituents/ConstituentTable.tsx");

    expect(page).toContain("apiFetch<ConstituentsPageResponse | ConstituentRow[]>");
    expect(page).toContain("CRMActionBar");
    expect(page).toContain("CRMMetricCard");
    expect(page).toContain("CRMFilterBar");
    expect(page).toContain("CRMDataTable");
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
    expect(page).toContain("WorkspaceRibbonGroup");
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
    expect(agents).toContain("Donor CRM Visual Refresh Rules");
  });
});
