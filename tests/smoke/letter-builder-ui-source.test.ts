/** Smoke coverage for the redesigned Letters & Printables builder source contract. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("letter builder UI redesign source contract", () => {
  it("keeps the builder on the focused document workspace structure", () => {
    const editor = read("app/components/letters/LetterTemplateEditor.tsx");
    const richEditor = read("app/components/letters/FormLetterRichEditor.tsx");

    expect(editor).toContain('data-testid="letter-builder-page"');
    expect(editor).toContain('data-testid="letter-left-insert-panel"');
    expect(editor).toContain('data-testid="letter-right-sidebar"');
    expect(editor).toContain('data-testid="letter-bottom-status"');
    expect(editor).toContain("flex h-[calc(100dvh-5.75rem)]");
    expect(editor).toContain("min-h-9 min-w-0 items-center justify-between");
    expect(editor).toContain("border-l border-gray-200 pl-3");
    expect(editor).toContain("overflow-hidden bg-gray-50");
    expect(editor).toContain("absolute bottom-0 left-0 right-0");
    expect(editor).toContain('floatingToolbarTopClassName="top-3"');
    expect(editor).toContain("Confirm Publish");
    expect(richEditor).toContain('data-testid="letter-floating-command-bar"');
    expect(richEditor).toContain("floatingToolbarTopClassName");
    expect(richEditor).toContain('data-testid": "letter-editor-canvas"');
  });

  it("moves duplicated primary actions into one header and More Options", () => {
    const editor = read("app/components/letters/LetterTemplateEditor.tsx");

    expect(editor).toContain("Save Draft");
    expect(editor).toContain("Convert to Email Draft");
    expect(editor).toContain("Duplicate Template");
    expect(editor).not.toContain("<WorkspaceRibbon");
    expect(editor).not.toContain("RibbonTab");
  });

  it("exposes real typography controls and variable insertion hooks", () => {
    const editor = read("app/components/letters/LetterTemplateEditor.tsx");
    const richEditor = read("app/components/letters/FormLetterRichEditor.tsx");

    expect(editor).toContain('data-testid="letter-font-family-select"');
    expect(editor).toContain('data-testid="letter-font-size-select"');
    expect(editor).toContain('testId="letter-variable-insert"');
    expect(richEditor).toContain("setFontFamily");
    expect(richEditor).toContain("setFontSize");
    expect(richEditor).toContain("/ai-write");
  });
});
