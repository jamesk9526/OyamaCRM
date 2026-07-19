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
    const callender = read("app/oyama-email/callender/page.tsx");
    const calendarAlias = read("app/oyama-email/calendar/page.tsx");
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
    expect(callender).toContain('view="callender"');
    expect(calendarAlias).toContain('redirect("/oyama-email/callender")');
    expect(campaignsNew).toContain('view="campaigns"');
    expect(campaignDetail).toContain('view="campaigns"');
    expect(audience).toContain('redirect("/oyama-email/campaigns?tab=audience")');
    expect(queue).toContain('view="queue"');
    expect(analytics).toContain('redirect("/oyama-email/campaigns?tab=analytics")');
    expect(settings).toContain('view="settings"');
  });

  it("keeps the workspace API-backed and includes core sidebar navigation actions", () => {
    const workspace = read("app/components/oyama-email/OyamaEmailWorkspace.tsx");
    const builder = read("app/components/oyama-email/OyamaEmailBuilderWorkspace.tsx");

    expect(workspace).toContain("/api/email-campaigns?limit=100");
    expect(workspace).toContain("/api/oyama-email/templates?limit=100");
    expect(workspace).toContain("/api/email-campaigns/stats");
    expect(workspace).toContain("/api/email-campaigns/lists");
    expect(workspace).toContain("/api/email-campaigns/calendar");
    expect(workspace).toContain("/api/email-campaigns/");
    expect(workspace).toContain("/validate");
    expect(workspace).toContain("/queue-control");
    expect(workspace).toContain("/api/constituents?limit=all");

    expect(workspace).toContain("Templates");
    expect(workspace).toContain("Campaign Workflow");
    expect(workspace).toContain("Email Queue");
    expect(workspace).toContain("Calendar");
    expect(workspace).toContain("Settings");
    expect(workspace).toContain("Docs & Walkthroughs");
    expect(workspace).toContain("How to build, review, and send email");
    expect(workspace).toContain("Before a production send");
    expect(workspace).toContain("Back to CRM");

    expect(workspace).toContain("Overview");
    expect(workspace).toContain("Audience");
    expect(workspace).toContain("Queue");
    expect(workspace).toContain("Analytics");
    expect(workspace).toContain("Activity Log");
    expect(workspace).toContain("Campaign Workflow");
    expect(workspace).toContain("Primary Next Step");
    expect(workspace).toContain("About This Flow");
    expect(workspace).toContain("Templates are reusable content. Campaigns are send records that lock the audience, review state, queue history, and delivery results for one outbound run.");
    expect(workspace).toContain("Choose Audience Source");
    expect(workspace).toContain("Test Recipient Email");
    expect(workspace).toContain("Schedule Campaign");
    expect(workspace).toContain("Send Test Email");
    expect(workspace).toContain("My Templates");
    expect(workspace).toContain("Shared Templates");
    expect(workspace).toContain("AI-assisted");
    expect(builder).toContain("Recipient Preview");
    expect(builder).toContain('href="/oyama-email/docs"');
    expect(builder).toContain("Edit plain-text override");
    expect(builder).not.toContain(">\n              Mobile\n");
    expect(builder).toContain("Recipient Email Preview");
    expect(builder).toContain("Open Advanced Editor");
    expect(builder).toContain("readinessPercent");
    expect(builder).toContain("Preflight clear");
    expect(builder).toContain("Select a block to edit");
    expect(builder).toContain("list-style-type: disc");
    expect(builder).toContain("list-style-type: decimal");
    expect(builder).toContain("display: list-item");
    expect(builder).toContain("imageWidthPercent");
    expect(builder).toContain("imageLinkUrl");
    expect(builder).toContain("Upload Image");
    expect(builder).toContain("Full Width");
    expect(builder).toContain("function UrlEditorDialog");
    expect(builder).not.toContain("window.prompt(");
    expect(builder).not.toContain("window.alert(");
    expect(builder).toContain("saveTemplate(false)");
    expect(builder).toContain("The draft could not be saved before the image upload.");
    expect(builder).toContain("Choose an image that is 5MB or smaller.");
    expect(builder).toContain("refreshServerPreview({ silent: false, templateId: previewTemplateId })");
    expect(workspace).toContain("TestSendDialog");
    expect(workspace).toContain("Resolve required compliance checks before marking this template Ready.");
    expect(workspace).not.toContain("window.prompt(\"Send test to email address:");
    expect(workspace).toContain('useState<"MINE" | "SHARED" | "ALL">("ALL")');
  });

  it("provides a canonical docs route with task-based email walkthroughs", () => {
    const docsRoute = read("app/oyama-email/docs/page.tsx");
    const types = read("app/components/oyama-email/types.ts");

    expect(docsRoute).toContain('view="docs"');
    expect(types).toContain('| "docs"');
  });

  it("uses one upload-or-URL control for image-capable email blocks", () => {
    const editor = read("app/components/email-builder/BlockEditor.tsx");

    expect(editor).toContain("function ImageSourceField");
    expect(editor).toContain("Upload to this template or paste a hosted image URL.");
    expect(editor).toContain('label="Story image"');
    expect(editor).toContain('label="Signature image"');
    expect(editor).toContain('label="Headshot"');
    expect(editor).toContain('label="Contact image"');
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

  it("shows durable OyamaLetters source context in campaign review", () => {
    const workspace = read("app/components/oyama-email/OyamaEmailWorkspace.tsx");
    const types = read("app/components/oyama-email/types.ts");
    const campaignRoutes = read("server/src/routes/email-campaigns.ts");

    expect(workspace).toContain("Created from OyamaLetters");
    expect(workspace).toContain("Return to Source Letter");
    expect(workspace).toContain("sourceGeneratedLetterId");
    expect(types).toContain("sourceGeneratedLetterId?: string | null");
    expect(campaignRoutes).toContain("sourceGeneratedLetterId: string | null");
  });

  it("supports donation multi-select temporary segments for email templates", () => {
    const donationsPage = read("app/donations/page.tsx");
    const workspace = read("app/components/oyama-email/OyamaEmailWorkspace.tsx");

    expect(donationsPage).toContain("Send To Email Workspace");
    expect(donationsPage).toContain("oyama-email:temporary-recipient-segment:");
    expect(donationsPage).toContain("/oyama-email/campaigns/new?temporarySegmentId=");
    expect(workspace).toContain("readTemporaryEmailSegment");
    expect(workspace).toContain("Temporary segment from selected donations");
    expect(workspace).toContain("not stored on the campaign for queueing or scheduling yet");
    expect(workspace).toContain("recipientEmails");
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
