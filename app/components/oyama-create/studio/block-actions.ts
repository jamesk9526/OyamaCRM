import type { Editor } from "@tiptap/core";
import { NodeSelection, Selection } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { STUDIO_BLOCKS } from "@/server/src/oyama-create/studio/registry";

export type BlockLocation = { position: number; node: ProseMirrorNode; depth: number; label: string };
export type BlockDestination = { position: number; label: string };

export function blockLabel(node: ProseMirrorNode): string {
  return STUDIO_BLOCKS.find(block => block.type === node.type.name)?.name || node.type.name.replace(/([A-Z])/g, " $1");
}

export function studioBlocks(editor: Editor): BlockLocation[] {
  const blocks: BlockLocation[] = [];
  editor.state.doc.descendants((node, position) => {
    if (node.attrs.studioId) blocks.push({ node, position, depth: editor.state.doc.resolve(position).depth, label: blockLabel(node) });
  });
  return blocks;
}

export function selectedStudioBlock(editor: Editor): BlockLocation | null {
  const selection = editor.state.selection;
  if (selection instanceof NodeSelection && selection.node.attrs.studioId) return { node: selection.node, position: selection.from, depth: selection.$from.depth, label: blockLabel(selection.node) };
  for (let depth = selection.$from.depth; depth > 0; depth--) {
    const node = selection.$from.node(depth);
    if (node.attrs.studioId) return { node, position: selection.$from.before(depth), depth: depth - 1, label: blockLabel(node) };
  }
  return null;
}

export function blockDestinations(editor: Editor, source: BlockLocation): BlockDestination[] {
  const destinations: BlockDestination[] = [];
  const seen = new Set<number>();
  function add(position: number, label: string) {
    if (seen.has(position) || position >= source.position && position <= source.position + source.node.nodeSize) return;
    const resolved = editor.state.doc.resolve(position);
    if (!resolved.parent.canReplaceWith(resolved.index(), resolved.index(), source.node.type)) return;
    seen.add(position);
    destinations.push({ position, label });
  }
  for (const block of studioBlocks(editor)) {
    const text = block.node.textContent.trim().slice(0, 35);
    const resolved = editor.state.doc.resolve(block.position);
    const parent = resolved.parent;
    let context = "";
    if (parent.type.name === "studioColumn" && resolved.depth > 0) {
      const columns = resolved.node(resolved.depth - 1);
      const index = resolved.index(resolved.depth - 1);
      context = ` in ${index === 0 ? "left" : index === columns.childCount - 1 ? "right" : "middle"} column`;
    }
    const label = `${text ? `${block.label} — ${text}` : block.label}${context}`;
    add(block.position, `Before ${label}`);
    if (["studioGroup", "studioColumn", "studioImpact", "studioCallout", "studioCondition"].includes(block.node.type.name)) add(block.position + 1, `Inside ${label}`);
    add(block.position + block.node.nodeSize, `After ${label}`);
  }
  return destinations;
}

function focusBlock(editor: Editor, position: number) {
  const node = editor.state.doc.nodeAt(position);
  if (!node) return;
  const selection = node.isAtom ? NodeSelection.create(editor.state.doc, position) : Selection.near(editor.state.doc.resolve(position + 1));
  editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView());
  editor.view.focus();
}

export function moveStudioBlock(editor: Editor, id: string, destination: number): boolean {
  const source = studioBlocks(editor).find(block => block.node.attrs.studioId === id);
  if (!source || !blockDestinations(editor, source).some(target => target.position === destination)) return false;
  const transaction = closeHistory(editor.state.tr).delete(source.position, source.position + source.node.nodeSize);
  const target = transaction.mapping.map(destination, destination < source.position ? -1 : 1);
  transaction.insert(target, source.node);
  editor.view.dispatch(transaction);
  focusBlock(editor, target);
  return true;
}

export function moveStudioSibling(editor: Editor, id: string, direction: -1 | 1): boolean {
  const source = studioBlocks(editor).find(block => block.node.attrs.studioId === id);
  if (!source) return false;
  const resolved = editor.state.doc.resolve(source.position), index = resolved.index(), next = index + direction;
  if (next < 0 || next >= resolved.parent.childCount) return false;
  const target = direction < 0 ? source.position - resolved.parent.child(next).nodeSize : source.position + source.node.nodeSize + resolved.parent.child(next).nodeSize;
  return moveStudioBlock(editor, id, target);
}

export function duplicateStudioBlock(editor: Editor, id: string): boolean {
  const source = studioBlocks(editor).find(block => block.node.attrs.studioId === id);
  if (!source) return false;
  const copy = source.node.toJSON();
  function identities(node: typeof copy) { if (node.attrs?.studioId) node.attrs.studioId = crypto.randomUUID(); for (const child of node.content || []) identities(child); }
  identities(copy);
  const target = source.position + source.node.nodeSize;
  const inserted = editor.chain().focus().insertContentAt(target, copy).run();
  if (inserted) focusBlock(editor, target);
  return inserted;
}

export function deleteStudioBlock(editor: Editor, id: string): boolean {
  const source = studioBlocks(editor).find(block => block.node.attrs.studioId === id);
  if (!source) return false;
  const transaction = closeHistory(editor.state.tr).delete(source.position, source.position + source.node.nodeSize);
  transaction.setSelection(Selection.near(transaction.doc.resolve(Math.min(source.position, transaction.doc.content.size))));
  editor.view.dispatch(transaction.scrollIntoView());
  editor.view.focus();
  return true;
}
