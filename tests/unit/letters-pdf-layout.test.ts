/** Unit coverage for server-side letter PDF block parsing. */
import { describe, expect, it } from "vitest";
import {
  buildLetterPdfBodyBlocks,
  htmlToPdfBlocks,
  htmlToPlainText,
  LetterPdfLayoutError,
  normalizeMergedDonationDateTextForPdfExport,
  recipientFacingLetterSubject,
  renderGeneratedLetterPdf,
} from "@/server/src/routes/letters";

describe("letters PDF layout parsing", () => {
  it("does not expose the legacy internal printable-letter label to recipients", () => {
    expect(recipientFacingLetterSubject("Printable Letter")).toBe("");
    expect(recipientFacingLetterSubject("  Thank you for your support  ")).toBe("Thank you for your support");
  });

  it("preserves explicit blank paragraphs and white-space blocks", () => {
    const blocks = htmlToPdfBlocks([
      "<p>Opening paragraph</p>",
      "<p><br></p>",
      '<div data-letter-spacer="72" style="height:96px;"></div>',
      "<p>Closing paragraph</p>",
    ].join(""));

    expect(blocks.map((block) => block.kind)).toEqual(["paragraph", "spacer", "spacer", "paragraph"]);
    expect(blocks[2]).toMatchObject({ kind: "spacer", height: 72 });
  });

  it("preserves push-to-bottom, dividers, and line height metadata", () => {
    const blocks = htmlToPdfBlocks([
      '<p><span style="line-height:1.75;">Body copy</span></p>',
      "<hr />",
      '<div data-letter-spacer="fill" style="min-height:240px;"></div>',
      "<p>Bottom content</p>",
    ].join(""));

    expect(blocks[0]).toMatchObject({ kind: "paragraph", lineHeight: 1.75 });
    expect(blocks[1]).toMatchObject({ kind: "divider" });
    expect(blocks[2]).toMatchObject({ kind: "spacer", fill: true });
  });

  it("preserves paragraph and heading alignment for PDF rendering", () => {
    const blocks = htmlToPdfBlocks([
      '<p style="text-align: justify;">This paragraph should be justified in the generated PDF.</p>',
      '<h2 style="text-align:center;">Centered heading</h2>',
      '<div style="text-align:right;">Right aligned wrapper text</div>',
    ].join(""));

    expect(blocks[0]).toMatchObject({ kind: "paragraph", align: "justify" });
    expect(blocks[1]).toMatchObject({ kind: "heading", align: "center" });
    expect(blocks[2]).toMatchObject({ kind: "paragraph", align: "right" });
  });

  it("preserves font size and family metadata for server PDF rendering", () => {
    const blocks = htmlToPdfBlocks('<p><span style="font-family: Georgia; font-size:14pt;">Formatted body text</span></p>');

    expect(blocks[0]).toMatchObject({ kind: "paragraph", fontFamily: "times", fontSize: 14 });
  });

  it("treats the canvas page-break marker and legacy page-break CSS as an intentional page break", () => {
    const blocks = htmlToPdfBlocks('<p>First page</p><div data-letter-page-break="true" style="break-after:page;page-break-after:always;">Page break</div><p>Second page</p>');

    expect(blocks.map((block) => block.kind)).toEqual(["paragraph", "pageBreak", "paragraph"]);
  });

  it("preserves block quotes as distinct indented PDF content", () => {
    const blocks = htmlToPdfBlocks('<blockquote style="text-align:center; line-height:1.6;">Care changes a community one relationship at a time.</blockquote>');

    expect(blocks).toEqual([
      expect.objectContaining({
        kind: "quote",
        text: "Care changes a community one relationship at a time.",
        align: "center",
        lineHeight: 1.6,
      }),
    ]);
  });

  it("preserves bullet, ordered, starting-number, and nested list semantics", () => {
    const blocks = htmlToPdfBlocks([
      "<ul>",
      "<li>First bullet</li>",
      "<li>Second bullet<ul><li>Nested bullet</li></ul></li>",
      "</ul>",
      '<ol start="4"><li>Fourth item</li><li>Fifth item</li></ol>',
    ].join(""));

    expect(blocks).toEqual([
      expect.objectContaining({ kind: "list", text: "First bullet", ordered: false, index: 1, depth: 0 }),
      expect.objectContaining({ kind: "list", text: "Second bullet", ordered: false, index: 2, depth: 0 }),
      expect.objectContaining({ kind: "list", text: "Nested bullet", ordered: false, index: 1, depth: 1 }),
      expect.objectContaining({ kind: "list", text: "Fourth item", ordered: true, index: 4, depth: 0 }),
      expect.objectContaining({ kind: "list", text: "Fifth item", ordered: true, index: 5, depth: 0 }),
    ]);
  });

  it("preserves table header cells, multiline text, and cell alignment", () => {
    const blocks = htmlToPdfBlocks([
      '<table data-letter-table="true" style="width:100%; border-collapse:collapse;">',
      '<tbody>',
      '<tr><th style="text-align:left;">Gift Detail</th><th style="text-align:right;">Value</th></tr>',
      '<tr><td style="text-align:left;">Donation<br>Amount</td><td style="text-align:right;">{{donation.amount}}</td></tr>',
      '</tbody></table>',
    ].join(""));

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      kind: "tableRow",
      header: true,
      cells: [
        { text: "Gift Detail", header: true, align: "left" },
        { text: "Value", header: true, align: "right" },
      ],
    });
    expect(blocks[1]).toMatchObject({
      kind: "tableRow",
      header: false,
      cells: [
        { text: "Donation\nAmount", header: false, align: "left" },
        { text: "{{donation.amount}}", header: false, align: "right" },
      ],
    });
  });

  it("preserves uploaded and resized images for PDF rendering", () => {
    const blocks = htmlToPdfBlocks([
      '<img src="/uploads/letter-media/org/photo.png" alt="Impact photo" data-letter-width="75" style="width:75%;height:auto;" />',
      '<p><img src="/uploads/letter-media/org/signature.png" alt="Signature" data-letter-width="34" /></p>',
      '<figure data-letter-image-block="true" style="text-align:right;"><img src="/uploads/letter-media/org/team.png" alt="Team photo" data-letter-width="45" style="width:45%;max-width:100%;height:auto;" /></figure>',
    ].join(""));

    expect(blocks[0]).toMatchObject({
      kind: "image",
      src: "/uploads/letter-media/org/photo.png",
      alt: "Impact photo",
      widthPercent: 75,
    });
    expect(blocks[1]).toMatchObject({
      kind: "image",
      src: "/uploads/letter-media/org/signature.png",
      widthPercent: 34,
    });
    expect(blocks[2]).toMatchObject({
      kind: "image",
      src: "/uploads/letter-media/org/team.png",
      alt: "Team photo",
      widthPercent: 45,
    });
  });

  it("keeps more intentional blank lines in plain-text fallback cleanup", () => {
    expect(htmlToPlainText("Top\n\n\n\nBottom")).toBe("Top\n\n\n\nBottom");
  });

  it("keeps bullet, ordered, and nested markers in plain-text handoffs", () => {
    const text = htmlToPlainText('<ul><li>Parent<ol start="3"><li>Third child</li><li>Fourth child</li></ol></li></ul>');

    expect(text).toContain("- Parent");
    expect(text).toContain("  3. Third child");
    expect(text).toContain("  4. Fourth child");
  });

  it("normalizes stale previous-day donation date text before PDF export", () => {
    const normalized = normalizeMergedDonationDateTextForPdfExport(
      "<p>Thank you for your gift on June 28, 2026.</p><p>Receipt date 06/28/2026.</p>",
      new Date("2026-06-29T00:00:00.000Z"),
    );

    expect(normalized).toContain("June 29, 2026");
    expect(normalized).toContain("06/29/2026");
    expect(normalized).not.toContain("June 28, 2026");
    expect(normalized).not.toContain("06/28/2026");
  });

  it("renders an uploaded signature image into a valid server PDF", async () => {
    const signatureImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const pdf = await renderGeneratedLetterPdf({
      templateName: "Signature Test",
      subject: "Signature Test",
      constituentName: "Test Donor",
      generatedAt: new Date("2026-06-04T12:00:00.000Z"),
      mergedPrintBody: "<p>Thank you for your support.</p>",
      branding: {
        organizationName: "Test Organization",
        tagline: "",
        addressLine: "",
        contactLine: "",
        taxId: "",
        footerLegalText: "",
        logoDataUrl: null,
        logoFormat: null,
        primaryColor: "#0f766e",
      },
      presets: {
        signatureBlock: {
          signerName: "Jane Smith",
          closingPhrase: "With gratitude,",
          signatureImageUrl: signatureImage,
        },
      },
    });

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(500);
  });

  it("appends the selected signature block even when the signer is mentioned in the body", async () => {
    const blocks = await buildLetterPdfBodyBlocks(
      "<p>Please contact Jane Smith if you have questions before the event.</p><p>Thank you for your support.</p>",
      {
        signerName: "Jane Smith",
        signerTitle: "Executive Director",
        closingPhrase: "With gratitude,",
        typedSignature: "Jane Smith",
      },
    );

    const text = blocks.filter((block) => "text" in block).map((block) => block.text);
    expect(text).toContain("With gratitude,");
    expect(text.filter((line) => line === "Jane Smith")).toHaveLength(1);
    expect(text).toContain("Executive Director");
  });

  it("separates an appended signature from the letter body", async () => {
    const blocks = await buildLetterPdfBodyBlocks(
      "<p>Thank you for your support.</p>",
      { signerName: "Jordan Lee", closingPhrase: "With gratitude," },
    );

    expect(blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "spacer", height: 10 }),
      expect.objectContaining({ kind: "paragraph", text: "With gratitude," }),
      expect.objectContaining({ kind: "paragraph", text: "Jordan Lee" }),
    ]));
  });

  it("does not duplicate a signature block already present at the end of the body", async () => {
    const blocks = await buildLetterPdfBodyBlocks(
      "<p>Thank you for your support.</p><p>With gratitude,</p><p>Jane Smith</p><p>Executive Director</p>",
      {
        signerName: "Jane Smith",
        signerTitle: "Executive Director",
        closingPhrase: "With gratitude,",
        typedSignature: "Jane Smith",
      },
    );

    const text = blocks.filter((block) => "text" in block).map((block) => block.text);
    expect(text.filter((line) => line === "With gratitude,")).toHaveLength(1);
    expect(text.filter((line) => line === "Jane Smith")).toHaveLength(1);
    expect(text.filter((line) => line === "Executive Director")).toHaveLength(1);
  });

  it("does not append a second signature when name and title share one body line", async () => {
    const blocks = await buildLetterPdfBodyBlocks(
      "<p>Thank you for your support.</p><p>With gratitude,</p><p>Rebecca Haine, Executive Director</p>",
      {
        signerName: "Rebecca Haine",
        signerTitle: "Executive Director",
        closingPhrase: "With gratitude,",
        signatureImageUrl: "https://example.test/signature.png",
      },
    );

    const text = blocks.filter((block) => "text" in block).map((block) => block.text);
    expect(text.filter((line) => line === "With gratitude,")).toHaveLength(1);
    expect(text.filter((line) => line.includes("Rebecca Haine"))).toHaveLength(1);
    expect(blocks.some((block) => block.kind === "image")).toBe(false);
  });

  it("blocks accidental overflow instead of silently creating a second PDF page", async () => {
    await expect(renderGeneratedLetterPdf({
      templateName: "One Page Limit",
      subject: "One Page Limit",
      constituentName: "Test Donor",
      generatedAt: new Date("2026-07-16T12:00:00.000Z"),
      mergedPrintBody: `<p>${"A deliberately long paragraph ".repeat(800)}</p>`,
      branding: {
        organizationName: "Test Organization",
        tagline: "",
        addressLine: "",
        contactLine: "",
        taxId: "",
        footerLegalText: "",
        logoDataUrl: null,
        logoFormat: null,
        primaryColor: "#0f766e",
      },
      presets: {},
    })).rejects.toBeInstanceOf(LetterPdfLayoutError);
  });

  it("creates another PDF page only for an explicit page break", async () => {
    const pdf = await renderGeneratedLetterPdf({
      templateName: "Intentional Two Pages",
      subject: "Intentional Two Pages",
      constituentName: "Test Donor",
      generatedAt: new Date("2026-07-16T12:00:00.000Z"),
      mergedPrintBody: '<p>First page content.</p><div data-letter-page-break="true" style="break-after:page;page-break-after:always;">Page break</div><p>Second page content.</p>',
      branding: {
        organizationName: "Test Organization",
        tagline: "",
        addressLine: "",
        contactLine: "",
        taxId: "",
        footerLegalText: "",
        logoDataUrl: null,
        logoFormat: null,
        primaryColor: "#0f766e",
      },
      presets: {},
    });

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect((pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? [])).toHaveLength(2);
  });

  it("renders justified text and multiline table cells into a valid server PDF", async () => {
    const pdf = await renderGeneratedLetterPdf({
      templateName: "Formatted Table Test",
      subject: "Formatted Table Test",
      constituentName: "Test Donor",
      generatedAt: new Date("2026-06-09T12:00:00.000Z"),
      mergedPrintBody: [
        '<p style="text-align:justify;">Thank you for your generous support of this mission and the practical care it makes possible.</p>',
        '<table data-letter-table="true" style="width:100%; border-collapse:collapse;">',
        '<tbody>',
        '<tr><th style="text-align:left;">Gift Detail</th><th style="text-align:right;">Value</th></tr>',
        '<tr><td style="text-align:left;">Donation<br>Amount</td><td style="text-align:right;">$100.00</td></tr>',
        '</tbody></table>',
      ].join(""),
      branding: {
        organizationName: "Test Organization",
        tagline: "",
        addressLine: "",
        contactLine: "",
        taxId: "",
        footerLegalText: "",
        logoDataUrl: null,
        logoFormat: null,
        primaryColor: "#0f766e",
      },
      presets: {},
    });

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(500);
  });

  it("renders wrapped bullet and ordered lists into a valid server PDF", async () => {
    const pdf = await renderGeneratedLetterPdf({
      templateName: "List Formatting Test",
      subject: "List Formatting Test",
      constituentName: "Test Donor",
      generatedAt: new Date("2026-07-15T12:00:00.000Z"),
      mergedPrintBody: [
        "<p>Your support makes the following work possible:</p>",
        "<ul><li>A deliberately long bullet item that wraps across lines and should keep its continuation aligned with the item text instead of the bullet marker.</li><li>Second bullet</li></ul>",
        '<ol start="3"><li>Third numbered item</li><li>Fourth numbered item</li></ol>',
      ].join(""),
      branding: {
        organizationName: "Test Organization",
        tagline: "",
        addressLine: "",
        contactLine: "",
        taxId: "",
        footerLegalText: "",
        logoDataUrl: null,
        logoFormat: null,
        primaryColor: "#0f766e",
      },
      presets: {},
    });

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(500);
  });
});
