import { normalizeDesign } from "./design.js";
import { tokenizeMergeText } from "./merge-token.js";
import type { StudioDesign, StudioNode, StudioDoc } from "./types.js";
export { tokenizeMergeText } from "./merge-token.js";
/** New draft projection only: source records and previous revision JSON remain intact. */
export function upgradeUnifiedDesign(source: StudioDesign): StudioDesign {
  const design = structuredClone(source);
  const upgrade = (node: StudioNode): StudioNode => ({ ...node, ...(node.content ? { content: node.content.flatMap(child => child.type === "text" ? tokenizeMergeText(child.text || "", child.marks) : [upgrade(child)]) } : {}) });
  design.version = 4; design.body = upgrade(design.body) as StudioDoc;
  for (const region of Object.values(design.regions)) region.content = upgrade(region.content) as StudioDoc;
  design.pack.replySlip.content = upgrade(design.pack.replySlip.content) as StudioDoc;
  for (const channel of Object.values(design.channels || {})) channel.document = upgrade(channel.document) as StudioDoc;
  for (const [id, node] of Object.entries(design.email.overrides)) design.email.overrides[id] = upgrade(node);
  return normalizeDesign(design);
}
