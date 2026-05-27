/** Source smoke coverage for the unified OyamaLetters Generate workspace. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("OyamaLetters generate workspace source contract", () => {
  it("uses the three-column production workspace structure", () => {
    const workspace = read("app/components/letters/generation/LettersGenerateWorkspace.tsx");
    const leftPanel = read("app/components/letters/generation/TemplateAudiencePanel.tsx");
    const centerPanel = read("app/components/letters/generation/DocumentPreviewPanel.tsx");
    const rightPanel = read("app/components/letters/generation/MergeSettingsPanel.tsx");

    expect(workspace).toContain("GenerateActionBar");
    expect(workspace).toContain("TemplateAudiencePanel");
    expect(workspace).toContain("DocumentPreviewPanel");
    expect(workspace).toContain("MergeSettingsPanel");
    expect(leftPanel).toContain("Document Type");
    expect(leftPanel).toContain("Audience / Records");
    expect(centerPanel).toContain("Merged HTML Preview");
    expect(centerPanel).toContain("Generated PDF preview");
    expect(rightPanel).toContain("Merge Fields");
    expect(rightPanel).toContain("Activity");
  });

  it("generates from real CRM APIs and previews real PDF blobs", () => {
    const workspace = read("app/components/letters/generation/LettersGenerateWorkspace.tsx");

    expect(workspace).toContain("/api/letters/templates");
    expect(workspace).toContain("/api/letters/generated/preview");
    expect(workspace).toContain("/api/letters/generated/batch");
    expect(workspace).toContain("/api/letters/generated/export-pdf-batch?preview=1");
    expect(workspace).toContain("URL.createObjectURL(blob)");
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
    const home = read("app/components/letters/OyamaLettersHome.tsx");
    const route = read("app/oyama-letters/page.tsx");

    expect(route).toContain("OyamaLettersHome");
    expect(home).toContain("What would you like to create?");
    expect(home).toContain("Generated History");
    expect(home).toContain("Saved Templates");
    expect(home).toContain("/oyama-letters/generate?type=thank-you");
  });
});
