"use client";
import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { Search, ImagePlus, ChevronLeft } from "lucide-react";
import { STUDIO_BLOCKS } from "@/server/src/oyama-create/studio/registry";
import { STUDIO_PATTERNS } from "@/server/src/oyama-create/studio/patterns";
import { STUDIO_PRESETS } from "@/server/src/oyama-create/studio/presets";
import type { StudioDoc, StudioNode } from "@/server/src/oyama-create/studio/types";
import BlockIcon from "./BlockIcon";
import AssetPreview from "./AssetPreview";

type Asset = { id: string; name: string; url: string; width: number|null; height: number|null };
type Section = { id: string; name: string; documentJson: StudioDoc };
type Props = {
  editor: Editor|null; library: string; search: string; disabled: boolean; mobile: boolean;
  assets: Asset[]; sections: Section[]; assetError?: string; sectionError?: string;
  onLibrary: (value: string) => void; onSearch: (value: string) => void; onClose: () => void;
  onInsert: (type: string) => void; onPattern: (id: string) => void;
  onTemplate: (id: string) => void; onAsset: (asset: Asset) => void;
  onSection: (node: StudioNode) => void; onUpload: () => void;
};

export default function StudioLibrary(props: Props) {
  const { editor, library, search, disabled } = props;
  const outline = useEditorState({ editor, selector: ({ editor }) => {
    const rows: Array<{ id: string; position: number; title: string; depth: number; type: string }> = [];
    if (!editor || editor.isDestroyed) return rows;
    editor.state.doc.descendants((node, position) => {
      if (!node.attrs.studioId || ["tableRow", "tableCell", "tableHeader"].includes(node.type.name)) return;
      rows.push({ id: node.attrs.studioId, position, title: node.textContent.slice(0, 75) || STUDIO_BLOCKS.find(block => block.type === node.type.name)?.name || node.type.name, depth: editor.state.doc.resolve(position).depth, type: node.type.name });
    });
    return rows;
  } }) || [];
  const matches = (value: string) => value.toLowerCase().includes(search.toLowerCase());
  return <aside className={`cs-library ${props.mobile ? "mobile-active" : ""}`} aria-label="Design library">
    <div className="cs-library-title"><strong>Design library</strong><button type="button" className="oc-button small cs-close-panel" onClick={props.onClose}><ChevronLeft size={13}/>Back to writing</button></div>
    <div className="cs-library-tabs">{["Blocks", "Patterns", "Outline", "Templates", "Assets", "Sections"].map(tab => <button type="button" key={tab} aria-pressed={library === tab} onClick={() => props.onLibrary(tab)}>{tab}</button>)}</div>
    <label className="cs-search"><Search size={14}/><input type="search" aria-label="Search Studio tools" placeholder="Search blocks and tools" value={search} onChange={event => props.onSearch(event.target.value)}/></label>
    {library === "Blocks" && <><p className="oc-help cs-library-help">Click where the block should go on the page, then choose a block. Select it on the page to edit its settings. Donor blocks need a recipient preview to show CRM values.</p><div className="cs-blocks">{STUDIO_BLOCKS.filter(block => matches(`${block.name} ${block.category} ${block.description}`)).map(block => <button type="button" key={block.type} draggable={!disabled} onDragStart={event => event.dataTransfer.setData("application/create-studio", block.type)} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => props.onInsert(block.type)} title={block.description}><BlockIcon type={block.type}/><span><strong>{block.name}</strong><small>{block.description}</small></span></button>)}</div></>}
    {library === "Patterns" && <div className="cs-pattern-list">{STUDIO_PATTERNS.filter(pattern => matches(`${pattern.name} ${pattern.description}`)).map(pattern => <button type="button" className="cs-preset" key={pattern.id} disabled={disabled} onClick={() => props.onPattern(pattern.id)}><span className={`cs-pattern-preview cs-pattern-${pattern.id}`} aria-hidden="true"><BlockIcon type={pattern.icon}/><span className="cs-pattern-lines"><i/><i/><i/></span></span><strong>{pattern.name}</strong><span>{pattern.description}</span></button>)}</div>}
    {library === "Outline" && <nav className="cs-outline" aria-label="Document outline">{outline.filter(row => matches(row.title)).map(row => <button type="button" key={row.id} style={{ paddingLeft: 10 + Math.min(row.depth, 3) * 10 }} onClick={() => { editor?.chain().focus().setNodeSelection(row.position).scrollIntoView().run(); props.onClose(); }}><BlockIcon type={row.type}/><span>{row.title}</span></button>)}{!outline.length && <p className="oc-help">Start writing to build your document outline.</p>}</nav>}
    {library === "Templates" && STUDIO_PRESETS.filter(preset => matches(preset.name)).map(preset => <button type="button" className="cs-preset" key={preset.id} disabled={disabled} onClick={() => props.onTemplate(preset.id)}><BlockIcon type="letterPageBreak"/><strong>{preset.name}</strong><span>{preset.description}</span></button>)}
    {library === "Assets" && <><button type="button" className="oc-button" disabled={disabled} onClick={props.onUpload}><ImagePlus size={14}/>Upload image</button>{props.assetError && <p className="oc-error">{props.assetError}</p>}{props.assets.filter(asset => matches(asset.name)).map(asset => <button type="button" className="cs-asset" key={asset.id} disabled={disabled} onClick={() => props.onAsset(asset)}><AssetPreview src={asset.url} alt={asset.name} className="cs-library-preview"/><strong>{asset.name}</strong><small>{asset.width && asset.height ? `${asset.width} × ${asset.height}` : "Uploaded image"}</small></button>)}{!props.assets.length && <p className="oc-help">Upload a logo, photo or signature to your asset library.</p>}</>}
    {library === "Sections" && <>{props.sectionError && <p className="oc-error">{props.sectionError}</p>}{props.sections.filter(section => matches(section.name)).map(section => <button type="button" className="cs-preset" key={section.id} disabled={disabled} onClick={() => props.onSection(section.documentJson)}><BlockIcon type="studioGroup"/><strong>{section.name}</strong><span>Saved editable section</span></button>)}{!props.sections.length && <p className="oc-help">Select a block and choose Save section to reuse it.</p>}</>}
  </aside>;
}
