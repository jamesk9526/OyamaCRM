/** Smoke coverage for the redesigned Letters & Printables builder source contract. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("letter builder UI redesign source contract", () => {
  it("keeps the builder on the focused document workspace structure", () => {
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");

    expect(workspace).toContain("TemplateBuilder");
    expect(workspace).toContain("Canvas Builder");
    expect(workspace).toContain("Letterhead");
    expect(workspace).toContain("Merge Fields");
    expect(workspace).toContain("Template Info");
    expect(workspace).toContain("Workflow Policy");
    expect(workspace).toContain("Blocks & Snippets");
    expect(workspace).toContain("Saved Sections");
  });

  it("keeps primary builder and publishing actions in the new workspace shell", () => {
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");

    expect(workspace).toContain("Save");
    expect(workspace).toContain("Publish");
    expect(workspace).toContain("Validate");
    expect(workspace).toContain("Generate Letters");
    expect(workspace).toContain("formatInline");
    expect(workspace).toContain("insertTable");
    expect(workspace).toContain("insertSignature");
    expect(workspace).toContain("applyDefaultHeader");
    expect(workspace).not.toContain("<WorkspaceRibbon");
    expect(workspace).not.toContain("RibbonTab");
  });

  it("uses live API data instead of placeholder builder state", () => {
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");

    expect(workspace).toContain("/api/letters/templates");
    expect(workspace).toContain("/api/letters/merge-fields");
    expect(workspace).toContain("/api/letters/workflow-settings");
    expect(workspace).not.toContain("mockDonor");
    expect(workspace).not.toContain("fake");
  });
});
