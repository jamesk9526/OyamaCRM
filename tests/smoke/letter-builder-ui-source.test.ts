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
    expect(workspace).toContain("applyLineHeight");
    expect(workspace).toContain("insertFillSpace");
    expect(workspace).toContain("Push to Bottom");
    expect(workspace).toContain("Signature (optional)");
    expect(workspace).toContain("resizeSelectedImage");
    expect(workspace).toContain("Selected Image Size");
    expect(workspace).toContain('purpose: "editor"');
    expect(workspace).not.toContain("<WorkspaceRibbon");
    expect(workspace).not.toContain("RibbonTab");
  });

  it("uses live API data instead of placeholder builder state", () => {
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");

    expect(workspace).toContain("/api/letters/templates");
    expect(workspace).toContain("/api/letters/merge-fields");
    expect(workspace).toContain("/api/letters/workflow-settings");
    expect(workspace).toContain("Generate Letters");
    expect(workspace).toContain("Print & Mail Queue");
    expect(workspace).toContain("Letters How To");
    expect(workspace).toContain("My Templates");
    expect(workspace).toContain("Team Templates");
    expect(workspace).toContain("AI-assisted");
    expect(workspace).not.toContain("mockDonor");
    expect(workspace).not.toContain("fake");
  });

  it("keeps signature blocks optional across publishing and donation handoff", () => {
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");
    const lettersRoute = read("server/src/routes/letters.ts");
    const donationModal = read("app/components/donations/LetterFromTemplateModal.tsx");

    expect(workspace).toContain("Signature (optional)");
    expect(lettersRoute).not.toContain('blockers.push("Select a signature block before publishing.")');
    expect(lettersRoute).toContain("hasDraftSignatureOverride");
    expect(donationModal).not.toContain("Boolean(template.signatureBlockId)");
  });

  it("uses a modal signature visual builder and donation temporary-list handoff", () => {
    const signatureManager = read("app/components/letters/LetterSignaturesManager.tsx");
    const donationsPage = read("app/donations/page.tsx");
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");
    const lettersRoute = read("server/src/routes/letters.ts");

    expect(signatureManager).toContain("Signature Visual Builder");
    expect(signatureManager).toContain("Rendered Preview");
    expect(signatureManager).toContain('purpose: "signature"');
    expect(donationsPage).toContain("Create Letters for Selected Donors");
    expect(donationsPage).toContain("Select Visible Monthly Donors");
    expect(donationsPage).toContain("oyama-letters:temporary-recipient-list:");
    expect(workspace).toContain("readTemporaryRecipientList");
    expect(workspace).toContain("How to use this step");
    expect(workspace).toContain("Search recipients by name, email, or address");
    expect(lettersRoute).toContain("signature.signatureImageUrl");
    expect(lettersRoute).toContain("UNSUPPORTED_PDF_IMAGE_TYPE");
  });
});
