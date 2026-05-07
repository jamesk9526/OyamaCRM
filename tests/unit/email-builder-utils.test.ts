import { describe, expect, it } from "vitest";
import {
  createDefaultTemplate,
  createTemplateFromPreset,
  generateEmailHtml,
  generatePlainText,
  parseVideoUrl,
} from "@/app/lib/email-builder-utils";

describe("email-builder-utils", () => {
  it("parses youtube links into embed metadata", () => {
    const parsed = parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(parsed.embedType).toBe("youtube");
    expect(parsed.embedUrl).toContain("youtube.com/embed/dQw4w9WgXcQ");
    expect(parsed.thumbnailUrl).toContain("img.youtube.com");
  });

  it("generates HTML and plain text from template blocks", () => {
    const template = createDefaultTemplate();
    const html = generateEmailHtml(template);
    const text = generatePlainText(template);
    expect(html).toContain("<html");
    expect(html).toContain("table");
    expect(text.length).toBeGreaterThan(5);
  });

  it("creates expanded preset templates", () => {
    const template = createTemplateFromPreset("newsletter");
    expect(template.blocks.length).toBeGreaterThan(2);
    expect(template.contentWidth).toBeGreaterThanOrEqual(600);
  });
});
