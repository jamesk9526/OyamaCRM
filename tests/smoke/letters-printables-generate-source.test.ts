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
    expect(workspace).toContain("Previous");
    expect(workspace).toContain("Next");
  });

  it("generates from real CRM APIs and previews real PDF blobs", () => {
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");

    expect(workspace).toContain("/api/letters/templates");
    expect(workspace).toContain("/api/letters/generated/preview");
    expect(workspace).toContain("/api/letters/generated/batch");
    expect(workspace).toContain("/api/letters/generated/queue/mail/actions");
    expect(workspace).toContain("/api/letters/templates/${encodeURIComponent(activeTemplateId)}/sample-pdf?preview=1&inline=1");
    expect(workspace).toContain("/api/constituents");
    expect(workspace).toContain("/api/donations");
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

    expect(workspace).toContain("/settings/branding/letter-presets");
    expect(workspace).toContain("/settings/branding/signatures");
    expect(workspace).toContain("Letter branding now uses the global Branding Settings source of truth");
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
