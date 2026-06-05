/** Unit coverage for server-side letter PDF block parsing. */
import { describe, expect, it } from "vitest";
import { htmlToPdfBlocks, htmlToPlainText, renderGeneratedLetterPdf } from "@/server/src/routes/letters";

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
});
