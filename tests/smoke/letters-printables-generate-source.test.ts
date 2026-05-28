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
    expect(workspace).toContain("Batch Actions");
    expect(workspace).toContain("Generated Activity");
    expect(workspace).toContain("Print Queue");
    expect(workspace).toContain("Mail Queue");
  });

  it("generates from real CRM APIs and previews real PDF blobs", () => {
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");

    expect(workspace).toContain("/api/letters/templates");
    expect(workspace).toContain("/api/letters/generated/preview");
    expect(workspace).toContain("/api/letters/generated/batch");
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
});
