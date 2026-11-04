import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { history, undo } from "@tiptap/pm/history";
import type { Editor } from "@tiptap/core";
import { blockDestinations, deleteStudioBlock, moveStudioBlock, moveStudioSibling, studioBlocks } from "@/app/components/oyama-create/studio/block-actions";

const schema = new Schema({ nodes: {
  doc: { content: "block+" }, text: { group: "inline" },
  paragraph: { group: "block", content: "inline*", attrs: { studioId: { default: null } } },
  studioGroup: { group: "block", content: "block+", attrs: { studioId: { default: null } } },
  studioColumn: { group: "block", content: "block+", attrs: { studioId: { default: null } } },
} });
const paragraph = (id: string, text: string) => schema.node("paragraph", { studioId: id }, schema.text(text));
function fixture() {
  let state = EditorState.create({ schema, plugins: [history()], doc: schema.node("doc", null, [paragraph("first", "First paragraph"), schema.node("studioGroup", { studioId: "group" }, [paragraph("nested", "Nested copy")]), paragraph("last", "Last paragraph")]) });
  const dispatch = (transaction: Parameters<typeof state.apply>[0]) => { state = state.apply(transaction); };
  const editor = { get state() { return state; }, view: { dispatch, focus() {} } } as unknown as Editor;
  return { editor, dispatch, state: () => state };
}

describe("Studio block movement and deletion", () => {
  it("moves content into a nested group as one undoable operation and retains identities", () => {
    const { editor, dispatch, state } = fixture();
    const original = state().doc.toJSON();
    const source = studioBlocks(editor).find(block => block.node.attrs.studioId === "last")!;
    const target = blockDestinations(editor, source).find(destination => destination.label.startsWith("Inside"))!;
    expect(moveStudioBlock(editor, "last", target.position)).toBe(true);
    expect(state().doc.child(1).child(0).attrs.studioId).toBe("last");
    state().doc.check();
    expect(undo(state(), dispatch)).toBe(true);
    expect(state().doc.toJSON()).toEqual(original);
  });
  it("rejects destinations inside the moved block instead of losing nested content", () => {
    const { editor, state } = fixture();
    const group = studioBlocks(editor).find(block => block.node.attrs.studioId === "group")!;
    const original = state().doc.toJSON();
    expect(moveStudioBlock(editor, "group", group.position + 1)).toBe(false);
    expect(state().doc.toJSON()).toEqual(original);
  });
  it("moves siblings without flattening their parent and restores deleted blocks with undo", () => {
    const { editor, dispatch, state } = fixture();
    expect(moveStudioSibling(editor, "last", -1)).toBe(true);
    expect(state().doc.child(1).attrs.studioId).toBe("last");
    const moved = state().doc.toJSON();
    expect(deleteStudioBlock(editor, "group")).toBe(true);
    expect(state().doc.textContent).not.toContain("Nested copy");
    expect(undo(state(), dispatch)).toBe(true);
    expect(state().doc.toJSON()).toEqual(moved);
    state().doc.check();
  });
});
