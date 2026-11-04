// Unit tests for shared CRM sidebar config, grouping, and active-route helpers.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isSidebarItemActive, isSidebarItemVisible } from "@/app/components/layout/CrmSidebar";
import {
  buildDonorSidebarGroups,
  buildDonorDailyNavigation,
  isDonorNavigationItemVisible,
  resolveDonorNavigationActiveItem,
  resolveActiveEventId,
  EVENTS_RESERVED_SEGMENTS,
} from "@/app/components/layout/sidebar-configs";

describe("Daily Donor navigation", () => {
  it("makes core workflows direct and preserves every specialist destination", () => {
    const groups = buildDonorDailyNavigation({ qbEnabled: true });
    expect(groups[0].items.map((item) => item.href)).toEqual(["/", "/constituents", "/donations", "/oyama-create/fundraising", "/events", "/tasks", "/reports", "/oyama-create", "/oyama-letters", "/oyama-email"]);
    const hrefs = groups.flatMap((group) => group.items.map((item) => item.href));
    for (const item of buildDonorSidebarGroups({ qbEnabled: true }).flatMap((group) => group.items)) {
      expect(hrefs).toContain(item.href);
    }
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(groups.slice(1).map((group) => group.label)).toEqual(["Fundraising", "Stewardship", "Administration"]);
    expect(groups.slice(1).every((group) => group.collapsible && !group.defaultOpen)).toBe(true);
  });

  it("selects the most specific route and respects segment boundaries", () => {
    const groups = buildDonorDailyNavigation({ qbEnabled: false });
    expect(resolveDonorNavigationActiveItem(groups, "/constituents/person/edit")).toBe("constituents");
    expect(resolveDonorNavigationActiveItem(groups, "/data-tools/import")).toBe("data-tools");
    expect(resolveDonorNavigationActiveItem(groups, "/data-tools")).toBe("data-tools");
    expect(resolveDonorNavigationActiveItem(groups, "/donations-other")).toBeUndefined();
    expect(groups.flatMap((group) => group.items).some((item) => item.id === "qb-sync")).toBe(false);
  });

  it("keeps configuration and data subtools in their owning workspaces", () => {
    const items = buildDonorDailyNavigation({ qbEnabled: false }).flatMap((group) => group.items);
    expect(items.filter((item) => item.href === "/settings")).toHaveLength(1);
    expect(items.filter((item) => item.href === "/data-tools")).toHaveLength(1);
    expect(items.some((item) => ["imports", "custom-fields", "notifications"].includes(item.id))).toBe(false);
  });

  it("honors effective permissions and role restrictions on both navigation surfaces", () => {
    const item = { id: "email", label: "Email", href: "/oyama-email", icon: null, permissions: ["view:communications"], hiddenForRoles: ["shareview"] };
    expect(isDonorNavigationItemVisible(item, null)).toBe(false);
    expect(isDonorNavigationItemVisible(item, { role: "staff", permissions: [] })).toBe(false);
    expect(isDonorNavigationItemVisible(item, { role: "staff", permissions: ["view:communications"] })).toBe(true);
    expect(isDonorNavigationItemVisible(item, { role: "shareview", permissions: ["view:communications"] })).toBe(false);
  });
});

describe("Donor sidebar organization", () => {
  it("keeps core record entries available across donor-record and fundraising groups", () => {
    const groups = buildDonorSidebarGroups({ qbEnabled: false });
    const donorRecords = groups.find((group) => group.id === "people-relationships");
    const fundraising = groups.find((group) => group.id === "fundraising");
    const labels = [
      ...(donorRecords?.items ?? []).map((item) => item.label),
      ...(fundraising?.items ?? []).map((item) => item.label),
    ];

    expect(labels).toContain("Constituents");
    expect(labels).toContain("Donations");
    expect(labels).toContain("Campaigns");
    expect(labels).toContain("Grants");
    expect(labels).toContain("Payments");
  });

  it("keeps Steward Paths in engagement with workspace badge and ahead of Events", () => {
    const groups = buildDonorSidebarGroups({ qbEnabled: false });
    const engagement = groups.find((group) => group.id === "engagement");
    const stewardPathsIndex = engagement?.items.findIndex((item) => item.id === "steward-paths") ?? -1;
    const eventsIndex = engagement?.items.findIndex((item) => item.id === "events") ?? -1;
    const stewardPaths = engagement?.items.find((item) => item.id === "steward-paths");

    expect(stewardPaths?.label).toBe("Steward Paths");
    expect(stewardPaths?.badge).toBe("App");
    expect(stewardPathsIndex).toBeGreaterThanOrEqual(0);
    expect(eventsIndex).toBeGreaterThanOrEqual(0);
    expect(stewardPathsIndex).toBeLessThan(eventsIndex);
  });

  it("keeps standalone Letters and Email alongside Create during the transition", () => {
    const groups = buildDonorSidebarGroups({ qbEnabled: false });
    const communicationTools = groups.find((group) => group.id === "engagement");

    const create = communicationTools?.items.find((item) => item.id === "oyama-create");
    const liveCom = communicationTools?.items.find((item) => item.id === "livecom");

    expect(create?.label).toBe("oyamaCreate");
    expect(create?.href).toBe("/oyama-create");
    expect(create?.kind).toBe("communication_tool");
    expect(create?.description).toContain("letters");
    expect(communicationTools?.items.slice(0, 3).map(item => item.href)).toEqual(["/oyama-create", "/oyama-letters", "/oyama-email"]);
    expect(liveCom?.badge).toBe("New");
  });

  it("routes retired Steward Signals links to the shared AI workspace and retains Volunteers", () => {
    const groups = buildDonorSidebarGroups({ qbEnabled: false });
    const donorRecords = groups.find((group) => group.id === "people-relationships");
    const engagement = groups.find((group) => group.id === "engagement");

    expect(donorRecords?.items.map((item) => item.label)).not.toContain("Steward Signals");
    expect(readFileSync("app/steward-signals/page.tsx", "utf8")).toContain('redirect("/steward-ai-workspace?prompt=Review%20donor%20follow-up%20priorities")');
    expect(engagement?.items.map((item) => item.label)).toContain("Volunteers");
  });

  it("keeps System lower and explicitly collapsible", () => {
    const groups = buildDonorSidebarGroups({ qbEnabled: false });
    const system = groups.find((group) => group.id === "system");

    expect(system?.collapsible).toBe(true);
    expect(system?.defaultOpen).toBe(false);
  });
});

describe("Sidebar item helpers", () => {
  it("marks /steward-paths as active for Steward Paths", () => {
    const item = {
      id: "steward-paths",
      label: "Steward Paths",
      href: "/steward-paths",
      icon: null,
    };

    expect(isSidebarItemActive(item, "/steward-paths", "")).toBe(true);
    expect(isSidebarItemActive(item, "/steward-paths/builder", "")).toBe(true);
    expect(isSidebarItemActive(item, "/tasks", "")).toBe(false);
  });

  it("hides role-restricted items for non-admin users", () => {
    const item = {
      id: "watchdog",
      label: "OyamaWatchdog",
      href: "/watchdog",
      icon: null,
      allowedRoles: ["admin"],
    };

    expect(isSidebarItemVisible(item, "admin")).toBe(true);
    expect(isSidebarItemVisible(item, "staff")).toBe(false);
  });
});

describe("Events sidebar event-id resolution", () => {
  it("respects explicit eventId query values", () => {
    const resolved = resolveActiveEventId("/events/workspace", new URLSearchParams("eventId=evt_123"));
    expect(resolved).toBe("evt_123");
  });

  it("does not treat reserved route segments as event ids", () => {
    for (const segment of EVENTS_RESERVED_SEGMENTS) {
      const resolved = resolveActiveEventId(`/events/${segment}`, new URLSearchParams());
      expect(resolved).toBeNull();
    }
  });

  it("resolves dynamic event workspace ids from path", () => {
    const resolved = resolveActiveEventId("/events/evt_778/overview", new URLSearchParams());
    expect(resolved).toBe("evt_778");
  });
});
