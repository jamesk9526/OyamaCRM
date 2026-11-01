import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/app/lib/auth-client";
import { loadDonorDashboardData, loadDonorDashboardCoreMetrics } from "@/app/features/donor-dashboard/services/dashboard-client-service";
import { buildStewardshipSuggestions, resolveDashboardRevenueGoal } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";
import type { DonorDashboardSummary } from "@/app/features/donor-dashboard/types";

vi.mock("@/app/lib/auth-client", () => ({ apiFetch: vi.fn() }));
const summary = { overdueTasks: 0, pendingTasks: 0, newDonorsThisMonth: 0 } as DonorDashboardSummary;

describe("daily donor dashboard data", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url.includes("acknowledgment=pending")) return { total: 17 };
      if (url.startsWith("/api/donations")) return { items: [{ id: "gift-real", amount: "125.25" }] };
      if (url.startsWith("/api/campaigns")) return { items: [{ id: "campaign-real", active: true, totalRaised: "500.00" }] };
      return {};
    });
  });

  it("uses server totals for acknowledgments instead of the number of preview gifts", async () => {
    const data = await loadDonorDashboardData({ reportingYearMode: "fiscal" });
    expect(data.pendingAcknowledgmentCount).toBe(17);
    expect(data.recentDonations).toHaveLength(1);
    expect(data.campaigns[0].id).toBe("campaign-real");
    expect(vi.mocked(apiFetch).mock.calls.some(([url]) => url.includes("scope=ALL_YEARS"))).toBe(true);
    expect(data.errors).toEqual([]);
  });

  it("preserves working gifts and identifies unavailable acknowledgment data", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url.includes("acknowledgment=pending")) throw new Error("Temporarily unavailable");
      if (url.startsWith("/api/donations")) return [{ id: "gift-real", amount: 25 }];
      return {};
    });
    const data = await loadDonorDashboardData({ reportingYearMode: "calendar" });
    expect(data.recentDonations[0].id).toBe("gift-real");
    expect(data.errors).toEqual(["Pending acknowledgments: Temporarily unavailable"]);
  });

  it("preserves monthly comparison, gift counts, and partial-period metadata", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => url.startsWith("/api/reports/giving-trend") ? {
      points: [{ month: "2026-10", label: "Oct", amount: "125.25", previousAmount: "100.10", giftCount: 3, isPartial: true }],
      total: "125.25", comparisonTotal: "100.10", trendPercent: 25, giftCount: 3,
    } : {});
    const data = await loadDonorDashboardData({ reportingYearMode: "calendar" });
    expect(data.trendComparisonTotal).toBe(100.1);
    expect(data.trendPoints[0]).toMatchObject({ month: "2026-10", amount: 125.25, previousAmount: 100.1, giftCount: 3, isPartial: true });
  });

  it("keeps an absent prior-year baseline unknown instead of treating it as zero", async () => {
    const data = await loadDonorDashboardData({ reportingYearMode: "calendar" });
    expect(data.trendComparisonTotal).toBeNull();
  });

  it("does not classify a partial-year retention rate against an invented target", () => {
    const suggestions = buildStewardshipSuggestions(summary, { total: 100, retained: 90, rate: 90 });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ count: 10, urgency: "medium", action: { href: "/reports?report=lapsed-donors" } });
    expect(suggestions[0].description).toContain("seasonal");
    expect(buildStewardshipSuggestions(summary, { total: 0, retained: 0, rate: 0 })).toEqual([]);
  });
});


describe("dashboard partial core failures", () => {
  it("keeps summary metrics available when retention fails", async () => {
    vi.mocked(apiFetch).mockImplementation(async url => {
      if (url.startsWith("/api/reports/donor-retention")) throw new Error("Retention offline");
      return { ytdAmount: 125 };
    });
    const result = await loadDonorDashboardCoreMetrics("fiscal");
    expect(result.summary?.ytdAmount).toBe(125);
    expect(result.retention).toBeNull();
    expect(result.errors).toEqual(["Donor retention: Retention offline"]);
  });
  it("keeps retention available when summary fails", async () => {
    vi.mocked(apiFetch).mockImplementation(async url => {
      if (url.startsWith("/api/reports/summary")) throw new Error("Summary offline");
      return { total: 10, retained: 4, rate: 40 };
    });
    const result = await loadDonorDashboardCoreMetrics("calendar");
    expect(result.summary).toBeNull();
    expect(result.retention?.retained).toBe(4);
    expect(result.errors).toEqual(["Summary metrics: Summary offline"]);
  });
});

it("uses configured revenue goals without fabricating a minimum", () => {
  expect(resolveDashboardRevenueGoal("AUTO", 1000, 0)).toBe(0);
  expect(resolveDashboardRevenueGoal("AUTO", 1000, 50)).toBe(50);
  expect(resolveDashboardRevenueGoal("MANUAL", 500, 1000)).toBe(500);
  expect(resolveDashboardRevenueGoal("MANUAL", -5, 1000)).toBe(0);
});
