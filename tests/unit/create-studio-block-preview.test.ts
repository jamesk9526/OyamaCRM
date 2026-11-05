import { describe, expect, it } from "vitest";
import { blockPreviewDesign } from "@/app/components/oyama-create/studio/block-preview";
import { defaultDesign } from "@/server/src/oyama-create/studio/design";
import { newBlock } from "@/server/src/oyama-create/studio/registry";
import { emptyDonor, renderStudio } from "@/server/src/oyama-create/studio/render";
import type { BrandDocument } from "@/server/src/oyama-create/studio/types";

const brand: BrandDocument = { version: 1, identity: {}, profiles: [], presets: [], signers: [], defaultSignerId: null };

describe("individual Studio block previews", () => {
  it("shows Giving summary without appending the appeal pack's reply choices", () => {
    const design = defaultDesign();
    design.pack.replySlip.enabled = true;
    design.pack.replySlip.placement = "attached";
    design.pack.replySlip.content = { type: "doc", content: [newBlock("studioResponse", "reply")] };
    const node = newBlock("studioHistory", "giving");
    design.body.content = [node];
    const donor = { ...emptyDonor(), available: true, sensitiveAllowed: true, giving: { total: 125, count: 1, largest: 125, lastAmount: 125, firstDate: null, lastDate: null, gifts: [] } };
    const block = renderStudio(blockPreviewDesign(design, node), donor, brand);
    expect(block.text).toContain("Giving in the selected period");
    expect(block.text).toContain("$125.00");
    expect(block.text).not.toContain("Yes, I want to help");
    expect(block.html).not.toContain('data-studio-id="reply"');
    expect(renderStudio(design, donor, brand).text).toContain("Yes, I want to help");
    expect(design.pack.replySlip.enabled).toBe(true);
  });

  it("keeps missing-data guidance specific to the selected block", () => {
    const design = defaultDesign();
    design.pack.replySlip.enabled = true;
    design.pack.replySlip.placement = "attached";
    design.pack.replySlip.content = { type: "doc", content: [newBlock("studioResponse", "reply")] };
    const output = renderStudio(blockPreviewDesign(design, newBlock("studioHistory", "giving")), emptyDonor(), brand);
    expect(output.issues.map(issue => issue.code)).toEqual(["DONOR_PERMISSION"]);
    expect(output.text).not.toContain("Yes, I want to help");
  });
});
