/** Smoke coverage for the redesigned Letters & Printables builder source contract. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("letter builder UI redesign source contract", () => {
  it("keeps the builder on the focused document workspace structure", () => {
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");
    const mergeService = read("server/src/services/letters-merge.ts");

    expect(workspace).toContain("TemplateBuilder");
    expect(workspace).toContain("Canvas Builder");
    expect(workspace).toContain("Global Header + Footer");
    expect(workspace).toContain("Merge Fields");
    expect(workspace).toContain("mergeFieldSearch");
    expect(workspace).toContain("Search merge fields...");
    expect(workspace).toContain("Simple fields like");
    expect(workspace).toContain("{first}");
    expect(workspace).toContain("{last}");
    expect(workspace).toContain("{amount}");
    expect(workspace).toContain("//first");
    expect(workspace).toContain("const CANONICAL_LETTER_TOKEN_PATTERN = /\\{\\{\\s*([a-zA-Z0-9_.]+)(?:\\s*\\|\\s*([^}]+?))?\\s*\\}\\}/g");
    expect(workspace).toContain("const SIMPLE_LETTER_TOKEN_PATTERN = /(^|[^{])\\{\\s*([a-zA-Z][a-zA-Z0-9_]*)(?:\\s*\\|\\s*([^}]+?))?\\s*\\}(?!\\})/g");
    expect(workspace).toContain("split(\"|\")[0]");
    expect(mergeService).toContain("{{donor.firstName}}");
    expect(mergeService).toContain("{{donor.lastName}}");
    expect(mergeService).toContain("{{donor.fullName}}");
    expect(workspace).toContain("Template Info");
    expect(workspace).toContain("Workflow Policy");
    expect(workspace).toContain("Blocks & Snippets");
    expect(workspace).toContain("Saved Sections");
    expect(workspace).toContain("Ready for server preflight");
    expect(workspace).toContain("Click the page to write");
    expect(workspace).toContain("localChecklist.filter((item) => item.ok)");
  });

  it("keeps primary builder and publishing actions in the new workspace shell", () => {
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");
    const letterPage = read("app/components/letters/LetterPage.tsx");

    expect(workspace).toContain("Save");
    expect(workspace).toContain("Publish");
    expect(workspace).toContain("Validate");
    expect(workspace).toContain("Generate Letters");
    expect(workspace).toContain("[&_ul]:list-disc");
    expect(workspace).toContain("[&_ol]:list-decimal");
    expect(workspace).toContain("Canvas preview");
    expect(workspace).not.toContain("Page 1 of 1");
    expect(letterPage).toContain("[&_ul]:list-disc");
    expect(letterPage).toContain("[&_ol]:list-decimal");
    expect(workspace).toContain("formatInline");
    expect(workspace).toContain("insertTable");
    expect(workspace).toContain("Table Builder");
    expect(workspace).toContain("insertTablePreset");
    expect(workspace).toContain("Donation Summary Table");
    expect(workspace).toContain("Impact Grid Table");
    expect(workspace).toContain("Signature Contact Table");
    expect(workspace).toContain("snippetAlign");
    expect(workspace).toContain('applyAlignment("justify")');
    expect(workspace).toContain("insertSignature");
    expect(workspace).toContain("/settings/branding#communication-header-footer");
    expect(workspace).not.toContain("applyDefaultHeader");
    expect(workspace).not.toContain("applyDefaultFooter");
    expect(workspace).toContain("applyLineHeight");
    expect(workspace).toContain("insertFillSpace");
    expect(workspace).toContain("Push to Bottom");
    expect(workspace).toContain("Signature (optional)");
    expect(workspace).toContain("resizeSelectedImage");
    expect(workspace).toContain("updateSelectedImageAlt");
    expect(workspace).toContain("alignSelectedImage");
    expect(workspace).toContain("Selected Image Size");
    expect(workspace).toContain("data-letter-image-block");
    expect(workspace).toContain("Alt Text");
    expect(workspace).toContain('purpose: "editor"');
    expect(workspace).toContain("Images must be 5 MB or smaller.");
    expect(workspace).toContain("Insert a PNG, JPG, or WEBP image up to 5 MB");
    expect(workspace).not.toContain('window.prompt("Rows"');
    expect(workspace).not.toContain('window.prompt("Columns"');
    expect(workspace).not.toContain("window.prompt(");
    expect(workspace).toContain('id="letter-find-text"');
    expect(workspace).not.toContain("<WorkspaceRibbon");
    expect(workspace).not.toContain("RibbonTab");
  });

  it("keeps publish review tabs functional and advisory", () => {
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");

    expect(workspace).toContain('type PublishReviewTab = "summary" | "fields" | "validation" | "recipient" | "pdf" | "confirm"');
    expect(workspace).toContain("activePublishTab");
    expect(workspace).toContain("setActivePublishTab(tab.key)");
    expect(workspace).toContain("validation is advisory");
    expect(workspace).toContain("Publishing is still allowed");
    expect(workspace).toContain("ReviewFact");
    expect(workspace).toContain("ReviewMetric");
    expect(workspace).toContain("ValidationList");
    expect(workspace).toContain("Previous Review Step");
    expect(workspace).toContain("Next Review Step");
    expect(workspace).toContain("Step {activePublishTabIndex + 1} of {publishTabs.length}");
  });

  it("uses a shared branded LetterPage for live preview output", () => {
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");
    const letterPage = read("app/components/letters/LetterPage.tsx");
    const printRoute = read("app/components/letters/LetterPrintRoute.tsx");
    const letterDocument = read("app/lib/letters/letter-document.ts");
    const printPage = read("app/oyama-letters/templates/[templateId]/print/page.tsx");

    expect(workspace).toContain('import LetterPage from "@/app/components/letters/LetterPage"');
    expect(workspace).toContain("<LetterPage");
    expect(workspace).toContain("bodySlot=");
    expect(workspace).toContain("openPrintRoute");
    expect(workspace).toContain("/print");
    expect(letterPage).toContain("export default function LetterPage");
    expect(letterPage).toContain("document?: LetterDocument");
    expect(letterPage).toContain("@page { size: Letter portrait; margin: 0; }");
    expect(letterPage).toContain("resolvedBranding.primaryColor");
    expect(letterPage).toContain("resolvedBranding.accentColor");
    expect(letterPage).toContain("resolvedBranding.logoUrl");
    expect(letterPage).toContain("Sample Preview Recipient");
    expect(letterDocument).toContain("export interface LetterDocument");
    expect(letterDocument).toContain("buildLetterDocument");
    expect(letterDocument).toContain("brandingSnapshot");
    expect(printRoute).toContain("<LetterPage");
    expect(printRoute).toContain("buildLetterDocument");
    expect(printRoute).toContain("/print-preview");
    expect(printRoute).toContain("mergedPrintBody");
    expect(printRoute).toContain("document={document}");
    expect(printRoute).toContain("window.print()");
    expect(printPage).toContain("LetterPrintRoute");
  });

  it("uses live API data instead of placeholder builder state", () => {
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");
    const lettersRoute = read("server/src/routes/letters.ts");

    expect(workspace).toContain("/api/letters/templates");
    expect(workspace).toContain("/api/letters/merge-fields");
    expect(workspace).toContain("/api/letters/workflow-settings");
    expect(workspace).toContain("Generate Letters");
    expect(workspace).toContain("Print & Mail Queue");
    expect(workspace).toContain("Letters How To");
    expect(workspace).toContain("My Templates");
    expect(workspace).toContain("Team Templates");
    expect(workspace).toContain("AI-assisted");
    expect(lettersRoute).toContain("SIMPLE_LETTER_MERGE_FIELDS");
    expect(lettersRoute).toContain('label: "Simple Fields"');
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
    expect(donationsPage).toContain("Send To Letters Workspace");
    expect(donationsPage).toContain("Select Monthly Donors In View");
    expect(donationsPage).toContain("oyama-letters:temporary-recipient-list:");
    expect(workspace).toContain("readTemporaryRecipientList");
    expect(workspace).toContain("How to use this step");
    expect(workspace).toContain("Search recipients by name, email, or address");
    expect(lettersRoute).toContain("signature.signatureImageUrl");
    expect(lettersRoute).toContain("UNSUPPORTED_PDF_IMAGE_TYPE");
  });

  it("hands generated letters into reviewable canonical OyamaEmail drafts", () => {
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");
    const lettersRoute = read("server/src/routes/letters.ts");

    expect(workspace).toContain("createOrOpenEmailDraft");
    expect(workspace).toContain("Create Email Draft");
    expect(workspace).toContain("Open Email Draft");
    expect(workspace).toContain("Created a reviewable OyamaEmail draft. No email was sent.");
    expect(workspace).toContain('searchParams.get("generatedLetterId")');
    expect(lettersRoute).toContain("/oyama-email/campaigns/${campaign.id}");
    expect(lettersRoute).toContain("reused: true");
    expect(lettersRoute).toContain('source: "letters_generated"');
  });
});
