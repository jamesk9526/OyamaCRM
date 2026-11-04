import { describe, expect, it } from "vitest";
import { defaultDesign, sourceIdentity } from "@/server/src/oyama-create/studio/design";
import { paragraph } from "@/server/src/oyama-create/studio/registry";
import { applyEmailEditingDocument, customizeEmailBlock, emailEditingDocument, emailOverrideForSelection, relinkEmailBlock } from "@/server/src/oyama-create/studio/email-document";

describe("direct email document editing", () => {
  it("updates linked copy and order while keeping print-only content", () => {
    const design = defaultDesign();
    design.body.content = [paragraph("first", "Shared opening"), { type: "letterPageBreak", attrs: { studioId: "break" } }, paragraph("last", "Shared closing")];
    const doc = emailEditingDocument(design);
    doc.content[0].content![0].text = "Edited in Email";
    doc.content.reverse();
    const result = applyEmailEditingDocument(design, doc);
    expect(result.body.content[2].content![0].text).toBe("Edited in Email");
    expect(result.body.content[1].type).toBe("letterPageBreak");
    expect(design.body.content[0].content![0].text).toBe("Shared opening");
  });

  it("edits a protected email paragraph without replacing the letter source", () => {
    const design = defaultDesign();
    design.body.content = [paragraph("first", "Long letter paragraph"), paragraph("second", "Shared closing")];
    const customized = customizeEmailBlock(design, "first");
    expect(customized.email.reviewedSource).toBe(sourceIdentity(design));
    const doc = emailEditingDocument(customized);
    doc.content[0].content![0].text = "Short email paragraph";
    doc.content[1].content![0].text = "Shared closing edited in email";
    const result = applyEmailEditingDocument(customized, doc);
    expect(result.body.content[0].content![0].text).toBe("Long letter paragraph");
    expect(result.body.content[1].content![0].text).toBe("Shared closing edited in email");
    expect(result.email.overrides.first.content![0].text).toBe("Short email paragraph");
    expect(emailEditingDocument(result).content[0].content![0].text).toBe("Short email paragraph");
  });

  it("retains customized content for review when its shared block is removed", () => {
    const design = defaultDesign();
    design.body.content = [paragraph("first", "Letter copy"), paragraph("second", "Other copy")];
    const customized = customizeEmailBlock(design, "first");
    customized.email.overrides.first.content![0].text = "Protected email copy";
    const doc = emailEditingDocument(customized);
    doc.content.shift();
    const result = applyEmailEditingDocument(customized, doc);
    expect(result.body.content.map(node => node.attrs?.studioId)).toEqual(["second"]);
    expect(result.email.overrides.first.content![0].text).toBe("Protected email copy");
    expect(relinkEmailBlock(result, "first").email.overrides).toEqual({});
  });

  it("routes edits inside a customized group into the protected group", () => {
    const design = defaultDesign();
    design.body.content = [{ type: "studioGroup", attrs: { studioId: "group" }, content: [paragraph("nested", "Shared nested copy")] }];
    const customized = customizeEmailBlock(design, "group");
    expect(emailOverrideForSelection(customized, "nested")).toBe("group");
    const doc = emailEditingDocument(customized);
    doc.content[0].content![0].content![0].text = "Email group copy";
    const result = applyEmailEditingDocument(customized, doc);
    expect(result.body.content[0].content![0].content![0].text).toBe("Shared nested copy");
    expect(result.email.overrides.group.content![0].content![0].text).toBe("Email group copy");
  });

  it("keeps pre-existing nested overrides independently editable", () => {
    const design = defaultDesign();
    design.body.content = [{ type: "studioGroup", attrs: { studioId: "group" }, content: [paragraph("nested", "Shared copy")] }];
    design.email.overrides = { group: { ...structuredClone(design.body.content[0]), content: [paragraph("nested", "Parent email copy")] }, nested: paragraph("nested", "Nested email copy") };
    expect(emailOverrideForSelection(design, "nested")).toBe("nested");
    const doc = emailEditingDocument(design);
    expect(doc.content[0].content![0].content![0].text).toBe("Nested email copy");
    doc.content[0].content![0].content![0].text = "Edited nested email copy";
    const result = applyEmailEditingDocument(design, doc);
    expect(result.email.overrides.nested.content![0].text).toBe("Edited nested email copy");
    expect(result.email.overrides.group.content![0].content![0].text).toBe("Parent email copy");
    expect(result.body.content[0].content![0].content![0].text).toBe("Shared copy");
  });

  it("moves and edits protected images while leaving the letter asset and crop intact", () => {
    const design = defaultDesign();
    const image = { type: "image", attrs: { studioId: "photo", src: "/api/letters/media/org/letter.png", width: 80, crop: "contain" } };
    design.body.content = [image, paragraph("copy", "Shared copy")];
    const customized = customizeEmailBlock(design, "photo");
    const doc = emailEditingDocument(customized);
    doc.content[0].attrs!.src = "/api/letters/media/org/email.png";
    doc.content[0].attrs!.width = 60;
    doc.content.reverse();
    const result = applyEmailEditingDocument(customized, doc);
    expect(result.body.content[1]).toEqual(image);
    expect(result.email.overrides.photo.attrs!.src).toContain("email.png");
    expect(result.email.overrides.photo.attrs!.width).toBe(60);
  });

  it("preserves a customized table's original letter cells", () => {
    const design = defaultDesign();
    design.body.content = [{ type: "table", attrs: { studioId: "table" }, content: [{ type: "tableRow", content: [{ type: "tableCell", content: [paragraph("cell", "Letter cell")] }] }] }];
    const customized = customizeEmailBlock(design, "table");
    const doc = emailEditingDocument(customized);
    doc.content[0].content![0].content![0].content![0].content![0].text = "Email cell";
    const result = applyEmailEditingDocument(customized, doc);
    expect(result.body).toEqual(design.body);
    expect(result.email.overrides.table.content![0].content![0].content![0].content![0].text).toBe("Email cell");
  });

  it("restores the original letter source when undo restores a deleted customized block", () => {
    const design = defaultDesign();
    design.body.content = [paragraph("first", "Long letter source"), paragraph("other", "Other copy")];
    const customized = customizeEmailBlock(design, "first");
    customized.email.overrides.first.content![0].text = "Short email copy";
    const originalProjection = emailEditingDocument(customized);
    const removedProjection = structuredClone(originalProjection);
    removedProjection.content.shift();
    const removed = applyEmailEditingDocument(customized, removedProjection);
    const restored = applyEmailEditingDocument(removed, originalProjection, new Map([["first", design.body.content[0]]]));
    expect(restored.body.content[0].content![0].text).toBe("Long letter source");
    expect(restored.email.overrides.first.content![0].text).toBe("Short email copy");
  });
});
