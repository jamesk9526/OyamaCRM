import type { Editor } from "@tiptap/core";
import { NodeSelection, Selection, TextSelection } from "@tiptap/pm/state";
import type { Node as DocumentNode, ResolvedPos } from "@tiptap/pm/model";

type Point = { blockId: string; offset: number; position: number };
export type StudioSelectionBookmark = { anchor: Point; head: Point; nodeId: string | null };

function capturePoint(position: ResolvedPos): Point {
  for (let depth = position.depth; depth > 0; depth--) {
    const node = position.node(depth);
    if (node.attrs.studioId) return { blockId: node.attrs.studioId, offset: position.pos - position.before(depth), position: position.pos };
  }
  return { blockId: "", offset: 0, position: position.pos };
}

/** Stable block identities preserve the caret even when a channel omits preceding print blocks. */
export function captureStudioSelection(editor: Editor): StudioSelectionBookmark {
  const selection = editor.state.selection;
  return {
    anchor: capturePoint(selection.$anchor), head: capturePoint(selection.$head),
    nodeId: selection instanceof NodeSelection ? selection.node.attrs.studioId || null : null,
  };
}

function findBlock(document: DocumentNode, id: string) {
  let found: { node: DocumentNode; position: number } | null = null;
  document.descendants((node, position) => {
    if (!found && node.attrs.studioId === id) found = { node, position };
    return !found;
  });
  return found as { node: DocumentNode; position: number } | null;
}

function resolvePoint(document: DocumentNode, point: Point): ResolvedPos {
  const block = point.blockId ? findBlock(document, point.blockId) : null;
  const position = block ? block.position + Math.max(1, Math.min(point.offset, block.node.nodeSize - 1)) : point.position;
  return document.resolve(Math.max(0, Math.min(position, document.content.size)));
}

export function restoreStudioSelection(editor: Editor, bookmark: StudioSelectionBookmark) {
  const document = editor.state.doc;
  const selected = bookmark.nodeId ? findBlock(document, bookmark.nodeId) : null;
  const selection = selected && NodeSelection.isSelectable(selected.node)
    ? NodeSelection.create(document, selected.position)
    : bookmark.nodeId
      ? Selection.near(resolvePoint(document, bookmark.anchor))
      : TextSelection.between(resolvePoint(document, bookmark.anchor), resolvePoint(document, bookmark.head));
  editor.view.dispatch(editor.state.tr.setSelection(selection).setMeta("addToHistory", false));
  editor.view.focus();
}
