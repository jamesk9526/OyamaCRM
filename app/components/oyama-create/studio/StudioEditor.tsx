"use client";
import { createContext, useContext, useEffect, useMemo } from "react";
import { Extension, Node, mergeAttributes, type Editor, type JSONContent } from "@tiptap/core";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { Plugin, Selection } from "@tiptap/pm/state";
import type { BrandDocument, DonorContext, StudioDesign, StudioDoc, StudioNode } from "@/server/src/oyama-create/studio/types";
import { renderStudio } from "@/server/src/oyama-create/studio/render";
import { paginationMetrics } from "@/server/src/oyama-create/studio/layout";
import { normalizeDoc } from "@/server/src/oyama-create/studio/design";
import StudioColumns from "./StudioColumns";
import { blockPreviewDesign } from "./block-preview";
import StudioImage from "./StudioImage";
import StudioCanvasControls from "./StudioCanvasControls";
import { blockDestinations, moveStudioBlock, selectedStudioBlock, studioBlocks } from "./block-actions";
import { STUDIO_BLOCKS } from "@/server/src/oyama-create/studio/registry";

export type StudioEditorContext = { design: StudioDesign; donor: DonorContext; brand: BrandDocument; channel?: "LETTER" | "EMAIL" | "WEB" | "SOCIAL" | "SMS" };
const PreviewContext = createContext<StudioEditorContext|null>(null);
const defaults: Record<string, unknown> = { studioId: null, level: 2, textAlign: "left", indent: 0, spacing: null, keepTogether: false, keepWithNext: false, src: "", alt: "", width: 100, height: 0, crop: "contain", focalX: 50, focalY: 50, caption: "", href: "", color: "#edf4fc", signerId: "", secondSignerId: "", closing: "", field: "name", operator: "is", value: "true", basis: "fixed", amounts: [], multipliers: [1,1.5,2], fallback: [], minimum: 1, maximum: 100000, rounding: 5, label: "", mode: "summary", statement: "", size: 96, html: "", reviewedHtml: "", sourceRevisionId: "", thumbnail: "", linksJson: "[]", printOnly: false, emailOnly: false };
const attributes = () => Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, { default: value }]));
function AtomicBlock({ node, selected, extension }: NodeViewProps) {
  const preview = useContext(PreviewContext);
  const context = preview || extension.options.context.current as StudioEditorContext;
  const design = blockPreviewDesign(context.design, node.toJSON() as StudioNode);
  const result = renderStudio(design, context.donor, context.brand, { channel: context.channel || "LETTER", sample: !context.donor.available });
  const label = STUDIO_BLOCKS.find(block => block.type === node.type.name)?.name || "Preserved content";
  return <NodeViewWrapper data-studio-atomic="true" data-studio-id={node.attrs.studioId} className={`cs-atomic ${selected ? "selected" : ""}`} contentEditable={false}><span className="cs-block-label">{label}</span><div className="cs-atomic-output" dangerouslySetInnerHTML={{ __html: result.html }}/></NodeViewWrapper>;
}
function extensions(context: { current: StudioEditorContext }) {
  const layout = Extension.create({
    name: "studioLayout", addGlobalAttributes: () => [{ types: ["paragraph", "heading", "blockquote", "bulletList", "orderedList", "horizontalRule", "table", "image", "studioGroup", "studioCallout", "studioImpact", "studioCondition", "studioColumns", "studioColumn"], attributes: {
      studioId: { default: null, parseHTML: element => element.getAttribute("data-studio-id"), renderHTML: attrs => attrs.studioId ? { "data-studio-id": attrs.studioId } : {} },
      printOnly:{default:false,renderHTML:()=>({})},emailOnly:{default:false,renderHTML:()=>({})},
      indent: { default: 0, parseHTML: element => parseFloat(element.style.marginLeft || "0") / 12, renderHTML: attrs => attrs.indent ? { style: `margin-left:${attrs.indent * 12}pt` } : {} },
      spacing: { default: null, parseHTML: element => element.style.marginBottom ? parseFloat(element.style.marginBottom) : null, renderHTML: attrs => attrs.spacing != null ? { style: `margin-bottom:${attrs.spacing}pt` } : {} },
      keepTogether: { default: false, parseHTML: element => element.hasAttribute("data-keep-together"), renderHTML: attrs => attrs.keepTogether ? { "data-keep-together": "true", style: "break-inside:avoid" } : {} },
      keepWithNext: { default: false, parseHTML: element => element.hasAttribute("data-keep-with-next"), renderHTML: attrs => attrs.keepWithNext ? { "data-keep-with-next": "true", style: "break-after:avoid" } : {} },
    } }, { types: ["tableCell", "tableHeader"], attributes: { background: { default: null, parseHTML: element => element.style.backgroundColor || null, renderHTML: attrs => attrs.background ? { style: `background:${attrs.background}` } : {} }, borderColor: { default: "#c7d3df", parseHTML: element => element.style.borderColor || "#c7d3df", renderHTML: attrs => ({ style: `border-color:${attrs.borderColor}` }) } } }],
  });
  const identities = Extension.create({name:"studioIdentities",addProseMirrorPlugins(){return [new Plugin({appendTransaction(transactions,_old,state){if(!transactions.some(tr=>tr.docChanged))return null;const seen=new Set<string>();let tr=state.tr;state.doc.descendants((node,position)=>{if(!("studioId" in node.attrs))return;const id=node.attrs.studioId as string|null;if(!id||seen.has(id)){const next=crypto.randomUUID();tr=tr.setNodeMarkup(position,undefined,{...node.attrs,studioId:next});seen.add(next);}else seen.add(id);});if(!tr.docChanged)return null;tr.setMeta("addToHistory",false);return tr;}})];}});
  const image = Image.extend({ addOptions() { return { ...this.parent!(), context }; }, addAttributes() { const inherited = this.parent?.(); return { ...attributes(), ...inherited,
    width: { default: 100, parseHTML: element => { const size = element.style.width || element.style.maxWidth || element.getAttribute("width") || ""; const parsed = parseFloat(size); return Number.isFinite(parsed) ? Math.max(5, Math.min(100, size.endsWith("%") ? parsed : parsed / paginationMetrics(context.current.design).bodyWidth * 100)) : 100; }, renderHTML: attrs => ({ style: `width:${attrs.width}%;max-width:100%` }) },
    height: { default: 0 },
  }; }, addNodeView() { return ReactNodeViewRenderer(StudioImage); } }).configure({ allowBase64: false });
  const wrappers = ["studioGroup", "studioCallout", "studioImpact", "studioCondition", "studioColumns", "studioColumn"].map(name => Node.create({ name, group: "block", content: name === "studioColumns" ? "studioColumn{2,3}" : "block+", defining: true, addAttributes: attributes, parseHTML: () => [{ tag: `div[data-studio-kind="${name}"]` }], renderHTML: ({ HTMLAttributes,node }) => ["div", mergeAttributes(HTMLAttributes, { "data-studio-kind": name, class: `cs-wrapper cs-${name}`, ...(name==="studioColumn"?{style:`flex:${Number(node.attrs.width)||1} 1 0;min-width:0`}:{}), ...(["studioCallout","studioImpact"].includes(name)?{style:`background:${/^#[a-f0-9]{6}$/i.test(node.attrs.color)?node.attrs.color:"#edf4fc"};padding:12pt;border-left:3pt solid ${context.current.design.styles.primary}`}:{}) }), 0], ...(name === "studioColumns" ? { addNodeView: () => ReactNodeViewRenderer(StudioColumns) } : {}) }));
  const atoms = STUDIO_BLOCKS.filter(block => block.type.startsWith("studio") && !wrappers.some(wrapper => wrapper.name === block.type)).map(block => Node.create({ name: block.type, group: "block", atom: true, draggable: true, addOptions: () => ({ context }), addAttributes: attributes, parseHTML: () => [{ tag: `div[data-studio-kind="${block.type}"]`, getAttrs: element => { try { const data = JSON.parse((element as HTMLElement).getAttribute("data-studio-attrs") || "{}"); return normalizeDoc({ type: "doc", content: [{ type: block.type, attrs: data }] }).content[0].attrs || {}; } catch { return false; } } }], renderHTML: ({ node }) => ["div", { "data-studio-kind": block.type, "data-studio-attrs": JSON.stringify(node.attrs) }], addNodeView: () => ReactNodeViewRenderer(AtomicBlock) }));
  const legacy = Node.create({ name: "studioLegacy", group: "block", atom: true, addOptions: () => ({ context }), addAttributes: attributes, parseHTML: () => [{ tag: "div[data-studio-legacy]" }], renderHTML: () => ["div", { "data-studio-legacy": "true" }, "Preserved legacy content — review conversion"], addNodeView: () => ReactNodeViewRenderer(AtomicBlock) });
  const pageBreak = Node.create({ name: "letterPageBreak", group: "block", atom: true, addAttributes: () => ({ studioId: { default: null } }), parseHTML: () => [{ tag: "div[data-letter-page-break]" }], renderHTML: () => ["div", { "data-letter-page-break": "true", class: "cs-page-break" }] });
  const spacer = Node.create({ name: "letterSpacer", group: "block", atom: true, addAttributes: () => ({ height: { default: 12 }, studioId: { default: null } }), parseHTML: () => [{ tag: "div[data-letter-spacer]" }], renderHTML: ({ node }) => ["div", { "data-letter-spacer": "true", style: `height:${node.attrs.height}pt`, class: "cs-spacer" }] });
  return [StarterKit.configure({ link: { openOnClick: false } }), TextStyleKit, TextAlign.configure({ types: ["heading", "paragraph"] }), TableKit.configure({ table: { resizable: true } }), image, layout, identities, ...wrappers, ...atoms, legacy, pageBreak, spacer];
}
export default function StudioEditor({ initial, context, onChange, onReady, onSelect, editable = true, onInsertRequest, initialHtml }: { initial: StudioDoc; context: { current: StudioEditorContext }; onChange: (doc: StudioDoc) => void; onReady: (editor: Editor) => void; onSelect: (node: StudioNode | null, position: number) => void; editable?: boolean; onInsertRequest?: (node: StudioNode) => void; initialHtml?: string }) {
  const kit = useMemo(() => extensions(context), [context]);
  const editor = useEditor({ immediatelyRender: false, extensions: kit, content: initialHtml ?? initial as JSONContent, editable, editorProps: { attributes: { role: "textbox", "aria-label": context.current.channel === "EMAIL" ? "Studio email content" : "Studio letter content", "aria-multiline": "true", class: "studio-content cs-editable", spellcheck: "true" }, handleKeyDown(view, event) {
    if (event.key === "Escape") { delete view.dom.dataset.studioDropPosition; delete view.dom.dataset.studioDragging; view.dom.dispatchEvent(new CustomEvent("studio-drop-target", { detail: null })); }
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && view.state.selection.empty && view.state.selection.$from.parent.type.name === "paragraph" && view.state.selection.$from.parent.textContent === "") {
      event.preventDefault(); view.dom.dispatchEvent(new CustomEvent("studio-insert", { detail: view.state.selection.from })); return true;
    }
    return false;
  }, handleDOMEvents: {
    dragover(view, event) {
      if (!event.dataTransfer?.types.includes("application/studio-block") || !editor) return false;
      event.preventDefault();
      const location = view.posAtCoords({ left: event.clientX, top: event.clientY });
      if (!location) return true;
      const blocks = studioBlocks(editor);
      let target = blocks.find(block => block.position === location.inside);
      if (!target) { const resolved = view.state.doc.resolve(location.pos); for (let depth = resolved.depth; depth > 0; depth--) if (resolved.node(depth).attrs.studioId) { target = blocks.find(block => block.position === resolved.before(depth)); break; } }
      const element = target ? view.nodeDOM(target.position) : null;
      if (!(element instanceof HTMLElement) || !target) return true;
      const rect = element.getBoundingClientRect(), before = event.clientY < rect.top + rect.height / 2;
      const destination = before ? target.position : target.position + target.node.nodeSize;
      const source = blocks.find(block=>block.node.attrs.studioId===view.dom.dataset.studioDragging);
      const valid = source ? blockDestinations(editor,source).find(item=>item.position===destination) : null;
      if(!valid){delete view.dom.dataset.studioDropPosition;view.dom.dispatchEvent(new CustomEvent("studio-drop-target",{detail:null}));return true;}
      view.dom.dataset.studioDropPosition = String(destination);
      view.dom.dispatchEvent(new CustomEvent("studio-drop-target", { detail: { left: rect.left, top: before ? rect.top : rect.bottom, label: valid.label } }));
      return true;
    },
    drop(view, event) {
      const id = event.dataTransfer?.getData("application/studio-block");
      if (!id || !editor) return false;
      event.preventDefault();
      const position = view.dom.dataset.studioDropPosition === undefined ? NaN : Number(view.dom.dataset.studioDropPosition);
      if (Number.isFinite(position)) moveStudioBlock(editor, id, position);
      delete view.dom.dataset.studioDropPosition;
      view.dom.dispatchEvent(new CustomEvent("studio-drop-target", { detail: null }));
      return true;
    },
    dragleave(view, event) { if (!view.dom.contains(event.relatedTarget as globalThis.Node)) view.dom.dispatchEvent(new CustomEvent("studio-drop-target", { detail: null })); return false; },
  } }, onUpdate: ({ editor }) => onChange(editor.getJSON() as StudioDoc), onSelectionUpdate: ({ editor }) => {
    const selection = editor.state.selection; let node = "node" in selection ? selection.node as { toJSON(): unknown } : null, position = selection.from;
    if (!node) for (let depth = selection.$from.depth; depth > 0; depth--) { const candidate = selection.$from.node(depth); if (candidate.attrs.studioId) { node = candidate; position = selection.$from.before(depth); break; } }
    onSelect(node ? node.toJSON() as StudioNode : null, position);
  } });
  useEffect(() => { if (editor) onReady(editor); }, [editor, onReady]);
  useEffect(() => {
    if (!editor || editor.isDestroyed || initialHtml !== undefined) return;
    if (JSON.stringify(normalizeDoc(editor.getJSON())) === JSON.stringify(normalizeDoc(initial))) return;
    const selected = selectedStudioBlock(editor);
    const offset = selected ? editor.state.selection.from - selected.position : 0;
    const prior = editor.state.selection.from;
    editor.commands.setContent(initial as JSONContent, { emitUpdate: false });
    const restored = selected ? studioBlocks(editor).find(block => block.node.attrs.studioId === selected.node.attrs.studioId) : null;
    const position = Math.max(0, Math.min(editor.state.doc.content.size, restored ? restored.position + Math.min(offset, restored.node.nodeSize - 1) : prior));
    editor.view.dispatch(editor.state.tr.setSelection(Selection.near(editor.state.doc.resolve(position))).setMeta("addToHistory", false));
  }, [editor, initial, initialHtml]);
  useEffect(() => { editor?.setEditable(editable, false); }, [editor, editable]);
  return <PreviewContext.Provider value={context.current}><EditorContent className="cs-editor-content" editor={editor}/>{editor && editable && <StudioCanvasControls editor={editor} onInsertRequest={onInsertRequest}/>}</PreviewContext.Provider>;
}
