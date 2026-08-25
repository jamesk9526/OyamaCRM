import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("dashboard UI density", () => {
  it("keeps detailed widgets behind an accessible disclosure", () => {
    const page = read("app/page.tsx");

    expect(page).toContain("More dashboard tools");
    expect(page).toContain('aria-controls="dashboard-detailed-insights"');
    expect(page).toContain("showInsights ?");
    expect(page).toContain("Hide details");
  });

  it("does not render outgoing and incoming routes at the same time", () => {
    const shell = read("app/components/layout/AppShell.tsx");
    const animations = read("app/globals-animations.css");

    expect(shell).toContain("{children}");
    expect(shell).not.toContain("displayedRouteContent");
    expect(shell).not.toContain("incomingRouteContent");
    expect(animations).toContain(".crm-route-content");
    expect(animations).not.toContain(".crm-route-transition-pane-out");
  });
});
