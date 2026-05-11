/** Unit tests for shared navigation and route-boundary helpers. */

import { describe, expect, it } from "vitest";
import {
  filterAppsForRole,
  resolveTopBarModuleKey,
} from "@/app/lib/navigation-boundaries";
import {
  resolveLegacyGlobalEventsRedirect,
  resolveLegacyGlobalEventsTool,
} from "@/app/lib/events-route-boundaries";

describe("resolveTopBarModuleKey", () => {
  it("maps known module roots", () => {
    expect(resolveTopBarModuleKey("/")).toBe("donor");
    expect(resolveTopBarModuleKey("/compassion/dashboard")).toBe("compassion");
    expect(resolveTopBarModuleKey("/events/workspace")).toBe("events");
    expect(resolveTopBarModuleKey("/watchdog")).toBe("watchdog");
    expect(resolveTopBarModuleKey("/webmaster/pages")).toBe("webmaster");
    expect(resolveTopBarModuleKey("/ogentic")).toBe("donor");
    expect(resolveTopBarModuleKey("/reports")).toBe("reportit");
  });

  it("defaults unknown paths to donor module", () => {
    expect(resolveTopBarModuleKey("/unknown/path")).toBe("donor");
  });
});

describe("filterAppsForRole", () => {
  it("keeps admin-only apps hidden for non-admin roles", () => {
    const apps = [
      { id: "a" },
      { id: "b", adminOnly: true },
      { id: "c" },
    ];

    expect(filterAppsForRole(apps, "staff")).toEqual([{ id: "a" }, { id: "c" }]);
    expect(filterAppsForRole(apps, undefined)).toEqual([{ id: "a" }, { id: "c" }]);
  });

  it("keeps admin-only apps visible for admins", () => {
    const apps = [
      { id: "a" },
      { id: "b", adminOnly: true },
    ];

    expect(filterAppsForRole(apps, "admin")).toEqual(apps);
  });
});

describe("legacy events route redirects", () => {
  it("identifies legacy global event tool routes", () => {
    expect(resolveLegacyGlobalEventsTool("/events/check-in")).toBe("check-in");
    expect(resolveLegacyGlobalEventsTool("/events/reports")).toBeNull();
    expect(resolveLegacyGlobalEventsTool("/events/workspace")).toBeNull();
  });

  it("redirects legacy global routes to event-first selector with tool parameter", () => {
    const redirect = resolveLegacyGlobalEventsRedirect("/events/guests", new URLSearchParams());
    expect(redirect).toBe("/events/workspace?tool=guests");
  });

  it("preserves provided event context in redirect query", () => {
    const redirect = resolveLegacyGlobalEventsRedirect(
      "/events/tickets",
      new URLSearchParams("eventId=evt_123"),
    );

    expect(redirect).toBe("/events/workspace?tool=tickets&eventId=evt_123");
  });
});
