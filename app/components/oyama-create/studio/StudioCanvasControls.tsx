"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { ArrowDown, ArrowUp, Bold, Copy, GripVertical, Italic, Plus, Trash2, Underline, X } from "lucide-react";
import { STUDIO_BLOCKS, newBlock } from "@/server/src/oyama-create/studio/registry";
import type { StudioNode } from "@/server/src/oyama-create/studio/types";
import { blockDestinations, deleteStudioBlock, duplicateStudioBlock, moveStudioBlock, moveStudioSibling, selectedStudioBlock, studioBlocks } from "./block-actions";

export default function StudioCanvasControls({ editor, onInsertRequest }: { editor: Editor; onInsertRequest?: (node: StudioNode) => void }) {
  const [inserting, setInserting] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [moving, setMoving] = useState(false);
  const [point, setPoint] = useState<{ left: number; top: number } | null>(null);
  const [drop, setDrop] = useState<{ left: number; top: number; label: string } | null>(null);
  const snapshot = useEditorState({ editor, selector: ({ editor }) => ({ revision: editor.state.doc, from: editor.state.selection.from, to: editor.state.selection.to, focused: editor.isFocused, editable: editor.isEditable }) });
  const selected = selectedStudioBlock(editor);
  const id = String(selected?.node.attrs.studioId || "");
  const targets = selected ? blockDestinations(editor, selected) : [];

  useEffect(() => {
    const dom = editor.view.dom;
    const insert = (event: Event) => { setQuery(""); setInserting((event as CustomEvent<number>).detail); };
    const destination = (event: Event) => setDrop((event as CustomEvent<typeof drop>).detail);
    dom.addEventListener("studio-insert", insert);
    dom.addEventListener("studio-drop-target", destination);
    return () => { dom.removeEventListener("studio-insert", insert); dom.removeEventListener("studio-drop-target", destination); };
  }, [editor]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const source = studioBlocks(editor).find(block => block.node.attrs.studioId === id);
        const element = source ? editor.view.nodeDOM(source.position) : null;
        if (!(element instanceof HTMLElement)) { setPoint(null); return; }
        const rect = element.getBoundingClientRect();
        setPoint(rect.width <= 0 || rect.height <= 0 || rect.bottom < 0 || rect.top > innerHeight ? null : { left: Math.max(8, Math.min(innerWidth - 310, rect.left)), top: Math.max(8, Math.min(innerHeight - 50, rect.top - 38)) });
      });
    };
    update(); window.addEventListener("scroll", update, true); window.addEventListener("resize", update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [editor, id, snapshot?.from, snapshot?.to, snapshot?.revision]);

  if (!snapshot?.editable) return null;
  function insert(type: string) {
    if (inserting === null) return;
    const node = newBlock(type, crypto.randomUUID());
    editor.chain().focus().insertContentAt(inserting, node).run();
    setInserting(null);
    onInsertRequest?.(node);
  }
  const tool = (label: string, Icon: typeof Plus, run: () => void) => <button type="button" className="cs-tool" aria-label={label} title={label} onMouseDown={event => event.preventDefault()} onClick={run}><Icon size={15}/></button>;
  return createPortal(<>
    {point && selected && (snapshot.focused || moving || inserting !== null) && <div className="cs-canvas-block-tools" role="toolbar" aria-label="Selected block actions" style={{ position: "fixed", zIndex: 90, left: point.left, top: point.top }}>
      {snapshot.from !== snapshot.to && !selected.node.isAtom && <>{tool("Bold selected text", Bold, () => { editor.chain().focus().toggleBold().run(); })}{tool("Italic selected text", Italic, () => { editor.chain().focus().toggleItalic().run(); })}{tool("Underline selected text", Underline, () => { editor.chain().focus().toggleUnderline().run(); })}</>}
      <button type="button" className="cs-tool" draggable aria-label={`Drag ${selected.label}`} title={`Drag ${selected.label}`} onDragStart={event => { event.dataTransfer.setData("application/studio-block", id); event.dataTransfer.effectAllowed = "move"; editor.view.dom.setAttribute("data-studio-dragging", id); }} onDragEnd={() => { setDrop(null); editor.view.dom.removeAttribute("data-studio-dragging"); editor.view.dom.removeAttribute("data-studio-drop-position"); }}><GripVertical size={15}/></button>
      {tool("Insert after selected block", Plus, () => { setQuery(""); setInserting(selected.position + selected.node.nodeSize); })}
      {tool("Move selected block up", ArrowUp, () => { moveStudioSibling(editor, id, -1); })}
      {tool("Move selected block down", ArrowDown, () => { moveStudioSibling(editor, id, 1); })}
      {tool("Duplicate selected block", Copy, () => { duplicateStudioBlock(editor, id); })}
      {tool("Remove selected block", Trash2, () => { deleteStudioBlock(editor, id); })}
      <button type="button" className="oc-button small" aria-expanded={moving} onMouseDown={event => event.preventDefault()} onClick={() => setMoving(value => !value)}>Move to…</button>
      {moving && <div className="cs-canvas-move-menu"><label>Destination<select aria-label="Block destination" value="" onChange={event => { if (event.target.value !== "") { moveStudioBlock(editor, id, Number(event.target.value)); setMoving(false); } }}><option value="">Choose placement…</option>{targets.map(target => <option value={target.position} key={target.position}>{target.label}</option>)}</select></label><button type="button" className="oc-button small" onClick={() => { setMoving(false); editor.commands.focus(); }}>Cancel move</button></div>}
    </div>}
    {drop && <div className="cs-canvas-drop-target" role="status" style={{ position: "fixed", zIndex: 95, left: Math.max(8, drop.left), top: drop.top, pointerEvents: "none" }}>{drop.label}</div>}
    {inserting !== null && <div className="cs-canvas-insert-menu" role="dialog" aria-modal="false" aria-label="Insert a block" style={{ position: "fixed", zIndex: 100, top: point ? Math.min(innerHeight - 360, point.top + 38) : 160, left: point?.left || 30 }} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); setInserting(null); editor.commands.focus(); } }}>
      <div><strong>Insert a block</strong><button type="button" className="cs-tool" aria-label="Close block insertion" onClick={() => { setInserting(null); editor.commands.focus(); }}><X size={15}/></button></div>
      <input autoFocus aria-label="Search canvas blocks" placeholder="Search blocks…" value={query} onChange={event => setQuery(event.target.value)}/>
      <div className="cs-canvas-insert-results">{STUDIO_BLOCKS.filter(block => `${block.name} ${block.category}`.toLowerCase().includes(query.toLowerCase())).map(block => <button type="button" key={block.type} onClick={() => insert(block.type)}><Plus size={14}/><span>{block.name}<small>{block.category}</small></span></button>)}</div>
    </div>}
  </>, document.body);
}
