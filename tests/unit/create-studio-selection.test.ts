import { describe, expect, it } from "vitest";
import type { Editor } from "@tiptap/core";
import { Schema } from "@tiptap/pm/model";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import { captureStudioSelection, restoreStudioSelection } from "@/app/components/oyama-create/studio/selection-bookmark";

const schema = new Schema({ nodes: {
  doc: { content: "block+" }, text: { group: "inline" },
  paragraph: { group: "block", content: "inline*", attrs: { studioId: { default: null } } },
  image: { group: "block", atom: true, attrs: { studioId: { default: null } } },
} });
const paragraph = (id: string, text: string) => schema.node("paragraph", { studioId: id }, text ? schema.text(text) : undefined);
function editorFor(nodes: ReturnType<typeof paragraph>[]) {
  let state = EditorState.create({ schema, doc: schema.node("doc", null, nodes) });
  return { get state() { return state; }, view: { focus() {}, dispatch: (transaction: Parameters<typeof state.apply>[0]) => { state = state.apply(transaction); } } } as unknown as Editor;
}

describe("Studio format-switch selection", () => {
  it("preserves the caret offset when preceding print content is absent in email", () => {
    const letter = editorFor([paragraph("address", "Postal address"), paragraph("copy", "Appeal paragraph")]);
    const offset = letter.state.doc.child(0).nodeSize + 8;
    letter.view.dispatch(letter.state.tr.setSelection(TextSelection.create(letter.state.doc, offset)));
    const email = editorFor([paragraph("copy", "Appeal paragraph")]);
    restoreStudioSelection(email, captureStudioSelection(letter));
    expect(email.state.selection.from).toBe(8);
  });
  it("preserves backward selections across blocks", () => {
    const source = editorFor([paragraph("first", "First paragraph"), paragraph("second", "Second paragraph")]);
    source.view.dispatch(source.state.tr.setSelection(TextSelection.create(source.state.doc, 21, 4)));
    const target = editorFor([paragraph("extra", "New"), paragraph("first", "First paragraph"), paragraph("second", "Second paragraph")]);
    restoreStudioSelection(target, captureStudioSelection(source));
    expect(target.state.selection.anchor).toBe(26);
    expect(target.state.selection.head).toBe(9);
  });
  it("clamps to a shorter customized block and preserves image selection", () => {
    const source = editorFor([paragraph("copy", "Long appeal paragraph")]);
    source.view.dispatch(source.state.tr.setSelection(TextSelection.create(source.state.doc, 15)));
    const target = editorFor([paragraph("copy", "Short")]);
    restoreStudioSelection(target, captureStudioSelection(source));
    expect(target.state.selection.from).toBe(6);
    const image = schema.node("image", { studioId: "photo" });
    const imageSource = editorFor([image, paragraph("copy", "Text")]);
    imageSource.view.dispatch(imageSource.state.tr.setSelection(NodeSelection.create(imageSource.state.doc, 0)));
    const imageTarget = editorFor([paragraph("copy", "Text"), image]);
    restoreStudioSelection(imageTarget, captureStudioSelection(imageSource));
    expect(imageTarget.state.selection).toBeInstanceOf(NodeSelection);
    expect((imageTarget.state.selection as NodeSelection).node.attrs.studioId).toBe("photo");
  });
});
