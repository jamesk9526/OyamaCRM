/** Unit coverage for server-side letter PDF block parsing. */
import { describe, expect, it } from "vitest";
import { htmlToPdfBlocks, htmlToPlainText, normalizeMergedDonationDateTextForPdfExport, renderGeneratedLetterPdf } from "@/server/src/routes/letters";

describe("letters PDF layout parsing", () => {
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
  });

  it("keeps more intentional blank lines in plain-text fallback cleanup", () => {
    expect(htmlToPlainText("Top\n\n\n\nBottom")).toBe("Top\n\n\n\nBottom");
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
});
