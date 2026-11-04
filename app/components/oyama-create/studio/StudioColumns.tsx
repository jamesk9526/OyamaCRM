"use client";
import { useState } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

export default function StudioColumns({ node, editor, getPos }: NodeViewProps) {
  const [preview, setPreview] = useState<{ index: number; left: number } | null>(null);
  const columns = Array.from({ length: node.childCount }, (_, index) => node.child(index));
  const total = columns.reduce((sum, column) => sum + Number(column.attrs.width || 1), 0);
  const widths = columns.map(column => Number(column.attrs.width || 1) / total * 100);
  return <NodeViewWrapper className="cs-wrapper cs-studioColumns" data-studio-id={node.attrs.studioId} style={{ position: "relative", display: "block" }}>
    <NodeViewContent className="cs-columns-content" style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}/>
    {editor.isEditable && columns.slice(0, -1).map((_column, index) => {
      const left = widths.slice(0, index + 1).reduce((sum, width) => sum + width, 0);
      return <button type="button" key={index} contentEditable={false} className="cs-column-resize-handle" aria-label={`Resize columns ${index + 1} and ${index + 2}`} title="Drag to change column widths" style={{ position: "absolute", left: `${preview?.index === index ? preview.left : left}%`, top: 0, bottom: 0 }} onPointerDown={event => {
        event.preventDefault(); event.stopPropagation();
        const handle = event.currentTarget, box = handle.parentElement!.getBoundingClientRect(), startX = event.clientX, pair = widths[index] + widths[index + 1];
        handle.setPointerCapture(event.pointerId);
        const value = (next: PointerEvent) => Math.max(10, Math.min(pair - 10, widths[index] + (next.clientX - startX) / box.width * 100));
        const move = (next: PointerEvent) => setPreview({ index, left: left - widths[index] + value(next) });
        const finish = (next: PointerEvent) => {
          const position = getPos();
          if (typeof position === "number") {
            const nextWidths = [...widths]; nextWidths[index] = value(next); nextWidths[index + 1] = pair - nextWidths[index];
            const transaction = editor.state.tr;
            node.forEach((child, offset, childIndex) => transaction.setNodeMarkup(position + 1 + offset, undefined, { ...child.attrs, width: nextWidths[childIndex] }));
            editor.view.dispatch(transaction);
          }
          cancel();
        };
        const cancel = () => { setPreview(null); handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", finish); handle.removeEventListener("pointercancel", cancel); window.removeEventListener("keydown", escape); };
        const escape = (next: KeyboardEvent) => { if (next.key === "Escape") { next.preventDefault(); cancel(); } };
        handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", finish, { once: true }); handle.addEventListener("pointercancel", cancel, { once: true }); window.addEventListener("keydown", escape);
      }}><span aria-hidden="true">⋮</span></button>;
    })}
  </NodeViewWrapper>;
}
