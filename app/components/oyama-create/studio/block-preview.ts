import type { StudioDesign, StudioNode } from "@/server/src/oyama-create/studio/types";

/** A canvas block previews only itself; attached reply slips belong to the pack. */
export function blockPreviewDesign(design: StudioDesign, node: StudioNode): StudioDesign {
  return {
    ...design,
    channels: undefined,
    body: { type: "doc", content: [node] },
    pack: { ...design.pack, replySlip: { ...design.pack.replySlip, enabled: false } },
  };
}
