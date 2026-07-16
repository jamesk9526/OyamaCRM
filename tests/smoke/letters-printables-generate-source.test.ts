/** Source smoke coverage for the unified OyamaLetters Generate workspace. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("OyamaLetters generate workspace source contract", () => {
  it("uses the three-column production workspace structure", () => {
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");

    expect(workspace).toContain("GenerateWorkspace");
    expect(workspace).toContain("Preview Recipient");
    expect(workspace).toContain("Generate One Letter");
    expect(workspace).toContain("Generate Batch");
    expect(workspace).toContain("Validate Batch");
    expect(workspace).toContain("View Batch PDF");
    expect(workspace).toContain("Print Queue");
    expect(workspace).toContain("Mail Queue");
    expect(workspace).toContain("Bulk File Tool Strip");
    expect(workspace).toContain("Delete Prints");
    expect(workspace).toContain("Test Constituent Lookup");
    expect(workspace).toContain("Live PDF");
    expect(workspace).toContain("Donation donor");
    expect(workspace).toContain("Steward Writing");
    expect(workspace).toContain("Insert at Cursor");
    expect(workspace).toContain("Inline Suggestions");
    expect(workspace).toContain("sticky top-0 z-40");
    expect(workspace).toContain("oyamaLetters.aiComposerOpen.v1");
    expect(workspace).toContain("oyamaLetters.inlineSuggestEnabled.v1");
    expect(workspace).toContain("Previous");
    expect(workspace).toContain("Next");
  });

  it("generates from real CRM APIs and previews real PDF blobs", () => {
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");
    const lettersApi = read("server/src/routes/letters.ts");

    expect(workspace).toContain("/api/letters/templates");
    expect(workspace).toContain("/api/letters/generated/preview");
    expect(workspace).toContain("/api/letters/generated/preview-pdf?preview=1&inline=1");
    expect(workspace).toContain("/api/letters/generated/batch");
    expect(workspace).toContain("buildMergeContextPayload");
    expect(workspace).toContain('searchParams.get("campaignId")');
    expect(workspace).toContain('searchParams.get("eventId")');
    expect(workspace).toContain("/api/letters/generated/queue/mail/actions");
    expect(workspace).toContain("/api/letters/ai-compose");
    expect(workspace).toContain("/api/letters/ai-suggest");
    expect(workspace).toContain("/api/letters/templates/${encodeURIComponent(activeTemplateId)}/sample-pdf?preview=1&inline=1");
    expect(workspace).toContain("/api/constituents");
    expect(workspace).toContain("/api/donations");
    expect(lettersApi).toContain("sample-preview-recipient");
    expect(lettersApi).toContain("syntheticPreviewRecipient");
    expect(lettersApi).toContain("production-faithful preview PDF");
    expect(lettersApi).toContain("eventId,");
    expect(lettersApi).toContain("campaignId,");
    expect(workspace).not.toContain("fake");
    expect(workspace).not.toContain("mockDonor");
  });

  it("keeps Communications deep links compatible with canonical routes", () => {
    expect(read("app/communications/letters-printables/page.tsx")).toContain('redirect("/oyama-letters")');
    expect(read("app/communications/letters-printables/generate/page.tsx")).toContain('redirect("/oyama-letters/generate")');
    expect(read("app/letters-printables/page.tsx")).toContain('redirect("/oyama-letters")');
    expect(read("app/letters-printables/generate/page.tsx")).toContain("/oyama-letters/generate");
  });

  it("starts from the OyamaLetters production-center home instead of a blank builder", () => {
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");
    const route = read("app/oyama-letters/page.tsx");

    expect(route).toContain('view="library"');
    expect(workspace).toContain("Template Library");
    expect(workspace).toContain("Create New Template");
    expect(workspace).toContain("No templates found");
    expect(workspace).toContain("/oyama-letters/generate");
  });

  it("routes letter branding to global branding settings", () => {
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");
    const lettersApi = read("server/src/routes/letters.ts");
    const settingsApi = read("server/src/routes/settings.ts");

    expect(workspace).toContain("/settings/branding#communication-header-footer");
    expect(workspace).toContain("/settings/branding/signatures");
    expect(workspace).toContain("Letter branding now uses the global Branding Settings source of truth");
    expect(lettersApi).toContain('readFirstTextConfig(branding, ["logoUrl", "logo", "primaryLogoUrl", "brandLogoUrl"])');
    expect(lettersApi).toContain("Do not guess from the newest branding upload");
    expect(settingsApi).toContain("BRANDING_LOGO_UPLOADED_AND_SELECTED");
    expect(lettersApi).toContain("getDefaultLetterPdfPresets");
    expect(lettersApi).toContain("headerPreset: generatedLetter.template?.headerPreset ?? defaultPresets.headerPreset");
    expect(lettersApi).toContain("footerPreset: generatedLetter.template?.footerPreset ?? defaultPresets.footerPreset");
    expect(lettersApi).toContain('doc.text(line, pageWidth / 2, footerY + index * 10, { align: "center" })');
    expect(lettersApi).toContain("LETTER_ONE_PAGE_LIMIT_EXCEEDED");
    expect(lettersApi).toContain("requireExplicitPageBreaks: true");
    expect(workspace).toContain('data-letter-page-break="true"');
    expect(workspace).toContain("Overflow blocked");
  });

  it("keeps operational PDF labels out of rendered letter output", () => {
    const lettersApi = read("server/src/routes/letters.ts");
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");
    const brandingManager = read("app/components/letters/LetterBrandingManager.tsx");

    expect(lettersApi).not.toContain("Batch item");
    expect(lettersApi).not.toContain("Generated for");
    expect(lettersApi).not.toContain("itemLabel");
    expect(lettersApi).not.toContain("Page ${");
    expect(workspace).not.toContain("<p>Page 1</p>");
    expect(brandingManager).not.toContain("Page Number");
    expect(brandingManager).not.toContain("<p>Page 1</p>");
  });
});
