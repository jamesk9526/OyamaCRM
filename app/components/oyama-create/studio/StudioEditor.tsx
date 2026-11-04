"use client";
import { createContext, useContext, useEffect, useMemo } from "react";
import { Extension, Node, mergeAttributes, type Editor, type JSONContent } from "@tiptap/core";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { Plugin } from "@tiptap/pm/state";
import type { BrandDocument, DonorContext, StudioDesign, StudioDoc, StudioNode } from "@/server/src/oyama-create/studio/types";
import { renderStudio } from "@/server/src/oyama-create/studio/render";
import { normalizeDoc } from "@/server/src/oyama-create/studio/design";
import { STUDIO_BLOCKS } from "@/server/src/oyama-create/studio/registry";

export type StudioEditorContext = { design: StudioDesign; donor: DonorContext; brand: BrandDocument };
const PreviewContext = createContext<StudioEditorContext|null>(null);
const defaults: Record<string, unknown> = { studioId: null, level: 2, textAlign: "left", indent: 0, spacing: null, keepTogether: false, keepWithNext: false, src: "", alt: "", width: 100, height: 0, crop: "contain", focalX: 50, focalY: 50, caption: "", href: "", color: "#edf4fc", signerId: "", secondSignerId: "", closing: "", field: "name", operator: "is", value: "true", basis: "fixed", amounts: [], multipliers: [1,1.5,2], fallback: [], minimum: 1, maximum: 100000, rounding: 5, label: "", mode: "summary", statement: "", size: 96, html: "", printOnly: false, emailOnly: false };
const attributes = () => Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, { default: value }]));
function AtomicBlock({ node, selected, extension }: NodeViewProps) {
  const preview = useContext(PreviewContext);
  const context = preview || extension.options.context.current as StudioEditorContext;
  const design = { ...context.design, body: { type: "doc", content: [node.toJSON() as StudioNode] } } as StudioDesign;
  const result = renderStudio(design, context.donor, context.brand, { channel: "LETTER", sample: !context.donor.available });
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
  const image = Image.extend({ addOptions() { return { ...this.parent!(), context }; }, addAttributes() { return { ...attributes(), ...this.parent?.() }; }, addNodeView() { return ReactNodeViewRenderer(AtomicBlock); } }).configure({ allowBase64: false });
  const wrappers = ["studioGroup", "studioCallout", "studioImpact", "studioCondition", "studioColumns", "studioColumn"].map(name => Node.create({ name, group: "block", content: name === "studioColumns" ? "studioColumn{2,3}" : "block+", defining: true, addAttributes: attributes, parseHTML: () => [{ tag: `div[data-studio-kind="${name}"]` }], renderHTML: ({ HTMLAttributes,node }) => ["div", mergeAttributes(HTMLAttributes, { "data-studio-kind": name, class: `cs-wrapper cs-${name}`, ...(["studioCallout","studioImpact"].includes(name)?{style:`background:${/^#[a-f0-9]{6}$/i.test(node.attrs.color)?node.attrs.color:"#edf4fc"};padding:12pt;border-left:3pt solid ${context.current.design.styles.primary}`}:{}) }), 0] }));
  const atoms = STUDIO_BLOCKS.filter(block => block.type.startsWith("studio") && !wrappers.some(wrapper => wrapper.name === block.type)).map(block => Node.create({ name: block.type, group: "block", atom: true, draggable: true, addOptions: () => ({ context }), addAttributes: attributes, parseHTML: () => [{ tag: `div[data-studio-kind="${block.type}"]`, getAttrs: element => { try { const data = JSON.parse((element as HTMLElement).getAttribute("data-studio-attrs") || "{}"); return normalizeDoc({ type: "doc", content: [{ type: block.type, attrs: data }] }).content[0].attrs || {}; } catch { return false; } } }], renderHTML: ({ node }) => ["div", { "data-studio-kind": block.type, "data-studio-attrs": JSON.stringify(node.attrs) }], addNodeView: () => ReactNodeViewRenderer(AtomicBlock) }));
  const legacy = Node.create({ name: "studioLegacy", group: "block", atom: true, addOptions: () => ({ context }), addAttributes: attributes, parseHTML: () => [{ tag: "div[data-studio-legacy]" }], renderHTML: () => ["div", { "data-studio-legacy": "true" }, "Preserved legacy content — review conversion"], addNodeView: () => ReactNodeViewRenderer(AtomicBlock) });
  const pageBreak = Node.create({ name: "letterPageBreak", group: "block", atom: true, addAttributes: () => ({ studioId: { default: null } }), parseHTML: () => [{ tag: "div[data-letter-page-break]" }], renderHTML: () => ["div", { "data-letter-page-break": "true", class: "cs-page-break" }] });
  const spacer = Node.create({ name: "letterSpacer", group: "block", atom: true, addAttributes: () => ({ height: { default: 12 }, studioId: { default: null } }), parseHTML: () => [{ tag: "div[data-letter-spacer]" }], renderHTML: ({ node }) => ["div", { "data-letter-spacer": "true", style: `height:${node.attrs.height}pt`, class: "cs-spacer" }] });
  return [StarterKit.configure({ link: { openOnClick: false } }), TextStyleKit, TextAlign.configure({ types: ["heading", "paragraph"] }), TableKit.configure({ table: { resizable: true } }), image, layout, identities, ...wrappers, ...atoms, legacy, pageBreak, spacer];
}
export default function StudioEditor({ initial, context, onChange, onReady, onSelect, editable = true }: { initial: StudioDoc; context: { current: StudioEditorContext }; onChange: (doc: StudioDoc) => void; onReady: (editor: Editor) => void; onSelect: (node: StudioNode | null, position: number) => void; editable?: boolean }) {
  const kit = useMemo(() => extensions(context), [context]);
  const editor = useEditor({ immediatelyRender: false, extensions: kit, content: initial as JSONContent, editable, editorProps: { attributes: { role: "textbox", "aria-label": "Studio letter content", "aria-multiline": "true", class: "studio-content cs-editable", spellcheck: "true" } }, onUpdate: ({ editor }) => onChange(editor.getJSON() as StudioDoc), onSelectionUpdate: ({ editor }) => {
    const selection = editor.state.selection; let node = "node" in selection ? selection.node as { toJSON(): unknown } : null, position = selection.from;
    if (!node) for (let depth = selection.$from.depth; depth > 0; depth--) { const candidate = selection.$from.node(depth); if (candidate.attrs.studioId) { node = candidate; position = selection.$from.before(depth); break; } }
    onSelect(node ? node.toJSON() as StudioNode : null, position);
  } });
  useEffect(() => { if (editor) onReady(editor); }, [editor, onReady]);
  useEffect(() => { editor?.setEditable(editable, false); }, [editor, editable]);
  return <PreviewContext.Provider value={context.current}><EditorContent editor={editor}/></PreviewContext.Provider>;
}
