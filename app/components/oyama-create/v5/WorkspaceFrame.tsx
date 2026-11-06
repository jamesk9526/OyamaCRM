"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { Check, Eye, FileText, Grid2X2, ImageIcon, Layers, PanelLeft, Plus, Redo2, Save, Search, Sparkles, Sun, Undo2, X } from "lucide-react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { DONOR_FIELDS, dimensions } from "@/server/src/oyama-create/studio/design";
import { tokenizeMergeText } from "@/server/src/oyama-create/studio/merge-token";
import type { StudioDesign, StudioIssue } from "@/server/src/oyama-create/studio/types";
import type { Campaign, Channel, Content } from "../types";
import { channelNames } from "../types";
import { useCreate } from "../CreateShell";
import { Modal } from "../ui";
import StudioToolbar from "../studio/StudioToolbar";
import { DEFAULT_WORKSPACE_LAYOUT, normalizeWorkspaceLayout, type WorkspaceLayout } from "./layout-state";
import type { CreateLetterSurface } from "../../letters/OyamaLettersWorkspace";
import "./workspace-v5.css";

type Props = {
  onSelectContent?:(id:string)=>void;onAddContent?:()=>void;onCampaignSettings?:()=>void; active?: boolean; campaign: Campaign; content: Content; editor: Editor | null; design: StudioDesign; readonly: boolean;
  activeChannel: Channel; saveState: string; busy: boolean; pages: number; zoom: number;
  onZoom: (zoom: number) => void; onChange: (design: StudioDesign) => void;
  onSave: () => Promise<boolean>; onAction: (action: string) => void; onChannel: (channel: Channel) => void;
  onInsert: (type: string) => void; library: ReactNode; pageInspector: ReactNode; blockInspector: ReactNode;
  notes: ReactNode; alerts: ReactNode; children: ReactNode; dialogs: ReactNode; issues: StudioIssue[];
  recipientControls: ReactNode; pieceControls: ReactNode; customized: boolean;
  formats?: Channel[];
  classic?: Pick<CreateLetterSurface, "words" | "fittedZoom" | "undo" | "redo" | "canUndo" | "canRedo" | "jumpToPage" | "toolbar" | "fields">;
};
const destinations = [
  ["Home", "/oyama-create"], ["Campaigns", "/oyama-create/campaigns"], ["Library", "/oyama-create/library"],
  ["Import originals", "/oyama-create/library/existing"], ["Audiences", "/oyama-create/audiences"], ["Calendar", "/oyama-create/calendar"],
  ["Delivery", "/oyama-create/delivery"], ["Print production", "/oyama-create/print-production"], ["History", "/oyama-create/history"],
  ["Labels & sheet settings", "/oyama-create/labels"], ["Trash", "/oyama-create/trash"], ["Results", "/oyama-create/results"], ["Settings", "/oyama-create/settings"], ["All apps", "/apps"],
];
export default function WorkspaceFrame(props: Props) {
  const { user } = useAuth(), { permissions } = useCreate(), router = useRouter();
  const root = useRef<HTMLElement>(null), hydrated = useRef(false);
  const [layout, setLayout] = useState<WorkspaceLayout>(DEFAULT_WORKSPACE_LAYOUT);
  const [tab, setTab] = useState("Home"), [navigator, setNavigator] = useState("Pages"), [inspector, setInspector] = useState("Page");
  const [menu, setMenu] = useState(false), [palette, setPalette] = useState(false), [query, setQuery] = useState("");
  const [narrow,setNarrow]=useState({left:false,right:false});
  const [fittedZoom,setFittedZoom]=useState(100);
  const [focus, setFocus] = useState(false), [overlay, setOverlay] = useState<"left" | "right" | null>(null), [currentPage, setCurrentPage] = useState(1);
  const storageKey = `oyama-create:v5:layout:${user?.organizationId}:${user?.id}`;
  const editorState = useEditorState({ editor: props.editor, selector: ({ editor }) => editor ? ({ words: editor.getText().trim().split(/\s+/).filter(Boolean).length, canUndo: editor.can().undo(), canRedo: editor.can().redo() }) : null });
  const words = props.classic?.words ?? editorState?.words ?? 0;
  const displayZoom = props.zoom || props.classic?.fittedZoom || fittedZoom;
  useEffect(() => {
    if (props.active === false) return;
    let next = DEFAULT_WORKSPACE_LAYOUT;
    try { next = normalizeWorkspaceLayout(JSON.parse(localStorage.getItem(storageKey) || "null")); } catch { /* Layout preferences are optional. Server drafts remain authoritative. */ }
    if (window.innerWidth <= 1080) next = { ...next, rightOpen: false };
    if (window.innerWidth <= 800) next = { ...next, leftOpen: false };
    setLayout(next); props.onZoom(next.zoom); hydrated.current = true;
    // A new authenticated user gets a separate local view, not a copied document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, props.active]);
  useEffect(() => { if (props.active !== false && hydrated.current) try { localStorage.setItem(storageKey, JSON.stringify({ ...layout, zoom: props.zoom })); } catch { /* Keep the layout in memory when storage is blocked. */ } }, [layout, props.zoom, storageKey, props.active]);
  useEffect(() => {
    const element = root.current; if (!element) return;
    const position = (event: Event) => setCurrentPage((event as CustomEvent<number>).detail);
    const scale=(event:Event)=>setFittedZoom((event as CustomEvent<number>).detail);
    element.addEventListener("create-page-scale",scale);element.addEventListener("create-page-position", position); return () => {element.removeEventListener("create-page-position", position);element.removeEventListener("create-page-scale",scale);};
  }, []);
  useEffect(()=>{const resize=()=>{setNarrow({left:window.innerWidth<=800,right:window.innerWidth<=1080});setOverlay(null);};resize();window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize);},[]);
  useEffect(()=>{
    const rail=[...(root.current?.querySelectorAll<HTMLElement>(".cs-page-rail")||[])].find(element=>element.offsetParent!==null);
    if(!rail)return;
    const key=`${storageKey}:viewport:${props.content.id}:${props.activeChannel}`;
    let frame=0;
    try{const saved=JSON.parse(sessionStorage.getItem(key)||"null");if(saved&&Number.isFinite(saved.top)&&Number.isFinite(saved.left))frame=requestAnimationFrame(()=>requestAnimationFrame(()=>{rail.scrollTop=saved.top;rail.scrollLeft=saved.left;}));}catch{/* Optional device-local view state. */}
    const store=()=>{try{sessionStorage.setItem(key,JSON.stringify({top:rail.scrollTop,left:rail.scrollLeft}));}catch{/* No document data is stored here. */}};
    rail.addEventListener("scroll",store);return()=>{cancelAnimationFrame(frame);store();rail.removeEventListener("scroll",store);};
  },[storageKey,props.content.id,props.activeChannel]);
  const showNavigator = useCallback((name: string) => { setNavigator(name); setLayout(value => ({ ...value, leftOpen: true })); if (window.innerWidth <= 800) setOverlay("left"); }, []);
  const showInspector = useCallback((name: string) => { setInspector(name); setLayout(value => ({ ...value, rightOpen: true })); if (window.innerWidth <= 1080) setOverlay("right"); }, []);
  const isClassic = !!props.classic;
  useEffect(() => {
    if (!isClassic || props.active === false) return;
    const open = (event: Event) => {
      const tab = (event as CustomEvent<string>).detail;
      if (tab === "Merge Fields") showNavigator("Fields");
      else showInspector(tab === "Block Settings" ? "Block" : "Page");
    };
    window.addEventListener("create-letter-pane", open);
    return () => window.removeEventListener("create-letter-pane", open);
  }, [isClassic, props.active, showInspector, showNavigator]);
  useEffect(()=>{const open=(event:Event)=>{showInspector("Page");requestAnimationFrame(()=>root.current?.querySelector<HTMLInputElement>(`[data-studio-margin="${(event as CustomEvent<string>).detail}"]`)?.focus());};window.addEventListener("create-open-page-properties",open);return()=>window.removeEventListener("create-open-page-properties",open);},[showInspector]);
  const togglePane = (side: "left" | "right") => {
    const key = side === "left" ? "leftOpen" : "rightOpen";
    if (window.innerWidth <= (side === "left" ? 800 : 1080)) { setOverlay(overlay === side ? null : side); setLayout(value => ({ ...value, [key]: overlay !== side })); }
    else setLayout(value => ({ ...value, [key]: !value[key] }));
  };
  async function navigate(href: string) { if (await props.onSave()) { setMenu(false); router.push(href); } }
  const commands = [
    { id: "save", label: "Save draft", run: () => { void props.onSave(); }, disabled: props.readonly || props.busy },
    { id: "undo", label: "Undo", run: () => props.classic ? props.classic.undo() : props.editor?.chain().focus().undo().run(), disabled: props.readonly || !(props.classic?.canUndo ?? editorState?.canUndo) },
    { id: "redo", label: "Redo", run: () => props.classic ? props.classic.redo() : props.editor?.chain().focus().redo().run(), disabled: props.readonly || !(props.classic?.canRedo ?? editorState?.canRedo) },
    { id: "preview", label: "Preview recipient & formats", run: () => props.onAction("preview") },
    { id: "review", label: "Review & prepare", run: () => props.onAction("review") },
    { id: "proof", label: "Render production PDF proof", run: () => props.onAction("proof"), disabled: !props.campaign.channelsJson.includes("LETTER") },
    { id: "pages", label: "Pages navigator", run: () => showNavigator("Pages") },
    { id: "blocks", label: "Blocks & reusable sections", run: () => showNavigator("Blocks") },
    { id: "fields", label: "Insert donor merge field", run: () => showNavigator("Fields") },
    { id: "brand", label: "Brand assets & published branding", run: () => { showNavigator("Brand"); props.onAction("assets"); } },
    { id: "layout", label: "Page, margins & print pack", run: () => showInspector("Page") },
    { id: "notes", label: "Shared internal draft notes", run: () => showInspector("Notes") },
    { id: "history", label: "Revision history", run: () => props.onAction("history") },
    { id: "html", label: "Edit or export document HTML", run: () => props.onAction("html") },
    { id: "channel-settings", label: "Channel settings & delivery date", run: () => props.onAction("channel-settings") },
    { id: "focus", label: focus ? "Exit focus view" : "Focus view", run: () => setFocus(value => !value) },
    { id:"add-content",label:"Add content piece",run:()=>props.onAddContent?.(),disabled:props.readonly||!props.onAddContent },
    { id:"campaign-settings",label:"Campaign settings & audience",run:()=>props.onCampaignSettings?.(),disabled:!props.onCampaignSettings },
    { id: "fit", label: "Fit paper to window", run: () => props.onZoom(0) },
    ...(props.classic ? [{ id: "convert", label: "Convert letter to another format", run: () => props.onAction("convert"), disabled: props.readonly }] : []),
    ...(props.classic ? [{ id: "campaign", label: "Campaign workflow", run: () => props.onAction("campaign") }] : []),
  ];
  const commandRef = useRef(commands);
  useEffect(()=>{commandRef.current=commands;});
  useEffect(() => {
    if (props.active === false) return;
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ["k", "s", "p"].includes(event.key.toLowerCase())) {
        event.preventDefault(); if (event.key.toLowerCase() === "k") { setQuery(""); setPalette(value => !value); } else { const command = commandRef.current.find(item => item.id === (event.key.toLowerCase()==="p"?"proof":"save")); if (!command?.disabled) command?.run(); }
      }
      if (event.key === "Escape") { setPalette(false); setMenu(false); setOverlay(null); }
    };
    document.addEventListener("keydown", keydown); return () => document.removeEventListener("keydown", keydown);
  }, [props.active]);
  const run = (id: string) => { const command = commands.find(item => item.id === id); if (command && !command.disabled) command.run(); };
  const divider = (side: "left" | "right") => {
    const min = side === "left" ? 180 : 225, max = side === "left" ? 390 : 460;
    const resize = (next: number) => setLayout(value => ({ ...value, [side]: Math.max(min, Math.min(max, next)) }));
    return <div className={`v5-divider v5-divider-${side}`} role="separator" aria-label={`Resize ${side === "left" ? "navigator" : "properties"}`} aria-orientation="vertical" aria-valuemin={min} aria-valuemax={max} aria-valuenow={layout[side]} title="Drag to resize · arrows to adjust · double-click to reset" tabIndex={0} onDoubleClick={() => resize(DEFAULT_WORKSPACE_LAYOUT[side])} onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); resize(event.key === "Home" ? min : event.key === "End" ? max : layout[side] + (event.key === "ArrowRight" ? 16 : -16) * (side === "left" ? 1 : -1)); } }} onPointerDown={event => { event.currentTarget.dataset.start = String(event.clientX); event.currentTarget.dataset.width = String(layout[side]); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resize(Number(event.currentTarget.dataset.width) + (event.clientX - Number(event.currentTarget.dataset.start)) * (side === "left" ? 1 : -1)); }}/>;
  };
  const jump = (page: number) => {
    if (props.classic) { setCurrentPage(page); props.classic.jumpToPage(page); }
    else root.current?.querySelector(".cs-page-rail")?.dispatchEvent(new CustomEvent("create-jump-page", { detail: page }));
  };
  const physical = dimensions(props.design.page), pageLabel = { LETTER: "US Letter", A4: "A4", LEGAL: "US Legal", HALF_LETTER: "Half Letter" }[props.design.page.paper];
  return <section hidden={props.active===false} ref={root} className={`cv5-editor ${layout.compact ? "v5-compact" : ""} ${focus ? "v5-focus" : ""}`} data-left-open={layout.leftOpen} data-right-open={layout.rightOpen} data-overlay={overlay || ""} style={{ "--v5-left": `${layout.left}px`, "--v5-right": `${layout.right}px` } as CSSProperties} aria-label="Oyama Create unified workspace">
    <header className="v5-titlebar"><button className="v5-identity" aria-label="Open Create workspace menu" aria-expanded={menu} onClick={() => setMenu(value => !value)}><span className="v5-mark">O</span><span>Oyama Create<small>Unified workspace</small></span></button><strong className="v5-document-name" title={props.content.name}>{props.content.name}</strong><span className="v5-save-state" role="status">{props.saveState}</span><button className="v5-command-search" onClick={() => { setQuery(""); setPalette(true); }}><Search size={14}/><span>Search tools & actions</span><kbd>Ctrl K</kbd></button><div className="v5-title-actions"><button aria-label="Save draft" title="Save · Ctrl+S" disabled={props.readonly || props.busy} onClick={() => run("save")}><Save size={17}/></button><button aria-label="Undo" disabled={props.readonly || !(props.classic?.canUndo ?? editorState?.canUndo)} onClick={() => run("undo")}><Undo2 size={16}/></button><button aria-label="Redo" disabled={props.readonly || !(props.classic?.canRedo ?? editorState?.canRedo)} onClick={() => run("redo")}><Redo2 size={16}/></button><button className="v5-focus-button" onClick={() => run("focus")}>{focus ? "Exit focus" : "Focus view"}</button><button className="v5-preview-button" onClick={() => run("preview")}><Eye size={14}/>Preview</button><button className="v5-primary" onClick={() => run("review")}><Check size={15}/><span>Review & prepare</span></button></div></header>
    {menu && <div className="v5-workspace-menu" role="dialog" aria-label="Create destinations"><button className="v5-close-menu" aria-label="Close workspace menu" onClick={() => setMenu(false)}><X size={16}/></button><nav aria-label="Create workspace destinations">{destinations.map(([label, href]) => <Link data-flush-draft="true" href={href} key={href} onClick={event => { event.preventDefault(); void navigate(href); }}>{label}</Link>)}{permissions.includes("letters.view") && <Link data-flush-draft="true" href="/oyama-letters" onClick={event => { event.preventDefault(); void navigate("/oyama-letters"); }}>Original Letters</Link>}{permissions.includes("view:communications") && <Link data-flush-draft="true" href="/oyama-email" onClick={event => { event.preventDefault(); void navigate("/oyama-email"); }}>Original Email</Link>}</nav></div>}
    <div className="v5-workbar"><span className="v5-breadcrumb"><Link data-flush-draft="true" href="/" onClick={event => { event.preventDefault(); void navigate("/"); }}>CRM</Link> / <Link data-flush-draft="true" href="/oyama-create" onClick={event => { event.preventDefault(); void navigate("/oyama-create"); }}>Create</Link> / Campaign workspace</span><span className="v5-document-tab"><FileText size={12}/><select aria-label="Content piece" value={props.content.id} onChange={event=>props.onSelectContent?.(event.target.value)}>{(props.campaign.contents||[props.content]).map(content=><option key={content.id} value={content.id}>{content.name}</option>)}</select><small>{props.campaign.status}</small></span><div className="v5-window-tools"><small>WINDOW</small><button aria-pressed={narrow.left?overlay==="left":layout.leftOpen} onClick={() => togglePane("left")} title="Navigator"><PanelLeft size={13}/><span>Navigator</span></button><button aria-pressed={narrow.right?overlay==="right":layout.rightOpen} onClick={() => togglePane("right")} title="Properties"><Layers size={13}/><span>Properties</span></button><i/><button aria-pressed={layout.compact} onClick={() => setLayout(value => ({ ...value, compact: !value.compact }))} title="Compact density"><Grid2X2 size={13}/><span>{layout.compact ? "Comfortable" : "Compact"}</span></button><button className="v5-reset" onClick={() => { setLayout({ ...DEFAULT_WORKSPACE_LAYOUT, rightOpen: window.innerWidth > 1080, leftOpen: window.innerWidth > 800 }); props.onZoom(0); setOverlay(null); setFocus(false); }}>Reset</button></div></div>
    <div className="v5-main"><nav className="v5-rail" aria-label="Editor navigation">{[{ name: "Home", Icon: Grid2X2 }, { name: "Pages", Icon: FileText }, { name: "Blocks", Icon: Layers }, { name: "Brand", Icon: ImageIcon }, { name: "Fields", Icon: Sparkles }].map(({ name, Icon }) => <button title={name} key={name} aria-pressed={name === navigator && layout.leftOpen} onClick={() => name === "Home" ? setMenu(value => !value) : (showNavigator(name), name === "Brand" && props.onAction("assets"))}><Icon size={17}/><span>{name}</span></button>)}<button className="v5-design-button" title="Design properties" onClick={() => showInspector("Page")}><Sun size={17}/><span>Design</span></button></nav><div className="v5-workspace-body">
      <div className="v5-ribbon-tabs"><div role="tablist" aria-label="Document ribbon">{["Home", "Insert", "Layout", "Mailings", "Review", "View"].map(name => <button role="tab" aria-selected={tab === name} aria-controls="v5-ribbon-panel" key={name} onMouseDown={event => event.preventDefault()} onClick={() => setTab(name)}>{name}</button>)}</div><div className="v5-channel-picker" role="group" aria-label="Document format">{(props.formats || props.campaign.channelsJson).map(channel => <button key={channel} aria-pressed={props.activeChannel === channel} onClick={() => props.onChannel(channel)}>{channel === "LETTER" && <FileText size={12}/>}<span>{channelNames[channel]}</span></button>)}</div></div>
      <div className="v5-ribbon-panel" id="v5-ribbon-panel" role="tabpanel" aria-label={`${tab} tools`}>
        {props.classic && ["Home", "Insert", "Layout", "Review"].includes(tab) && <div className="v5-classic-ribbon">{props.classic.toolbar(tab)}{tab === "Home" && <button className="oc-button small" type="button" disabled={props.readonly} onClick={() => run("convert")}>Convert to</button>}</div>}
        {!props.classic && ["Home", "Insert", "Layout", "Review"].includes(tab) && <StudioToolbar v5 designFont={props.design.styles.font} tab={tab} editor={props.readonly ? null : props.editor} onInsert={props.onInsert} onLayout={() => showInspector("Page")} onReview={() => run("preview")}/>}
        {tab === "Mailings" && <div className="v5-command-group">{(props.classic?["convert","fields","preview","proof","layout","channel-settings"]:["fields","preview","proof","layout","channel-settings"]).map(id => <button key={id} onClick={() => run(id)}>{commands.find(item => item.id === id)?.label}</button>)}<button onClick={() => showInspector("Review")}>Recipient & giving context</button></div>}
        {tab === "View" && <div className="v5-command-group">{["focus", "pages", "layout", "notes", "history", "html", "fit", "add-content", "campaign-settings"].map(id => <button key={id} onClick={() => run(id)}>{commands.find(item => item.id === id)?.label}</button>)}</div>}
      </div>
      {props.alerts && <div className="v5-alerts">{props.alerts}</div>}
      <div className="v5-stage">{overlay && <button className="v5-overlay-scrim" aria-label="Close supplemental panel" onClick={() => setOverlay(null)}/>}
        <aside className="v5-navigator" aria-label={`${navigator} navigator`}><div className="v5-pane-heading"><strong>{navigator}</strong><button aria-label="Close navigator" onClick={() => { setLayout(value => ({ ...value, leftOpen: false })); setOverlay(null); }}><X size={17}/></button></div><div className="v5-navigator-scroll" tabIndex={0}>
          {navigator === "Pages" && props.activeChannel!=="LETTER"&&<p>Printed pages belong to the Letter format. Use Blocks or Fields to edit this format.</p>}
          {navigator === "Pages" && props.activeChannel==="LETTER" && <><p>{props.classic ? "Pages from the recipient PDF." : "Your document, in real printed pages."}</p>{props.classic && !props.pages && <button className="oc-button small" onClick={() => run("preview")}>Render letter proof</button>}{Array.from({ length: props.pages }, (_, i) => <button className="v5-page-thumbnail" aria-current={currentPage === i + 1 ? "page" : undefined} key={i} onClick={() => { jump(i + 1); if (window.innerWidth <= 800) setOverlay(null); }}><span className="v5-thumbnail-paper"><i/><i/><i/><i/></span><span><strong>Page {i + 1}</strong><small>{props.pages === 1 ? words : "Flowing"} words</small></span></button>)}<button className="v5-text-action" disabled={props.readonly || props.activeChannel !== "LETTER"} onClick={() => props.onInsert("letterPageBreak")}>+ New page</button><p>Pages print at their selected physical size. Use Layout for margins.</p></>}
          {navigator === "Fields" && (props.classic ? props.classic.fields : <><p>Insert at your writing cursor. Preview with a permitted CRM recipient before release.</p><input type="search" aria-label="Search merge fields" placeholder="Find a merge field" value={query} onChange={event => setQuery(event.target.value)}/><div className="v5-field-list">{DONOR_FIELDS.filter(field => field.toLowerCase().includes(query.toLowerCase())).map(field => <button key={field} disabled={props.readonly || !props.editor} onMouseDown={event => event.preventDefault()} onClick={() => props.editor?.chain().focus().insertContent(props.design.version === 4 ? tokenizeMergeText(`{{${field}}}`) : `{{${field}}}`).run()}>{field}</button>)}</div></>)}
          {navigator === "Brand" && <><p>Use approved branding, assets, and signers. Existing output stays pinned to its published revision.</p><button className="oc-button" onClick={() => props.onAction("brand")}>Open Brand Hub</button>{props.library}</>}
          {navigator === "Blocks" && props.library}
        </div></aside>{divider("left")}
        <main className="v5-document-viewport"><div className="v5-desk-heading"><span><FileText size={14}/><strong>{channelNames[props.activeChannel]} editor</strong><small>{props.activeChannel === "LETTER" ? `${pageLabel} · ${props.design.page.orientation}` : "Channel adaptation"}</small></span><span className="v5-master-label">● {props.classic ? "Classic Letter" : props.customized ? "Customized format" : "Master document"}</span><button disabled={props.readonly || props.activeChannel !== "LETTER"} onMouseDown={event => event.preventDefault()} onClick={() => props.onInsert("letterPageBreak")}><Plus size={15}/>Page</button></div>{props.children}</main>
        {divider("right")}<aside className="v5-inspector" aria-label="Document properties"><div className="v5-pane-heading"><strong>Document properties<small>INSPECTOR</small></strong><button aria-label="Close properties" onClick={() => { setLayout(value => ({ ...value, rightOpen: false })); setOverlay(null); }}><X size={17}/></button></div><div className="v5-inspector-scroll" tabIndex={0}><div className="v5-inspector-tabs" role="tablist" aria-label="Properties tabs">{["Page", "Block", "Review", "Notes"].map(name => <button role="tab" aria-selected={inspector === name} key={name} onClick={() => setInspector(name)}>{name}</button>)}</div><div hidden={inspector !== "Page"}>{props.pageInspector}</div><div hidden={inspector !== "Block"}>{props.blockInspector}</div><div hidden={inspector !== "Review"}><p>Preview a recipient, review each format, then prepare the complete campaign.</p>{props.recipientControls}{props.pieceControls}{props.issues.map((issue, i) => <p className={issue.blocking ? "oc-error" : "oc-help"} key={i}>{issue.message}</p>)}<div className="v5-command-stack"><button onClick={() => run("preview")}>Compare outputs</button><button onClick={() => run("proof")}>PDF pack proof</button><button onClick={() => run("channel-settings")}>Channel settings & schedule</button><button onClick={() => props.onAction("compare-source")}>Compare original source</button>{props.customized && <><button onClick={() => props.onAction("review-adaptation")}>Mark adaptation reviewed</button><button onClick={() => props.onAction("shared")}>Return to shared content</button><button onClick={() => props.onAction("reset-adaptation")}>Review reset to shared version</button></>}<button className="v5-primary" onClick={() => run("review")}>Review & prepare</button></div></div><div hidden={inspector !== "Notes"}>{props.notes}</div></div></aside>
      </div>
      <footer className="v5-statusbar"><div><span>{props.activeChannel==="LETTER"?(props.classic&&!props.pages?"Proof pending":`${props.pages} ${props.pages===1?"page":"pages"}`):channelNames[props.activeChannel]}</span><span>{words} words</span>{props.activeChannel==="LETTER"&&<strong>Paper: {pageLabel}</strong>}<span className="v5-status-message">{props.readonly ? "Read only" : props.saveState}</span></div><div>{props.activeChannel==="LETTER"?<><button aria-label="Zoom out" onClick={() => props.onZoom(Math.max(25, (displayZoom) - 10))}>−</button><input aria-label="Document zoom" type="range" min={25} max={200} value={displayZoom} onChange={event => props.onZoom(Number(event.target.value))}/><button aria-label="Zoom in" onClick={() => props.onZoom(Math.min(200, displayZoom + 10))}>+</button><span>{displayZoom}%</span><button onClick={() => props.onZoom(0)}>Fit</button></>:<button onClick={()=>run("preview")}>Preview this format</button>}</div></footer>
    </div></div>
    {palette && <Modal title="Search tools & actions" close={() => setPalette(false)}><input className="v5-palette-search" autoFocus aria-label="Search workspace commands" placeholder="Type a command…" value={query} onChange={event => setQuery(event.target.value)}/><div className="v5-palette-results">{commands.filter(command => command.label.toLowerCase().includes(query.toLowerCase())).map(command => <button key={command.id} disabled={command.disabled} onClick={() => { setPalette(false); command.run(); }}>{command.label}</button>)}</div></Modal>}
    {props.dialogs}
    <span className="sr-only">Physical page {physical.width / 96} by {physical.height / 96} inches. Zoom changes display only.</span>
  </section>;
}
