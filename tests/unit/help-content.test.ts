/** Unit tests for Help App scoping, search ranking, and route-context suggestion behavior. */

import { describe, expect, it } from "vitest";
import {
  buildHelpHref,
  getContextualHelpSuggestions,
  getHelpFilterMetadata,
  getRouteHelpContext,
  mapModuleKeyToHelpScope,
  parseHelpScope,
  searchHelpArticles,
} from "@/app/help-content";

describe("help scope helpers", () => {
  it("maps known module keys to crm help scopes", () => {
    expect(mapModuleKeyToHelpScope("donor")).toBe("donor");
    expect(mapModuleKeyToHelpScope("events")).toBe("events");
    expect(mapModuleKeyToHelpScope("compassion")).toBe("compassion");
    expect(mapModuleKeyToHelpScope("webmaster")).toBe("global");
  });

  it("parses scope safely with donor fallback", () => {
    expect(parseHelpScope("events")).toBe("events");
    expect(parseHelpScope("global")).toBe("global");
    expect(parseHelpScope("invalid-scope")).toBe("donor");
  });

  it("builds contextual help href with scope and route", () => {
    const href = buildHelpHref({ scope: "compassion", scopePath: "/compassion/appointments" });
    expect(href).toContain("/help?");
    expect(href).toContain("scope=compassion");
    expect(href).toContain("scopePath=%2Fcompassion%2Fappointments");
  });
});

describe("help search ranking", () => {
  it("prioritizes scoped guides ahead of global guides", () => {
    const donorResults = searchHelpArticles({
      query: "livecom setup",
      scope: "donor",
      limit: 10,
    });

    expect(donorResults.length).toBeGreaterThan(0);
    expect(donorResults[0].article.crmScope).toBe("donor");
  });

  it("returns events-focused results when searching in events scope", () => {
    const eventsResults = searchHelpArticles({
      query: "check in guest",
      scope: "events",
      limit: 10,
    });

    expect(eventsResults.length).toBeGreaterThan(0);
    expect(eventsResults[0].article.crmScope).toBe("events");
  });

  it("supports metadata filters for category and tag", () => {
    const filtered = searchHelpArticles({
      query: "",
      scope: "compassion",
      filters: {
        category: "Appointments",
        tag: "appointments",
      },
      limit: 10,
    });

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((result) => result.article.crmScope === "compassion" || result.article.crmScope === "global")).toBe(true);
    expect(filtered.some((result) => result.article.slug === "compassion-appointments-workspace")).toBe(true);
  });

  it("returns relevant results for minor typos and partial phrase input", () => {
    const typoResults = searchHelpArticles({
      query: "livcom setp",
      scope: "donor",
      limit: 10,
    });

    expect(typoResults.length).toBeGreaterThan(0);
    expect(typoResults.some((result) => result.article.slug === "donor-livecom-workspace")).toBe(true);
  });
});

describe("help route context", () => {
  it("resolves contextual rule for site embeds route", () => {
    const context = getRouteHelpContext("/settings/site-embeds");
    expect(context).not.toBeNull();
    expect(context?.tags).toContain("site-embeds");
  });

  it("returns contextual suggestions for appointments route", () => {
    const suggestions = getContextualHelpSuggestions({
      pathname: "/compassion/appointments",
      scope: "compassion",
      limit: 5,
    });

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((article) => article.slug === "compassion-appointments-workspace")).toBe(true);
  });

  it("returns stable filter metadata for scope", () => {
    const metadata = getHelpFilterMetadata("donor");
    expect(metadata.categories.length).toBeGreaterThan(0);
    expect(metadata.tags.length).toBeGreaterThan(0);
  });
});
