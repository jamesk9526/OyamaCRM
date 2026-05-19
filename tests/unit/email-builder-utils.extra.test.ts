/**
 * Extended unit tests for `app/lib/email-builder-utils.ts`.
 * Adds branch coverage on top of the existing smoke test for:
 *   - Vimeo / OneDrive / generic video URL parsing
 *   - All preset variants (blank, newsletter, appeal, event)
 *   - Default block factory output for divider / spacer / button
 *   - Plain-text generation respects link/button labels
 */
import { describe, expect, it } from "vitest";
import {
  createDefaultBlock,
  createDefaultTemplate,
  formatRichTextHtml,
  createTemplateFromPreset,
  generateEmailHtml,
  generatePlainText,
  parseVideoUrl,
} from "@/app/lib/email-builder-utils";

describe("parseVideoUrl — additional providers", () => {
  it("handles youtu.be short links", () => {
    const out = parseVideoUrl("https://youtu.be/dQw4w9WgXcQ");
    expect(out.embedType).toBe("youtube");
    expect(out.embedUrl).toContain("youtube.com/embed/dQw4w9WgXcQ");
  });

  it("recognizes vimeo URLs", () => {
    const out = parseVideoUrl("https://vimeo.com/76979871");
    expect(out.embedType).toBe("vimeo");
    expect(out.embedUrl).toBe("https://player.vimeo.com/video/76979871");
  });

  it("recognizes onedrive URLs", () => {
    const out = parseVideoUrl("https://onedrive.live.com/embed?cid=ABC");
    expect(out.embedType).toBe("onedrive");
  });

  it("falls back to a generic embed for unknown providers", () => {
    const out = parseVideoUrl("https://example.com/video.mp4");
    expect(out.embedType).toBe("generic");
    expect(out.embedUrl).toBe("https://example.com/video.mp4");
  });

  it("returns an empty embed for an empty URL", () => {
    const out = parseVideoUrl("");
    expect(out.embedType).toBe("generic");
    expect(out.embedUrl).toBe("");
  });
});

describe("createDefaultBlock", () => {
  it("creates well-formed text blocks with sane defaults", () => {
    const block = createDefaultBlock("text");
    expect(block.type).toBe("text");
    expect(block.id).toBeTruthy();
  });

  it("creates divider, spacer, and button blocks", () => {
    expect(createDefaultBlock("divider").type).toBe("divider");
    expect(createDefaultBlock("spacer").type).toBe("spacer");
    expect(createDefaultBlock("button").type).toBe("button");
  });

  it("creates quote, impact stat, and AI blocks", () => {
    expect(createDefaultBlock("quote").type).toBe("quote");
    expect(createDefaultBlock("impactStat").type).toBe("impactStat");
    expect(createDefaultBlock("aiText").type).toBe("aiText");
    expect(createDefaultBlock("aiButton").type).toBe("aiButton");
  });

  it("creates donor-specific stewardship and compliance blocks", () => {
    expect(createDefaultBlock("donorThankYou").type).toBe("donorThankYou");
    expect(createDefaultBlock("donationReceipt").type).toBe("donationReceipt");
    expect(createDefaultBlock("givingSummary").type).toBe("givingSummary");
    expect(createDefaultBlock("donationCta").type).toBe("donationCta");
    expect(createDefaultBlock("monthlyDonorInvitation").type).toBe("monthlyDonorInvitation");
    expect(createDefaultBlock("lapsedDonorReengagement").type).toBe("lapsedDonorReengagement");
    expect(createDefaultBlock("firstTimeDonorWelcome").type).toBe("firstTimeDonorWelcome");
    expect(createDefaultBlock("staffSignature").type).toBe("staffSignature");
    expect(createDefaultBlock("footerCompliance").type).toBe("footerCompliance");
  });
});

describe("createTemplateFromPreset", () => {
  it("blank preset matches the default template structure", () => {
    const blank = createTemplateFromPreset("blank");
    const def = createDefaultTemplate();
    expect(blank.contentWidth).toBe(def.contentWidth);
    expect(blank.blocks.length).toBe(def.blocks.length);
  });

  it("newsletter preset uses a wider 640px content width", () => {
    const t = createTemplateFromPreset("newsletter");
    expect(t.contentWidth).toBe(640);
    expect(t.blocks.length).toBeGreaterThanOrEqual(4);
  });

  it("appeal preset includes a green donate button", () => {
    const t = createTemplateFromPreset("appeal");
    const buttonBlock = t.blocks.find((b) => b.type === "button");
    expect(buttonBlock).toBeTruthy();
  });

  it("event preset includes an image and an RSVP button", () => {
    const t = createTemplateFromPreset("event");
    const types = t.blocks.map((b) => b.type);
    expect(types).toContain("image");
    expect(types).toContain("button");
  });
});

describe("generateEmailHtml / generatePlainText", () => {
  it("adds inline rich-text styles for headings, lists, quotes, and links", () => {
    const html = formatRichTextHtml(
      '<h1>Main Title</h1><h2>Section</h2><p>Body copy with a <a href="https://example.com">link</a>.</p><ul><li>First</li></ul><blockquote>Quoted</blockquote>',
      {
        textColor: "#123456",
        baseFontSizePx: 17,
        linkColor: "#16a34a",
      },
    );

    expect(html).toContain('<h1 style="margin:0 0 14px;font-size:32px;line-height:1.2;font-weight:700;color:#123456;">');
    expect(html).toContain('<h2 style="margin:0 0 12px;font-size:26px;line-height:1.25;font-weight:700;color:#123456;">');
    expect(html).toContain('<ul style="margin:0 0 12px 24px;padding:0;color:#123456;">');
    expect(html).toContain('<blockquote style="margin:0 0 12px;padding:0 0 0 16px;border-left:4px solid #16a34a;font-style:italic;color:#123456;">');
    expect(html).toContain('<a href="https://example.com" style="color:#16a34a;text-decoration:underline;">');
  });

  it("renders HTML for an event preset and contains the RSVP label", () => {
    const t = createTemplateFromPreset("event");
    const html = generateEmailHtml(t);
    expect(html).toContain("RSVP Today");
  });

  it("preserves H1 text-block content in generated email html", () => {
    const textBlock = createDefaultBlock("text");
    if (textBlock.type !== "text") {
      throw new Error("Expected text block");
    }

    textBlock.content = '<h1>Campaign Headline</h1><p>Paragraph copy</p>';

    const html = generateEmailHtml({
      backgroundColor: "#ffffff",
      contentWidth: 600,
      fontFamily: "Arial, Helvetica, sans-serif",
      blocks: [textBlock, createDefaultBlock("footerCompliance")],
    });

    expect(html).toContain("Campaign Headline");
    expect(html).toContain('<h1 style="margin:0 0 14px;font-size:32px;line-height:1.2;font-weight:700;color:#333333;">');
  });

  it("plain-text output includes button labels for accessibility", () => {
    const t = createTemplateFromPreset("appeal");
    const text = generatePlainText(t);
    expect(text.toLowerCase()).toContain("donate");
  });

  it("plain-text output includes a button's exact label", () => {
    // Build a minimal template with one known button so we can assert the
    // label is preserved verbatim through HTML → plain-text conversion.
    const button = createDefaultBlock("button");
    (button as { label: string }).label = "Reserve My Seat";
    const tpl = {
      backgroundColor: "#fff",
      contentWidth: 600,
      fontFamily: "Arial",
      blocks: [button],
    };
    const text = generatePlainText(tpl);
    expect(text).toContain("Reserve My Seat");
  });

  it("renders donor thank-you and footer compliance content in HTML", () => {
    const tpl = {
      backgroundColor: "#fff",
      contentWidth: 600,
      fontFamily: "Arial",
      blocks: [
        createDefaultBlock("donorThankYou"),
        createDefaultBlock("footerCompliance"),
      ],
    };
    const html = generateEmailHtml(tpl);
    expect(html).toContain("Thank You for Your Generosity");
    expect(html).toContain("Unsubscribe");
  });
});
