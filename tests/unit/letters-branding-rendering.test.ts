/** Unit tests for printable letterhead branding render helpers. */
import { describe, expect, it } from "vitest";
import {
  buildLetterFooterContactLine,
  normalizeHeaderLogoAlignment,
  resolveLetterLogoUrl,
  shouldShowLetterLogo,
} from "@/app/components/letters/letter-branding-rendering";
import { DEFAULT_BRANDING_SETTINGS, type BrandingSettings } from "@/app/lib/branding-settings";

function branding(overrides: Partial<BrandingSettings> = {}): BrandingSettings {
  return { ...DEFAULT_BRANDING_SETTINGS, ...overrides };
}

describe("letter branding rendering helpers", () => {
  it("resolves the organization's primary logo, square logo, then no logo", () => {
    expect(resolveLetterLogoUrl(" /org-logo.png ")).toBe("/org-logo.png");
    expect(resolveLetterLogoUrl("", "/org-square.png")).toBe("/org-square.png");
    expect(resolveLetterLogoUrl("", "")).toBeNull();
  });

  it("normalizes header logo alignment safely", () => {
    expect(normalizeHeaderLogoAlignment("CENTER")).toBe("CENTER");
    expect(normalizeHeaderLogoAlignment("right")).toBe("RIGHT");
    expect(normalizeHeaderLogoAlignment("NONE")).toBe("NONE");
    expect(normalizeHeaderLogoAlignment("bad-value")).toBe("LEFT");
  });

  it("hides the logo only when the preset explicitly sets NONE", () => {
    expect(shouldShowLetterLogo({ logoAlignment: "NONE" })).toBe(false);
    expect(shouldShowLetterLogo({ logoAlignment: "LEFT" })).toBe(true);
    expect(shouldShowLetterLogo(null)).toBe(true);
  });

  it("builds footer contact text using footer visibility toggles", () => {
    const settings = branding({
      contactPhone: "555-123-4567",
      contactEmail: "hello@example.org",
      websiteUrl: "https://example.org",
    });

    expect(buildLetterFooterContactLine(settings)).toBe("555-123-4567 | hello@example.org | https://example.org");
    expect(buildLetterFooterContactLine(settings, { id: "f", name: "Footer", isDefault: false, isActive: true, showPhone: false, showEmail: true, showWebsite: false })).toBe("hello@example.org");
  });
});
