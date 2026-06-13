import { describe, expect, it } from "vitest";
import {
  applyMergeTokens,
  createDefaultEmailTemplateDocument,
  normalizeEmailTemplateDocument,
  normalizeEmailTemplateSettings,
  renderEmailTemplateDocument,
} from "@/server/src/services/oyama-email/email-render-service";

describe("oyama email render service", () => {
  it("keeps default and empty documents blank instead of injecting starter copy", () => {
    const defaultTemplate = createDefaultEmailTemplateDocument();
    const emptyBlocksTemplate = normalizeEmailTemplateDocument({ blocks: [] });

    expect(JSON.stringify(defaultTemplate)).not.toContain("Your generosity makes practical care possible every day");
    expect(JSON.stringify(emptyBlocksTemplate)).not.toContain("Your generosity makes practical care possible every day");
    expect(defaultTemplate.blocks).toEqual([{ id: "block_1", type: "text", content: "" }]);
    expect(emptyBlocksTemplate.blocks).toEqual([{ id: "block_1", type: "text", content: "" }]);
  });

  it("uses saved plain text override when enabled", () => {
    const template = normalizeEmailTemplateDocument({
      blocks: [
        {
          id: "body",
          type: "text",
          content: "<p>Generated fallback body</p>",
        },
      ],
    });
    const settings = normalizeEmailTemplateSettings({
      enablePlainTextVersion: true,
      plainTextOverride: "Custom text-only body\n{{preferredName}}",
    });

    const rendered = renderEmailTemplateDocument(template, settings);

    expect(rendered.text).toBe("Custom text-only body\n{{preferredName}}");
  });

  it("wraps rendered emails with global organization header and footer", () => {
    const template = normalizeEmailTemplateDocument({
      blocks: [
        {
          id: "body",
          type: "text",
          content: "<p>Hello {{preferredName}}</p>",
        },
      ],
    });
    const settings = normalizeEmailTemplateSettings({
      includeUnsubscribeLink: true,
      enablePlainTextVersion: true,
    });

    const rendered = renderEmailTemplateDocument(template, settings, {
      organizationName: "Oyama Test Org",
      globalHeaderHtml: "<strong>Global Header</strong>",
      globalFooterHtml: "<span>Global Footer</span>",
      addressLine: "123 Main St",
    });

    expect(rendered.html).toContain("Global Header");
    expect(rendered.html).toContain("Hello {{preferredName}}");
    expect(rendered.html).toContain("Global Footer");
    expect(rendered.html).toContain("{{unsubscribeUrl}}");
  });

  it("converts legacy builder blocks into structured OyamaEmail HTML blocks", () => {
    const template = normalizeEmailTemplateDocument({
      blocks: [
        {
          id: "heading",
          type: "heading",
          eyebrow: "Impact",
          title: "A better update",
          subtitle: "Legacy heading content",
        },
        {
          id: "stats",
          type: "statistics",
          title: "This month",
          items: [
            { value: "42", label: "Families served", detail: "Across two programs" },
            { value: "$5k", label: "Raised" },
          ],
        },
        {
          id: "event",
          type: "eventDetails",
          title: "Gathering",
          eventDate: "{{eventDate}}",
          eventTime: "{{eventTime}}",
          eventLocation: "{{eventLocation}}",
        },
      ],
    });

    expect(template.blocks.every((block) => block.type === "html")).toBe(true);

    const rendered = renderEmailTemplateDocument(template, normalizeEmailTemplateSettings({}));
    expect(rendered.html).toContain("A better update");
    expect(rendered.html).toContain("Families served");
    expect(rendered.html).toContain("Across two programs");
    expect(rendered.html).toContain("{{eventDate}}");
  });

  it("resolves compatibility merge aliases to canonical values", () => {
    const output = applyMergeTokens(
      "{{eventDate}} {{eventTime}} {{eventLocation}} {{donor.preferredName}}",
      {
        "event.startDate": "April 20, 2025",
        "event.time": "6:00 PM",
        "event.location": "Main Hall",
        preferredName: "Jordan",
      },
    );

    expect(output).toBe("April 20, 2025 6:00 PM Main Hall Jordan");
  });

  it("resolves simple brace and slash merge aliases", () => {
    const output = applyMergeTokens(
      "Hi {first} {last}, your //amount gift on {giftDate} matters.",
      {
        firstName: "Ava",
        lastName: "Donor",
        donationAmount: "$42.00",
        "gift.date": "June 13, 2026",
      },
    );

    expect(output).toBe("Hi Ava Donor, your $42.00 gift on June 13, 2026 matters.");
  });
});
