import { sourceIdentity, walkNodes } from "./design.js";
import type { StudioDesign, StudioDoc, StudioNode } from "./types.js";

export function studioNodeId(node: StudioNode): string {
  return typeof node.attrs?.studioId === "string" ? node.attrs.studioId : "";
}

/** Editable email projection retains print-only nodes so editing email cannot erase print content. */
export function emailEditingDocument(design: StudioDesign): StudioDoc {
  function project(node: StudioNode): StudioNode {
    const id = studioNodeId(node);
    const source = id && design.email.overrides[id] || node;
    return { ...structuredClone(source), ...(source.content ? { content: source.content.map(project) } : {}) };
  }
  return project(design.body) as StudioDoc;
}

/** Route protected edits into the override while retaining its original shared source. */
export function applyEmailEditingDocument(design: StudioDesign, edited: StudioDoc, retainedSources?: ReadonlyMap<string, StudioNode>): StudioDesign {
  const shared = new Map(retainedSources);
  for (const node of walkNodes(design.body)) if (studioNodeId(node)) shared.set(studioNodeId(node), node);
  const overrides = structuredClone(design.email.overrides);
  function reconcile(node: StudioNode, originals = shared): StudioNode {
    const id = studioNodeId(node);
    if (id && Object.prototype.hasOwnProperty.call(overrides, id)) {
      const previous = overrides[id];
      const protectedSources = new Map(walkNodes(previous).map(child => [studioNodeId(child), child]));
      overrides[id] = { ...structuredClone(node), ...(node.content ? { content: node.content.map(child => reconcile(child, protectedSources)) } : {}) };
      const original = originals.get(id);
      if (original) return structuredClone(original);
    }
    return { ...structuredClone(node), ...(node.content ? { content: node.content.map(child => reconcile(child, originals)) } : {}) };
  }
  return { ...design, body: reconcile(edited) as StudioDoc, email: { ...design.email, overrides } };
}

export function emailOverrideForSelection(design: StudioDesign, selectedId: string): string | null {
  if (Object.prototype.hasOwnProperty.call(design.email.overrides, selectedId)) return selectedId;
  for (const [id, node] of Object.entries(design.email.overrides)) {
    if (walkNodes(node).some(child => studioNodeId(child) === selectedId)) return id;
  }
  return null;
}

export function customizeEmailBlock(design: StudioDesign, id: string): StudioDesign {
  const node = walkNodes(design.body).find(item => studioNodeId(item) === id);
  if (!node || emailOverrideForSelection(design, id)) return design;
  const hadOverrides = Object.keys(design.email.overrides).length > 0;
  return { ...design, email: { ...design.email, overrides: { ...design.email.overrides, [id]: structuredClone(node) }, reviewedSource: hadOverrides ? design.email.reviewedSource : sourceIdentity(design) } };
}

export function relinkEmailBlock(design: StudioDesign, id: string): StudioDesign {
  const overrides = { ...design.email.overrides };
  delete overrides[id];
  return { ...design, email: { ...design.email, overrides } };
}
