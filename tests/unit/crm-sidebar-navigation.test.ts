// Unit tests for shared CRM sidebar config, grouping, and active-route helpers.

import { describe, expect, it } from "vitest";
import { isSidebarItemActive, isSidebarItemVisible } from "@/app/components/layout/CrmSidebar";
import {
  buildDonorSidebarGroups,
  resolveActiveEventId,
  EVENTS_RESERVED_SEGMENTS,
} from "@/app/components/layout/sidebar-configs";

describe("Donor sidebar organization", () => {
  it("keeps Fundraising group focused on core records", () => {
    const groups = buildDonorSidebarGroups({ qbEnabled: false });
    const fundraising = groups.find((group) => group.id === "fundraising");

    expect(fundraising?.items.map((item) => item.label)).toEqual([
      "Dashboard",
      "Constituents",
      "Donations",
      "Campaigns",
      "Grants",
      "Payments",
    ]);
  });

  it("places Steward Paths above daily and supporting engagement tools", () => {
    const groups = buildDonorSidebarGroups({ qbEnabled: false });
    const engagement = groups.find((group) => group.id === "engagement-workspace");

    expect(engagement?.items[0]?.label).toBe("Steward Paths");
    expect(engagement?.items[0]?.badge).toBe("App");
  });

  it("keeps Letters and LiveCom in communication tools with useful badges", () => {
    const groups = buildDonorSidebarGroups({ qbEnabled: false });
    const communicationTools = groups.find((group) => group.id === "communication-tools");

    const letters = communicationTools?.items.find((item) => item.id === "letters-printables");
    const liveCom = communicationTools?.items.find((item) => item.id === "livecom");

    expect(letters?.badge).toBe("Tool");
    expect(letters?.description).toContain("thank-you letters");
    expect(liveCom?.badge).toBe("New");
  });

  it("moves Steward Signals under Insights and Volunteers under People and Service", () => {
    const groups = buildDonorSidebarGroups({ qbEnabled: false });
    const insights = groups.find((group) => group.id === "insights");
    const people = groups.find((group) => group.id === "people-service");

    expect(insights?.items.map((item) => item.label)).toContain("Steward Signals");
    expect(people?.items.map((item) => item.label)).toEqual(["Volunteers"]);
  });

  it("keeps System lower and explicitly collapsible", () => {
    const groups = buildDonorSidebarGroups({ qbEnabled: false });
    const system = groups.find((group) => group.id === "system");

    expect(system?.collapsible).toBe(true);
    expect(system?.defaultOpen).toBe(false);
  });
});

describe("Sidebar item helpers", () => {
  it("marks /automations as active for Steward Paths", () => {
    const item = {
      id: "steward-paths",
      label: "Steward Paths",
      href: "/automations",
      icon: null,
    };

    expect(isSidebarItemActive(item, "/automations", "")).toBe(true);
    expect(isSidebarItemActive(item, "/automations/123", "")).toBe(true);
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
