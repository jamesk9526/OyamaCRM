/** Smoke coverage for OyamaEmail standalone workspace route and source contracts. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("OyamaEmail workspace source contract", () => {
  it("keeps standalone OyamaEmail routes wired to the dedicated workspace", () => {
    const root = read("app/oyama-email/page.tsx");
    const templates = read("app/oyama-email/templates/page.tsx");
    const builder = read("app/oyama-email/templates/[templateId]/builder/page.tsx");
    const publish = read("app/oyama-email/templates/[templateId]/publish/page.tsx");
    const send = read("app/oyama-email/send/page.tsx");
    const campaigns = read("app/oyama-email/campaigns/page.tsx");
    const campaignsNew = read("app/oyama-email/campaigns/new/page.tsx");
    const campaignDetail = read("app/oyama-email/campaigns/[campaignId]/page.tsx");
    const audience = read("app/oyama-email/audience/page.tsx");
    const queue = read("app/oyama-email/queue/page.tsx");
    const analytics = read("app/oyama-email/analytics/page.tsx");
    const settings = read("app/oyama-email/settings/page.tsx");

    expect(root).toContain('view="templates"');
    expect(templates).toContain('view="templates"');
    expect(builder).toContain('view="builder"');
    expect(publish).toContain('view="publish"');
    expect(send).toContain('redirect("/oyama-email/campaigns/new")');
    expect(campaigns).toContain('view="campaigns"');
    expect(campaignsNew).toContain('view="campaigns"');
    expect(campaignDetail).toContain('view="campaigns"');
    expect(audience).toContain('redirect("/oyama-email/campaigns?tab=audience")');
    expect(queue).toContain('redirect("/oyama-email/campaigns?tab=queue")');
    expect(analytics).toContain('redirect("/oyama-email/campaigns?tab=analytics")');
    expect(settings).toContain('view="settings"');
  });

  it("keeps the workspace API-backed and includes core sidebar navigation actions", () => {
    const workspace = read("app/components/oyama-email/OyamaEmailWorkspace.tsx");

    expect(workspace).toContain("/api/email-campaigns?limit=100");
    expect(workspace).toContain("/api/email-campaigns/stats");
    expect(workspace).toContain("/api/email-campaigns/lists");
    expect(workspace).toContain("/api/constituents?limit=all");

    expect(workspace).toContain("Templates");
    expect(workspace).toContain("Campaigns");
    expect(workspace).toContain("Settings");
    expect(workspace).toContain("Back to CRM");

    expect(workspace).toContain("Overview");
    expect(workspace).toContain("Audience");
    expect(workspace).toContain("Queue");
    expect(workspace).toContain("Analytics");
    expect(workspace).toContain("Activity Log");
  });

  it("keeps legacy communications routes redirected into OyamaEmail", () => {
    const communicationsRoot = read("app/communications/page.tsx");
    const communicationsNew = read("app/communications/new/page.tsx");
    const communicationsTemplateLibrary = read("app/communications/library/templates/page.tsx");
    const communicationsCampaign = read("app/communications/[campaignId]/page.tsx");

    expect(communicationsRoot).toContain('redirect("/oyama-email/campaigns")');
    expect(communicationsNew).toContain('redirect("/oyama-email/campaigns/new")');
    expect(communicationsTemplateLibrary).toContain('redirect("/oyama-email/templates")');
    expect(communicationsCampaign).toContain("/oyama-email/campaigns/");
  });

  it("does not include fake/demo markers in the production OyamaEmail workspace source", () => {
    const workspace = read("app/components/oyama-email/OyamaEmailWorkspace.tsx").toLowerCase();

    expect(workspace).not.toContain("demo data");
    expect(workspace).not.toContain("sample recipients");
    expect(workspace).not.toContain("placeholder only");
    expect(workspace).not.toContain("fake stats");
    expect(workspace).not.toContain("fake recipients");
    expect(workspace).not.toContain("coming soon");
  });
});
