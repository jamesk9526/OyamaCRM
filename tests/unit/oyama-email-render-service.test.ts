import { describe, expect, it } from "vitest";
import {
  applyMergeTokens,
  createDefaultEmailTemplateDocument,
  htmlToPlainText,
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

  it("renders email-safe list markers and readable plain-text lists", () => {
    const template = normalizeEmailTemplateDocument({
      blocks: [
        {
          id: "body",
          type: "text",
          content: '<p>Ways to help:</p><ul><li>Volunteer</li><li>Share</li></ul><ol start="3"><li>Register</li><li>Attend</li></ol>',
        },
      ],
    });
    const settings = normalizeEmailTemplateSettings({
      enablePlainTextVersion: true,
      includeUnsubscribeLink: false,
    });

    const rendered = renderEmailTemplateDocument(template, settings);

    expect(rendered.html).toContain("list-style-type:disc");
    expect(rendered.html).toContain("list-style-type:decimal");
    expect(rendered.html).toContain("display:list-item");
    expect(rendered.text).toContain("- Volunteer");
    expect(rendered.text).toContain("- Share");
    expect(rendered.text).toContain("3. Register");
    expect(rendered.text).toContain("4. Attend");
  });

  it("preserves nested list structure in plain-text fallback", () => {
    const text = htmlToPlainText("<ul><li>Parent<ol><li>First child</li><li>Second child</li></ol></li></ul>");

    expect(text).toContain("- Parent");
    expect(text).toContain("  1. First child");
    expect(text).toContain("  2. Second child");
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

  it("renders uploaded image blocks with width, alignment, link, and caption", () => {
    const template = normalizeEmailTemplateDocument({
      blocks: [
        {
          id: "impact-photo",
          type: "image",
          src: "https://cdn.example.org/impact/photo.jpg",
          alt: "Impact photo",
          imageWidthPercent: 55,
          align: "right",
          imageLinkUrl: "https://example.org/story",
          caption: "Impact caption",
        },
      ],
    });

    const rendered = renderEmailTemplateDocument(template, normalizeEmailTemplateSettings({ includeUnsubscribeLink: false }));

    expect(rendered.html).toContain('<a href="https://example.org/story"');
    expect(rendered.html).toContain('alt="Impact photo"');
    expect(rendered.html).toContain("width:55%");
    expect(rendered.html).toContain("margin:0 0 0 auto");
    expect(rendered.html).toContain("Impact caption");
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

  it("resolves gift amount and gift date when they appear on the same line", () => {
    const output = applyMergeTokens(
      "Your gift of {{gift.amount}} on {{gift.date}} was received. Alias: {giftAmount} / {giftDate}.",
      {
        donationAmount: "$42.00",
        "gift.date": "June 13, 2026",
      },
    );

    expect(output).toBe("Your gift of $42.00 on June 13, 2026 was received. Alias: $42.00 / June 13, 2026.");
  });

  it("resolves donor-prefixed simple merge aliases", () => {
    const output = applyMergeTokens(
      "{{donor.first}} {{donor.last}} {{donor.name}} {{donor.preferred}} {{donor.giftDate}} {{donor.totalGiving}}",
      {
        firstName: "Ava",
        lastName: "Donor",
        fullName: "Ava Donor",
        preferredName: "Ava",
        "gift.date": "June 13, 2026",
        totalLifetimeGiving: "$500.00",
      },
    );

    expect(output).toBe("Ava Donor Ava Donor Ava June 13, 2026 $500.00");
  });

  it("renders legacy staff signature blocks through the normal merge pass", () => {
    const template = normalizeEmailTemplateDocument({
      blocks: [
        {
          id: "signature",
          type: "staffSignature",
          signoff: "With gratitude,",
          staffTitle: "Executive Director",
        },
      ],
    });
    const rendered = renderEmailTemplateDocument(template, normalizeEmailTemplateSettings({ includeUnsubscribeLink: false }));
    const merged = applyMergeTokens(rendered.html, {
      signatureName: "Rebecca Haine",
      staffTitle: "Executive Director",
    });

    expect(merged).toContain("With gratitude,");
    expect(merged).toContain("Rebecca Haine");
    expect(merged).toContain("Executive Director");
    expect(merged).not.toContain("{{signatureName}}");
  });
});
