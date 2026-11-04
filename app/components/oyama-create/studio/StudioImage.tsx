"use client";
/* eslint-disable @next/next/no-img-element -- Authored images retain their original upload bytes. */
import { useEffect, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

export default function StudioImage({ node, selected, updateAttributes, editor }: NodeViewProps) {
  const [resizing, setResizing] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [node.attrs.src]);
  const width = resizing ?? Number(node.attrs.width || 100);
  return <NodeViewWrapper as="figure" data-studio-atomic="true" data-studio-id={node.attrs.studioId} className={`cs-canvas-image ${selected ? "selected" : ""}`} style={{ width: `${width}%`, marginLeft: node.attrs.textAlign === "right" || node.attrs.textAlign === "center" ? "auto" : 0, marginRight: node.attrs.textAlign === "center" ? "auto" : 0 }} contentEditable={false}>
    <div className="cs-canvas-image-frame" style={{ position: "relative" }}>
      {node.attrs.src && !failed ? <img src={node.attrs.src} alt={node.attrs.alt || ""} draggable={false} onError={() => setFailed(true)} style={{ display: "block", width: "100%", height: node.attrs.height ? `${node.attrs.height}px` : "auto", objectFit: node.attrs.crop === "cover" ? "cover" : "contain", objectPosition: `${node.attrs.focalX ?? 50}% ${node.attrs.focalY ?? 50}%` }}/> : <div className="cs-image-placeholder">{failed ? "Image unavailable. Replace it in Image settings." : "Select this block, then choose an uploaded image."}</div>}
      {selected && editor.isEditable && <button type="button" className="cs-image-resize-handle" aria-label="Resize image proportionally" title="Drag to resize image" onPointerDown={event => {
        event.preventDefault(); event.stopPropagation();
        const handle = event.currentTarget, figure = handle.closest("figure");
        if (!figure) return;
        const startX = event.clientX, original = Number(node.attrs.width || 100), container = figure.getBoundingClientRect().width / original * 100;
        handle.setPointerCapture(event.pointerId);
        const move = (next: PointerEvent) => setResizing(Math.max(5, Math.min(100, Math.round(original + (next.clientX - startX) / container * 100))));
        const finish = (next: PointerEvent) => { updateAttributes({ width: Math.max(5, Math.min(100, Math.round(original + (next.clientX - startX) / container * 100))), height: 0 }); setResizing(null); cleanup(); };
        const cancel = () => { setResizing(null); cleanup(); };
        const escape = (next: KeyboardEvent) => { if (next.key === "Escape") { next.preventDefault(); cancel(); } };
        const cleanup = () => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", finish); handle.removeEventListener("pointercancel", cancel); window.removeEventListener("keydown", escape); };
        handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", finish, { once: true }); handle.addEventListener("pointercancel", cancel, { once: true }); window.addEventListener("keydown", escape);
      }}>↘</button>}
    </div>
    {(selected || node.attrs.caption) && <input className="cs-canvas-caption" aria-label="Image caption" readOnly={!editor.isEditable} placeholder="Write a caption…" value={String(node.attrs.caption || "")} onChange={event => updateAttributes({ caption: event.target.value })}/>}
    {selected && editor.isEditable && <label className="cs-canvas-image-width">Image width <input aria-label="Image width percent" type="range" min={5} max={100} value={width} onChange={event => updateAttributes({ width: Number(event.target.value), height: 0 })}/><span>{width}%</span></label>}
  </NodeViewWrapper>;
}
