"use client";
import dynamic from "next/dynamic";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import { FileText, Mail, Save, Eye, History, Paintbrush, PanelLeft, Columns2, Code2, X, PanelRightOpen } from "lucide-react";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import { useCreateData } from "../use-create-data";
import { useDraftGuard } from "../use-draft-guard";
import { message, type Campaign, type Content } from "../types";
import { Modal } from "../ui";
import ContentImportNotice from "../ContentImportNotice";
import ChannelPreview from "./ChannelPreview";
import HtmlDocumentEditor, { type HtmlSession } from "./HtmlDocumentEditor";
import ChannelEditor from "../ChannelEditor";
import { channelNames, type Channel, type VariantDocument } from "../types";
import { sourceIdentity } from "@/server/src/oyama-create/studio/design";
import { emailEditingDocument } from "@/server/src/oyama-create/studio/email-document";
import type { EditorHandle } from "../SharedEditor";
import type { ArtifactKind, BrandDocument, DonorContext, StudioDesign, StudioDoc, StudioNode, StudioRender } from "@/server/src/oyama-create/studio/types";

import { defaultDesign, emailReviewRequired, normalizeDoc, walkNodes } from "@/server/src/oyama-create/studio/design";
import { emptyDonor, renderStudio, renderRegion } from "@/server/src/oyama-create/studio/render";
import { newBlock, paragraph, STUDIO_BLOCKS } from "@/server/src/oyama-create/studio/registry";
import { STUDIO_PRESETS, studioPreset } from "@/server/src/oyama-create/studio/presets";
import StudioEditor, { type StudioEditorContext } from "./StudioEditor";
import StudioToolbar from "./StudioToolbar";
import PagedCanvas from "./PagedCanvas";
import StudioEmailCanvas from "./StudioEmailCanvas";
import { captureStudioSelection, restoreStudioSelection, type StudioSelectionBookmark } from "./selection-bookmark";
import StudioLibrary from "./StudioLibrary";
import { studioPattern } from "@/server/src/oyama-create/studio/patterns";
import StudioEmailSettings from "./StudioEmailSettings";
import BrandRevisionUpdate from "./BrandRevisionUpdate";
import BlockInspector from "./BlockInspector";
import DesignInspector from "./DesignInspector";
import "./studio.css";
import { useCreate } from "../CreateShell";
import WorkspaceFrame from "../v5/WorkspaceFrame";
import PageProperties from "../v5/PageProperties";
import OriginalSourceNames from "../OriginalSourceNames";
import SourceComparison from "../v5/SourceComparison";
import ContentNotes from "../v5/ContentNotes";
import { designFonts } from "@/server/src/oyama-create/studio/fonts";
import { upgradeUnifiedDesign } from "@/server/src/oyama-create/studio/unified-document";
const ProofViewer = dynamic(()=>import("@/app/components/letters/production/LetterProofViewer"),{ssr:false});
const BrandHub = dynamic(()=>import("./BrandHub"),{ssr:false});
type State = { design: StudioDesign|null; proposed:StudioDesign; originalHtml:string|null; brand:BrandDocument; latestBrandId:string|null; contentRevision:number; campaignRevision:number; legacyChanges?:Array<{channel:string;variantRevision:number;fingerprint:string;html:string}>; canEdit:boolean; hasEmail:boolean };
type Asset = {id:string;name:string;url:string;width:number|null;height:number|null};
type Recipient = {id:string;firstName:string;lastName:string;displayName:string|null;organizationName:string|null};
type ProofFailure = { message: string; kind: ArtifactKind | "ALL"; margin?: "top" | "bottom" };
const pieceNames: Record<ArtifactKind,string> = {LETTER:"Letter",REPLY_SLIP:"Reply Slip",OUTER_ENVELOPE:"Outer Envelope",RETURN_ENVELOPE:"Return Envelope"};
type ClassicHost = { channel: Exclude<Channel, "LETTER">; onChannel: (channel: Channel) => void; onLetterUpdate: (channel: Exclude<Channel, "LETTER">) => Promise<void> };
const StudioWorkspace = forwardRef<EditorHandle,{content:Content;campaign:Campaign;onSaved:()=>Promise<unknown>;onDirty:(dirty:boolean)=>void;onReview:()=>void;active?:boolean;onSelectContent?:(id:string)=>void;onAddContent?:()=>void;onCampaignSettings?:()=>void;classicHost?:ClassicHost}>(function StudioWorkspace({content,campaign,onSaved,onDirty,onReview,active=true,onSelectContent,onAddContent,onCampaignSettings,classicHost},ref){
  const {shellEnabled,unifiedEditorEnabled}=useCreate();
  const v5=shellEnabled===true || !!classicHost;
  const hostChannel=classicHost?.channel;
  const formats=classicHost?campaign.channelsJson.filter(channel=>content.variants.some(variant=>variant.channel===channel)):campaign.channelsJson;
  const [sourceComparison,setSourceComparison]=useState(false);
  const [v5Preview,setV5Preview]=useState(false),[notesDirty,setNotesDirty]=useState(false);
  const notesRef=useRef<EditorHandle|null>(null);
  const resource=useCreateData<State>(`/api/oyama-create/contents/${content.id}/studio`), assets=useCreateData<Asset[]>("/api/oyama-create/studio/assets"), sections=useCreateData<Array<{id:string;name:string;documentJson:StudioDoc}>>("/api/oyama-create/studio/sections");
  const canEdit=resource.data?.canEdit===true&&(!classicHost||campaign.status==="DRAFT");
  const [design,setDesign]=useState<StudioDesign|null>(null), [brand,setBrand]=useState<BrandDocument|null>(null), [donor,setDonor]=useState<DonorContext>(emptyDonor());
  const draft=useRef<StudioDesign|null>(null), dirtyRef=useRef(false), edits=useRef(0), revisions=useRef({content:content.revision,campaign:campaign.revision}), saving=useRef<Promise<boolean>|null>(null), savedCallback=useRef(onSaved); savedCallback.current=onSaved;
  const [settingsDirty,setSettingsDirty]=useState(false);
  const [htmlSession,setHtmlSession]=useState<HtmlSession|null>(null),[htmlDirty,setHtmlDirty]=useState(false),[htmlProjection,setHtmlProjection]=useState<StudioDesign|null>(null),[htmlPending,setHtmlPending]=useState(false);
  const htmlEditorRef=useRef<EditorHandle|null>(null);
  const projectHtml=useCallback((value:StudioDesign|null,pending:boolean)=>{if(value||!pending)setHtmlProjection(value);setHtmlPending(pending);},[]);
  const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[epoch,setEpoch]=useState(0),[letterEditor,setLetterEditor]=useState<Editor|null>(null),[emailEditor,setEmailEditor]=useState<Editor|null>(null),[selected,setSelected]=useState<{node:StudioNode;position:number}|null>(null);
  const [saveError, setSaveError] = useState(""), [proofError, setProofError] = useState<ProofFailure | null>(null);
  const proofInProgress = useRef(false);
  const [view,setView]=useState<"LETTER"|"EMAIL">(!classicHost&&campaign.channelsJson.includes("LETTER")?"LETTER":campaign.channelsJson.includes("EMAIL")?"EMAIL":"LETTER"),[piece,setPiece]=useState<ArtifactKind>("LETTER"),[region,setRegion]=useState<keyof StudioDesign["regions"]|null>(null),[library,setLibrary]=useState("Blocks"),[search,setSearch]=useState(""),[zoom,setZoom]=useState(0),[pages,setPages]=useState(1),[preview,setPreview]=useState<StudioRender|null>(null),[previewMode,setPreviewMode]=useState("desktop");
  const [recipientSearch,setRecipientSearch]=useState(""),[recipient,setRecipient]=useState(""),[proof,setProof]=useState<string|null>(null),[emailSettings,setEmailSettings]=useState(false),[legacyReview,setLegacyReview]=useState<NonNullable<State["legacyChanges"]>[number]|null>(null),[brandUpdate,setBrandUpdate]=useState(false),[brandOpen,setBrandOpen]=useState(false),[historyOpen,setHistoryOpen]=useState(false),[savingSection,setSavingSection]=useState<StudioNode|null>(null),[sectionName,setSectionName]=useState(""),[mobilePanel,setMobilePanel]=useState("write");
  const recipients=useCreateData<Recipient[]>(`/api/oyama-create/studio/recipients?q=${encodeURIComponent(recipientSearch)}`), gifts=useCreateData<Array<{id:string;amount:number;date:string;receiptNumber:string|null}>>(recipient?`/api/oyama-create/studio/recipients/${recipient}/gifts`:null), history=useCreateData<Array<{id:string;revision:number;documentJson:{studio?:StudioDesign;originalLetter?:{html:string;subject:string;templateId:string}};createdAt:string}>>(historyOpen?`/api/oyama-create/contents/${content.id}/revisions`:null);
  const printFonts=useCreateData<Array<{name:string;url:string;available:boolean}>>(`/api/oyama-create/studio/fonts?${design?designFonts(design).map(name=>`font=${encodeURIComponent(name)}`).join("&"):""}`);
  const [focused,setFocused]=useState(true);
  const [editChannel,setEditChannel]=useState<Channel|null>(hostChannel || (v5&&!campaign.channelsJson.some(channel=>channel==="LETTER"||channel==="EMAIL")?campaign.channelsJson[0]:null)),[adaptationEditor,setAdaptationEditor]=useState<Editor|null>(null),[settingsChannel,setSettingsChannel]=useState<Channel|null>(null);
  const [previewCollapsed,setPreviewCollapsed]=useState(false);
  const [split,setSplit]=useState(50),[surface,setSurface]=useState("edit"),[channelDrafts,setChannelDrafts]=useState<Partial<Record<Channel,VariantDocument>>>({});
  const paneRef=useRef<HTMLDivElement>(null),channelSettingsRef=useRef<EditorHandle|null>(null);
  const adaptationContexts=useRef<Partial<Record<Channel,{current:StudioEditorContext}>>>({});
  const adaptationEditors=useRef<Partial<Record<Channel,Editor>>>({});
  const [openedAdaptations,setOpenedAdaptations]=useState<Channel[]>(editChannel?[editChannel]:[]);
  const activeAdaptation=useRef<Channel|null>(null);activeAdaptation.current=editChannel;
  const [libraryOpen,setLibraryOpen]=useState(false),[reviewOpen,setReviewOpen]=useState(false);
  const editor=editChannel?adaptationEditor:view==="LETTER"?letterEditor:emailEditor;
  const [emailOpened,setEmailOpened]=useState(view==="EMAIL"&&!classicHost);
  const selectionIdentity=useRef("");
  const handoff=useRef<{ view:"LETTER"|"EMAIL"; bookmark:StudioSelectionBookmark }|null>(null);
  const currentView=useRef(view);currentView.current=view;
  const file=useRef<HTMLInputElement>(null),imageApply=useRef<((url:string)=>void)|null>(null);
  const context=useRef<StudioEditorContext>({design:defaultDesign(),donor:emptyDonor(),brand:{version:1,identity:{},profiles:[],signers:[],presets:[],defaultSignerId:null}});
  if(design&&brand)context.current={design,donor,brand,verticalPages:v5};
  useEffect(()=>{if(resource.data&&!dirtyRef.current){let next=resource.data.design&&unifiedEditorEnabled&&!hostChannel?upgradeUnifiedDesign(resource.data.design):resource.data.design;
    if(hostChannel&&!next)next=resource.data.proposed;
    const onlyPublic=v5&&!campaign.channelsJson.some(channel=>channel==="LETTER"||channel==="EMAIL")?campaign.channelsJson[0]:null;
    if(next&&onlyPublic&&!next.channels?.[onlyPublic]){const caption=content.variants.find(item=>item.channel===onlyPublic)?.documentJson.caption;next={...next,version:next.version===4?4:3,channels:{...next.channels,[onlyPublic]:{document:caption?{type:"doc",content:[paragraph("public-copy",caption)]}:structuredClone(next.body),reviewedSource:sourceIdentity(next)}}};}
    setDesign(next);draft.current=next;setBrand(resource.data.brand);revisions.current={content:resource.data.contentRevision,campaign:resource.data.campaignRevision};}// Hydrate only an explicitly fetched revision; parent metadata reloads must not replace a saved local design.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[resource.data,unifiedEditorEnabled,v5,hostChannel]);
  useEffect(()=>{
  if(dirtyRef.current)return;
  if(hostChannel&&content.revision>revisions.current.content)void resource.reload();
  revisions.current={content:content.revision,campaign:campaign.revision};
},[content.revision,campaign.revision,hostChannel,resource.reload]);
useEffect(()=>{
  if(!hostChannel||!design||dirtyRef.current)return;
  setEditChannel(hostChannel);setOpenedAdaptations(current=>current.includes(hostChannel)?current:[...current,hostChannel]);
  setAdaptationEditor(adaptationEditors.current[hostChannel]||null);
  if(design.channels?.[hostChannel])return;
  const caption=content.variants.find(item=>item.channel===hostChannel)?.documentJson.caption||"";
  const document=hostChannel==="EMAIL"?emailEditingDocument(design):{type:"doc" as const,content:[paragraph("digital-start",caption)]};
  const next={...design,channels:{...design.channels,[hostChannel]:{document,reviewedSource:sourceIdentity(design)}}};
  draft.current=next;setDesign(next);
},[hostChannel,design,content.variants]);
  useEffect(()=>onDirty(dirty||settingsDirty||htmlDirty||notesDirty),[dirty,settingsDirty,htmlDirty,notesDirty,onDirty]);useDraftGuard(dirty||settingsDirty||htmlDirty||notesDirty);
  useEffect(()=>()=>{if(proof)URL.revokeObjectURL(proof);},[proof]);
  useEffect(()=>{const insert=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key==="/"&&document.activeElement?.closest(".cs-studio")){event.preventDefault();setLibrary("Blocks");setLibraryOpen(true);setMobilePanel("blocks");requestAnimationFrame(()=>document.querySelector<HTMLInputElement>(".cs-library .cs-search input")?.focus());}};document.addEventListener("keydown",insert);return()=>document.removeEventListener("keydown",insert);},[]);
  const change=useCallback((next:StudioDesign)=>{if(JSON.stringify(draft.current)===JSON.stringify(next))return;draft.current=next;setDesign(next);edits.current++;dirtyRef.current=true;setDirty(true);setPreview(null);setNotice("");setProofError(null);},[]);
  const save=useCallback(async(sourceMode?:"HTML")=>{
    if(saving.current)return saving.current;if(!dirtyRef.current||!draft.current)return true;
    const submitted=edits.current;setBusy(true);setSaveError("");
    const promise=(async()=>{try{const result=await apiFetch<{contentRevision:number;campaignRevision:number;design:StudioDesign}>(`/api/oyama-create/contents/${content.id}/studio`,{method:"PATCH",body:JSON.stringify({design:draft.current,revision:revisions.current.content,campaignRevision:revisions.current.campaign,sourceMode,channel:hostChannel})});revisions.current={content:result.contentRevision,campaign:result.campaignRevision};if(edits.current===submitted){draft.current=result.design;setDesign(result.design);dirtyRef.current=false;setDirty(false);setNotice("Saved to server");}await savedCallback.current();return edits.current===submitted;}catch(error){setSaveError(message(error));return false;}finally{setBusy(false);saving.current=null;}})();saving.current=promise;return promise;
  },[content.id,hostChannel]);
  const flushAll=useCallback(async()=>await save()&&(!channelSettingsRef.current||await channelSettingsRef.current.flush())&&(!htmlEditorRef.current||await htmlEditorRef.current.flush())&&(!notesRef.current||await notesRef.current.flush()),[save]);
  useImperativeHandle(ref,()=>({flush:flushAll}),[flushAll]);
  useEffect(()=>{if(!dirty||saveError)return;const timer=setTimeout(()=>void save(),1200);return()=>clearTimeout(timer);},[design,dirty,saveError,save]);
  async function convert(presetId?:string){if(!resource.data)return;setBusy(true);setError("");try{const result=await apiFetch<{design:StudioDesign;brand:BrandDocument;contentRevision:number;campaignRevision:number}>(`/api/oyama-create/contents/${content.id}/studio/convert`,{method:"POST",body:JSON.stringify({presetId,unified:unifiedEditorEnabled===true,confirm:true,campaignRevision:campaign.revision})});draft.current=result.design;setDesign(result.design);setBrand(result.brand);revisions.current={content:result.contentRevision,campaign:result.campaignRevision};setEpoch(value=>value+1);await onSaved();}catch(error){setError(message(error));}finally{setBusy(false);}}
  async function previewRecipient(channel:Channel=hostChannel||view){if(!draft.current)return;setBusy(true);setError("");try{const result=await apiFetch<StudioRender&{donor:DonorContext;brand:BrandDocument}>(`/api/oyama-create/contents/${content.id}/studio/preview`,{method:"POST",body:JSON.stringify({design:draft.current,constituentId:recipient||undefined,channel})});setDonor(result.donor);setBrand(result.brand);setPreview(result);}catch(error){setError(message(error));}finally{setBusy(false);}}
  async function renderProof(kind: ArtifactKind | "ALL" = "ALL") {
    if (proofInProgress.current) return;
    proofInProgress.current = true;
    try {
      if (!await flushAll()) return;
      setBusy(true);
      setReviewOpen(false);
      setProofError(null);
      const response = await apiFetchResponse(`/api/oyama-create/contents/${content.id}/studio/proof`, {
        method: "POST", body: JSON.stringify({ revision: revisions.current.content, constituentId: recipient || undefined, kind }),
      });
      if (!response.ok) {
        const detail = (await response.json().catch(() => null))?.error;
        const text = typeof detail?.message === "string" ? detail.message : "The PDF proof could not be rendered.";
        const margin = detail?.code === "CREATE_PRINT_READINESS" && text.includes("exceeds its reserved margin") ? (/\bfooter\b/.test(text) ? "bottom" : "top") : undefined;
        setProofError({ message: text, kind, margin });
        return;
      }
      setProof(URL.createObjectURL(await response.blob()));
      setMobilePanel("proof");
    } catch (error) {
      setProofError({ message: message(error), kind });
    } finally {
      setBusy(false);
      proofInProgress.current = false;
    }
  }
  function openMarginSettings(margin: "top" | "bottom") {
    if(v5)window.dispatchEvent(new CustomEvent("create-open-page-properties",{detail:margin}));
    setSelected(null);
    setLibraryOpen(false);
    setMobilePanel("settings");
    setSurface("edit");
    requestAnimationFrame(() => paneRef.current?.querySelector<HTMLInputElement>(`[data-studio-margin="${margin}"]`)?.focus());
  }
  function cancelHtml(){if(htmlDirty&&!window.confirm("Discard the unapplied HTML changes? Your saved visual design will remain."))return;setHtmlSession(null);setHtmlDirty(false);setHtmlProjection(null);setHtmlPending(false);}
  async function openHtml(){if(!await flushAll())return;setBusy(true);setError("");try{const session=await apiFetch<HtmlSession>(`/api/oyama-create/contents/${content.id}/studio/html`,{method:"POST",body:JSON.stringify({action:"EXPORT",scope:editChannel||"SHARED"})});setHtmlSession(session);setHtmlDirty(false);setHtmlProjection(null);setHtmlPending(false);setMobilePanel("write");setLibraryOpen(false);setSurface("edit");}catch(error){setError(message(error));}finally{setBusy(false);}}
  const ready=useCallback((value:Editor)=>setLetterEditor(value),[]);
  const select=useCallback((node:StudioNode|null,position:number)=>{if(node?.attrs?.studioId)selectionIdentity.current=String(node.attrs.studioId);setSelected(node?{node,position}:null);},[]);
  useEffect(()=>{
    if(!editor||editor.isDestroyed||handoff.current?.view!==view)return;
    const transition=handoff.current;
    const frame=requestAnimationFrame(()=>{
      if(editor.isDestroyed)return;
      restoreStudioSelection(editor,transition.bookmark);
      handoff.current=null;
    });
    return()=>cancelAnimationFrame(frame);
  },[view,editor]);
  async function switchView(next:"LETTER"|"EMAIL") {
    if(next===view)return;
    const bookmark=editor&&!editor.isDestroyed?captureStudioSelection(editor):null;
    if(!await save())return;
    handoff.current=bookmark?{view:next,bookmark}:null;
    if(next==="EMAIL")setEmailOpened(true);
    setView(next);setSelected(null);
    if(next==="EMAIL")void previewRecipient("EMAIL");
  }
  function insertPattern(id:string){if(!editor)return;const position=editor.state.selection.from;editor.chain().focus().insertContent(studioPattern(id,()=>crypto.randomUUID()) as JSONContent[]).run();editor.commands.setTextSelection(Math.min(position+1,editor.state.doc.content.size));setMobilePanel("write");}

  const edited=useCallback((doc:StudioDoc)=>{const value=draft.current;if(!value)return;if(region)change({...value,regions:{...value.regions,[region]:{...value.regions[region],mode:"custom",content:doc}}});else if(piece==="REPLY_SLIP")change({...value,pack:{...value.pack,replySlip:{...value.pack.replySlip,content:doc}}});else change({...value,body:doc});},[change,piece,region]);
  function insert(type:string) {
    if(!editor)return;
    const node=newBlock(type,crypto.randomUUID());
    const insertion=editor.chain().focus();
    // Keep a selected block; insert the next gallery choice after it.
    const inserted="node" in editor.state.selection
      ? insertion.insertContentAt(editor.state.selection.to,node as JSONContent).run()
      : insertion.insertContent(node as JSONContent).run();
    if(!inserted){setError("This block could not be inserted at the cursor. Select a position in the page and try again.");return;}
    editor.state.doc.descendants((candidate,position)=>{
      if(candidate.attrs.studioId===node.attrs?.studioId)editor.chain().setNodeSelection(position).scrollIntoView().run();
    });
    setNotice(`${STUDIO_BLOCKS.find(block=>block.type===type)?.name||"Block"} added`);
    if(type==="image")chooseImage(url=>{
      editor.state.doc.descendants((candidate,pos)=>{
        if(candidate.attrs.studioId===node.attrs?.studioId)editor.view.dispatch(editor.state.tr.setNodeMarkup(pos,undefined,{...candidate.attrs,src:url}));
      });
    });
  }
  function insertedBlock(node:StudioNode){if(node.type!=="image"||!editor)return;chooseImage(url=>{editor.state.doc.descendants((candidate,position)=>{if(candidate.attrs.studioId===node.attrs?.studioId)editor.view.dispatch(editor.state.tr.setNodeMarkup(position,undefined,{...candidate.attrs,src:url}));});});}
  function chooseImage(apply:(url:string)=>void){imageApply.current=apply;setLibrary("Assets");file.current?.click();}
  async function upload(image:File){setBusy(true);setError("");try{const encoded=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(image);});const result=await apiFetch<Asset>("/api/oyama-create/studio/assets",{method:"POST",body:JSON.stringify({name:image.name,mimeType:image.type,dataBase64:encoded})});imageApply.current?.(result.url);imageApply.current=null;await assets.reload();}catch(error){setError(message(error));}finally{setBusy(false);}}
  async function cropImage(node:StudioNode,apply:(url:string)=>void){setBusy(true);setError("");try{const image=new window.Image();image.crossOrigin="anonymous";image.src=String(node.attrs?.src||"");await image.decode();const bodyWidth=(design?.page.paper==="A4"?210/25.4:8.5)-(design?.page.margins.left||.75)-(design?.page.margins.right||.75),width=bodyWidth*96*Number(node.attrs?.width||100)/100,height=Number(node.attrs?.height||0),ratio=width/height;let sw=image.naturalWidth,sh=image.naturalHeight;if(sw/sh>ratio)sw=sh*ratio;else sh=sw/ratio;const canvas=document.createElement("canvas");canvas.width=Math.min(2400,Math.round(sw));canvas.height=Math.round(canvas.width/ratio);if(canvas.height>4000)throw new Error("This crop is too tall. Increase its width or reduce its height.");canvas.getContext("2d")!.drawImage(image,(image.naturalWidth-sw)*Number(node.attrs?.focalX??50)/100,(image.naturalHeight-sh)*Number(node.attrs?.focalY??50)/100,sw,sh,0,0,canvas.width,canvas.height);const data=canvas.toDataURL("image/png");const asset=await apiFetch<Asset>("/api/oyama-create/studio/assets",{method:"POST",body:JSON.stringify({name:"Cropped communication image",mimeType:"image/png",dataBase64:data})});apply(asset.url);await assets.reload();}catch(error){setError(message(error)+" Upload external images to the asset library before cropping.");}finally{setBusy(false);}}
  function remap(node:StudioNode){const result=structuredClone(node);for(const item of walkNodes(result))if(item.attrs?.studioId)item.attrs.studioId=crypto.randomUUID();return result;}
  function switchPiece(value:ArtifactKind){setPiece(value);setRegion(null);setSelected(null);setEpoch(value=>value+1);}
  function openRegion(value:keyof StudioDesign["regions"]|null){setRegion(value);setSelected(null);setEpoch(value=>value+1);}
  function convertOriginal(){if(!editor||!design)return;const legacy=walkNodes(design.body).find(node=>node.type==="studioLegacy");if(!legacy)return;editor.commands.setContent(String(legacy.attrs?.html||""));const doc=editor.getJSON() as StudioDoc;for(const node of walkNodes(doc))if(node.type!=="text"&&!node.attrs?.studioId)node.attrs={...node.attrs,studioId:crypto.randomUUID()};change({...design,body:normalizeDoc(doc)});setEpoch(value=>value+1);setNotice("Converted into editable content. Compare the original in revision history and review merge fields before releasing.");}
  async function saveSection(){if(!savingSection)return;try{await apiFetch("/api/oyama-create/studio/sections",{method:"POST",body:JSON.stringify({name:sectionName,document:{type:"doc",content:[savingSection]},shared:false})});setSavingSection(null);setSectionName("");await sections.reload();}catch(error){setError(message(error));}}
  if(!resource.data||!brand)return <div className="oc-state">{resource.error||"Loading Studio…"}</div>;
  if(!design)return <section className="oc-card cs-entry"><h2>Create one message. Preview every channel.</h2><p>Open your content in the unified builder or start with a preset. Shared editing and channel previews stay together; original content is retained.</p>{error&&<p className="oc-error" role="alert">{error}</p>}{resource.data.originalHtml&&<details><summary>Review original letter before conversion</summary><iframe title="Original letter conversion preview" sandbox="" srcDoc={resource.data.originalHtml}/></details>}<button className="oc-button" disabled={busy} onClick={()=>void convert()}>Open content in unified builder</button><div className="cs-preset-grid">{STUDIO_PRESETS.map(preset=><button key={preset.id} className="cs-preset" disabled={busy} onClick={()=>void convert(preset.id)}><FileText size={22}/><strong>{preset.name}</strong><span>{preset.description}</span></button>)}</div></section>;
  async function customize(channel:Channel) {
    if(!await save()||!design)return;
    if(!v5&&(channel==="SMS"||channel==="SOCIAL")){setSettingsChannel(channel);setSurface("edit");return;}
    if(!design.channels?.[channel]){
      const caption=content.variants.find(item=>item.channel===channel)?.documentJson.caption||"";
      const document=channel==="SMS"||channel==="SOCIAL"?{type:"doc" as const,content:[paragraph(crypto.randomUUID(),caption)]}:channel==="WEB"?{type:"doc" as const,content:[paragraph(crypto.randomUUID())]}:channel==="EMAIL"?emailEditingDocument(design):structuredClone(design.body);
      change({...design,version:design.version===4?4:3,channels:{...design.channels,[channel]:{document,reviewedSource:sourceIdentity(design)}}});
    }
    setOpenedAdaptations(previous=>previous.includes(channel)?previous:[...previous,channel]);
    setAdaptationEditor(adaptationEditors.current[channel]||null);
    setEditChannel(channel);setSelected(null);setSurface("edit");setMobilePanel("write");
  }
  const initial=region?design.regions[region].content:piece==="REPLY_SLIP"?design.pack.replySlip.content:design.body;

  const output=renderStudio(design,donor,brand,{channel:hostChannel||"LETTER",sample:!donor.available}),envelope=piece==="OUTER_ENVELOPE"||piece==="RETURN_ENVELOPE";
  const header:[string,string]=[renderRegion(design,donor,brand,"firstHeader"),renderRegion(design,donor,brand,"header")],footer:[string,string]=[renderRegion(design,donor,brand,"firstFooter"),renderRegion(design,donor,brand,"footer")];
  const documentSurface=<>
      {v5&&<style>{printFonts.data?.filter(font=>font.available).map(font=>`@font-face{font-family:'${font.name}';src:url('${font.url}');font-weight:100 900;font-display:swap}`).join("\n")}</style>}
      <div className="cs-document-surface" hidden={!!htmlSession}>{!classicHost&&walkNodes(design.body).some(node=>node.type==="studioLegacy")&&<div className="oc-notice">Original content is preserved. Review the converted editable version before approval.<button className="oc-button small" onClick={convertOriginal}>Review conversion</button></div>}
      {region&&<div className="oc-notice">Editing {region}. This region becomes a custom override in this design. <button className="oc-button small" onClick={()=>openRegion(null)}>Return to letter</button></div>}
      {!classicHost&&<div className="cs-visual-document" hidden={view!=="LETTER"||!!editChannel}>{envelope?<div className="cs-envelope-preview"><h3>{pieceNames[piece]}</h3><p>{piece==="OUTER_ENVELOPE"?donor.name:brand.identity.organizationDisplayName}</p><pre>{piece==="OUTER_ENVELOPE"?donor.address:[brand.identity.streetAddress1,brand.identity.city,brand.identity.stateProvince,brand.identity.postalCode].filter(Boolean).join("\n")}</pre><p className="oc-help">Set size, window and printer offsets in the inspector. Render this piece to verify its physical dimensions.</p><button className="oc-button" onClick={()=>void renderProof(piece)}>Proof this envelope</button></div>:<PagedCanvas vertical={v5} design={design} headers={region?["",""]:header} footers={region?["",""]:footer} zoom={zoom} onPages={setPages} onRegion={openRegion}><StudioEditor key={`${content.id}:${piece}:${region}:${epoch}`} initial={initial.content.length?initial:{type:"doc",content:[paragraph(crypto.randomUUID())]}} context={context} initialHtml={region&&design.regions[region].mode==="brand"?renderRegion(design,donor,brand,region,{authoring:true}):undefined} onReady={ready} onSelect={(node,position)=>{if(currentView.current==="LETTER")select(node,position);}} onChange={edited} editable={canEdit} onInsertRequest={insertedBlock}/></PagedCanvas>}</div>}
      {emailOpened&&<div className="cs-visual-document" hidden={view!=="EMAIL"||!!editChannel}><StudioEmailCanvas design={design} brand={brand} donor={donor} editable={canEdit} selectedId={selectionIdentity.current} mobile={previewMode==="mobile"} onChange={change} onReady={setEmailEditor} onSelect={(node,position)=>{if(currentView.current==="EMAIL")select(node,position);}} onInsertRequest={insertedBlock}/></div>}
      {openedAdaptations.map(channel=>{
        const adaptation=design.channels?.[channel];if(!adaptation||classicHost&&channel==="LETTER")return null;
        const ctx=adaptationContexts.current[channel]||(adaptationContexts.current[channel]={current:{design,donor,brand,channel}});
        ctx.current={design,donor,brand,channel,verticalPages:v5&&channel==="LETTER"};
        const surface=<StudioEditor key={`${content.id}:adaptation:${channel}`} initial={adaptation.document} context={ctx} onReady={value=>{adaptationEditors.current[channel]=value;if(activeAdaptation.current===channel)setAdaptationEditor(value);}} onSelect={(node,position)=>{if(activeAdaptation.current===channel)select(node,position);}} editable={canEdit} onInsertRequest={insertedBlock} onChange={document=>change({...draft.current!,channels:{...draft.current!.channels,[channel]:{...draft.current!.channels?.[channel],document,reviewedSource:null}}})}/>;
        return <div key={channel} className="cs-visual-document cs-adaptation-document" hidden={editChannel!==channel}>{v5&&channel==="LETTER"?<PagedCanvas vertical design={design} headers={header} footers={footer} zoom={zoom} onPages={setPages} onRegion={openRegion}>{surface}</PagedCanvas>:surface}</div>;
      })}
      {!classicHost&&<div className="cs-document-health"><span>{pages} editable pages</span><span>{output.issues.filter(issue=>issue.blocking).length} setup/data issues</span></div>}
    </div>{htmlSession&&<HtmlDocumentEditor ref={htmlEditorRef} contentId={content.id} session={htmlSession} readonly={!canEdit} onDirty={setHtmlDirty} onPreview={projectHtml} onCancel={cancelHtml} onApply={async value=>{change(value);const saved=await save("HTML");if(saved){setHtmlSession(null);setHtmlDirty(false);setHtmlProjection(null);setHtmlPending(false);setSelected(null);}return saved;}}/>}
  </>;
  const librarySurface=<StudioLibrary editor={editor} library={library} search={search} disabled={envelope||!canEdit} mobile={mobilePanel==="blocks"} assets={assets.data||[]} sections={sections.data||[]} assetError={assets.error} sectionError={sections.error} onLibrary={setLibrary} onSearch={setSearch} onClose={()=>{setLibraryOpen(false);setMobilePanel("write");}} onInsert={type=>{insert(type);setMobilePanel("write");}} onPattern={insertPattern} onTemplate={id=>{if(!window.confirm("Replace this draft with the selected template? Saved revisions remain available."))return;const next=studioPreset(id);next.brandRevisionId=design.brandRevisionId;if(hostChannel)change({...design,channels:{...design.channels,[hostChannel]:{document:next.body,reviewedSource:sourceIdentity(design)}}});else change(next);setEpoch(value=>value+1);}} onAsset={asset=>{if(imageApply.current){imageApply.current(asset.url);imageApply.current=null;}else editor?.chain().focus().setImage({src:asset.url,alt:asset.name}).run();setMobilePanel("write");}} onSection={doc=>editor?.chain().focus().insertContent((doc.content||[]).map(remap) as JSONContent[]).run()} onUpload={()=>chooseImage(url=>editor?.chain().focus().setImage({src:url}).run())}/>;
  const alerts=<>
    {error&&<div className="oc-error" role="alert">{error}</div>}
    {saveError&&<div className="oc-error cs-operation-alert" role="alert"><p>{saveError}</p><button className="oc-button small" onClick={()=>void save()}>Retry save</button><button className="oc-button small" onClick={()=>{const blob=new Blob([JSON.stringify(draft.current,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="studio-recovery.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Download local draft</button><button className="oc-button small" onClick={async()=>{if(!window.confirm("Reload the latest server draft? Download your local draft first if you need to keep these unsaved changes."))return;dirtyRef.current=false;setDirty(false);setSaveError("");setSelected(null);await resource.reload();setEpoch(value=>value+1);}}>Reload server draft</button></div>}
    {proofError&&<div className="oc-error cs-operation-alert" role="alert" aria-label="PDF proof warning"><p><strong>PDF proof needs attention.</strong> {proofError.message}</p>{proofError.margin&&canEdit&&<button type="button" className="oc-button small" onClick={()=>openMarginSettings(proofError.margin!)}>Adjust {proofError.margin} margin</button>}<button type="button" className="oc-button small" disabled={busy} onClick={()=>void renderProof(proofError.kind)}>Retry PDF proof</button><button type="button" className="oc-button small" onClick={()=>setProofError(null)}>Dismiss</button></div>}
    {!!resource.data.legacyChanges?.length&&<div className="oc-notice">A linked legacy version changed. Its original content is preserved; compare it with Studio before release. {resource.data.legacyChanges.map(item=><button className="oc-button small" key={item.channel} onClick={()=>setLegacyReview(item)}>Review {item.channel.toLowerCase()} difference</button>)}</div>}
    <ContentImportNotice contentId={content.id} onChanged={onSaved}/>
    {hostChannel&&content.variants.some(item=>item.channel===hostChannel&&item.letterUpdateAvailable)&&<div className="oc-notice">Letter copy changed. <button className="oc-button small" onClick={()=>void classicHost?.onLetterUpdate(hostChannel)}>Review Letter update</button></div>}
  </>;
  const dialogs=<>
    {settingsChannel&&<Modal title={`${channelNames[settingsChannel]} channel settings`} wide close={()=>void (async()=>{if(await flushAll()){setSettingsChannel(null);setSettingsDirty(false);}})()}>{content.variants.find(item=>item.channel===settingsChannel)?<><ChannelEditor ref={channelSettingsRef} content={content} campaign={campaign} variant={content.variants.find(item=>item.channel===settingsChannel)!} readonly={!canEdit} onSaved={async()=>{const state=await resource.reload();if(state)revisions.current={content:state.contentRevision,campaign:state.campaignRevision};await onSaved();}} onDirty={setSettingsDirty} onDraft={value=>setChannelDrafts(previous=>({...previous,[settingsChannel]:value}))}/>{settingsChannel==="EMAIL"&&<><label className="oc-field">Email subject<input value={design.email.subject} disabled={!canEdit} onChange={event=>change({...design,email:{...design.email,subject:event.target.value}})}/></label><label className="oc-field">Preview text<input value={design.email.previewText} disabled={!canEdit} onChange={event=>change({...design,email:{...design.email,previewText:event.target.value}})}/></label><button type="button" className="oc-button" onClick={async()=>{if(await flushAll())setEmailSettings(true);}}>Sender, compliance & test</button></>}</>:<p>Add this channel in campaign Settings before configuring delivery.</p>}</Modal>}
    {proof&&<Modal title="Appeal-pack PDF proof" wide close={()=>setProof(null)}><div className="cs-proof"><ProofViewer url={proof} stale={dirty||htmlDirty} busy={busy} label={`${content.name} · sample proof · ${recipient?donor.name||"selected recipient":"no recipient"}`}/></div></Modal>}
    {reviewOpen&&<Modal title="Review letter and email" wide close={()=>setReviewOpen(false)}><div className="oc-actions"><button type="button" className="oc-button" onClick={()=>void renderProof()}>Render recipient PDF proof</button><button type="button" className="oc-button" onClick={()=>void previewRecipient("EMAIL")}>Refresh email preview</button></div><div className="cs-review-comparison"><section><h3>Letter design</h3><div className="studio-content" dangerouslySetInnerHTML={{__html:renderStudio(design,donor,brand).html}}/></section><section><h3>Email adaptation</h3><iframe title="Studio responsive email" sandbox="" srcDoc={preview?.html||"<p>Refresh email preview to inspect this version.</p>"}/></section></div><button type="button" className="oc-button primary" onClick={async()=>{if(await save()){setReviewOpen(false);onReview();}}}>Continue to campaign review</button></Modal>}
    {emailSettings&&<Modal title="Email sender & reviewed test" close={()=>setEmailSettings(false)}><StudioEmailSettings contentId={content.id} revision={revisions.current.content} campaignRevision={revisions.current.campaign} recipient={recipient} saved={async()=>{await onSaved();await resource.reload();}}/></Modal>}
    {legacyReview&&<Modal title="Review a separate legacy edit" wide close={()=>setLegacyReview(null)}><p>The legacy version is retained in its original record. The Studio design remains the source for the next release. Compare the original carefully before keeping Studio.</p><div className="oc-grid-two"><iframe title="Preserved legacy output" sandbox="" srcDoc={legacyReview.html||"<p>No original HTML.</p>"} style={{width:"100%",height:400}}/><iframe title="Current Studio output" sandbox="" srcDoc={renderStudio(design,donor,brand).html} style={{width:"100%",height:400}}/></div><button className="oc-button primary" disabled={busy} onClick={async()=>{if(!await save())return;setBusy(true);try{await apiFetch(`/api/oyama-create/contents/${content.id}/studio/legacy-review`,{method:"POST",body:JSON.stringify({...legacyReview,html:undefined,confirm:true,campaignRevision:revisions.current.campaign})});setLegacyReview(null);await onSaved();await resource.reload();}catch(error){setError(message(error));}finally{setBusy(false);}}}>Keep reviewed Studio design; retain original legacy record</button></Modal>}
    {brandUpdate&&resource.data.latestBrandId&&<BrandRevisionUpdate design={design} brand={brand} donor={donor} latestId={resource.data.latestBrandId} close={()=>setBrandUpdate(false)} apply={next=>{setBrand(next);change({...design,brandRevisionId:resource.data!.latestBrandId});setBrandUpdate(false);}}/>}
    {brandOpen&&<Modal title="Brand Hub" close={()=>setBrandOpen(false)} wide><BrandHub embedded onPublished={()=>{setNotice("Brand published. This design remains pinned; use the brand update comparison to adopt the new revision.");void resource.reload();}}/></Modal>}
    {historyOpen&&<Modal title="Design revision history" close={()=>setHistoryOpen(false)}>{history.error&&<p className="oc-error">{history.error}</p>}{history.data?.map(item=><div className="oc-list-item" key={item.id}><div><strong>Revision {item.revision}</strong><p>{new Date(item.createdAt).toLocaleString()}</p>{item.documentJson.originalLetter&&<details><summary>Preserved original letter before Studio conversion</summary><iframe title="Original preserved letter" sandbox="" srcDoc={item.documentJson.originalLetter.html} style={{width:"100%",height:350}}/></details>}</div>{item.documentJson.studio&&<button className="oc-button small" onClick={()=>{change(item.documentJson.studio!);setEpoch(value=>value+1);setHistoryOpen(false);}}>Restore as new draft</button>}</div>)}</Modal>}
    {savingSection&&<Modal title="Save reusable section" close={()=>setSavingSection(null)}><div className="oc-form"><label>Section name<input value={sectionName} onChange={event=>setSectionName(event.target.value)} required/></label><button className="oc-button primary" disabled={!sectionName.trim()} onClick={()=>void saveSection()}>Save section</button></div></Modal>}
    {sourceComparison&&<SourceComparison contentId={content.id} close={()=>setSourceComparison(false)} changed={onSaved}/>}
    {v5Preview&&<Modal title="Recipient & channel preview" wide close={()=>setV5Preview(false)}><div className="v5-modal-preview"><ChannelPreview content={content} campaign={campaign} design={htmlProjection||design} sourcePending={!!htmlSession&&htmlPending} active recipient={recipient} formats={channelDrafts} readonly={!canEdit} onCustomize={channel=>{setV5Preview(false);if(classicHost)classicHost.onChannel(channel);else void customize(channel);}} onSettings={channel=>setSettingsChannel(channel)} onProof={kind=>void renderProof(kind)} channels={classicHost?formats.filter(channel=>channel!=="LETTER"):undefined} initialChannel={hostChannel}/></div></Modal>}
  </>;
  if(v5)return <WorkspaceFrame onSelectContent={onSelectContent} onAddContent={onAddContent} onCampaignSettings={onCampaignSettings} active={active} campaign={campaign} formats={formats} content={content} editor={editor} design={design} readonly={!canEdit} activeChannel={hostChannel||editChannel||view} saveState={busy?"Working…":htmlDirty?"Unapplied HTML":dirty?"Unsaved · autosave on":notesDirty?"Unsaved notes":`${notice||"Saved"} · r${revisions.current.content}`} busy={busy} pages={pages} zoom={zoom} onZoom={setZoom} onChange={change} onSave={flushAll} onInsert={insert} customized={!!editChannel&&!classicHost}
    onChannel={channel=>void(async()=>{if(!await flushAll())return;if(classicHost){classicHost.onChannel(channel);return;}if(channel==="LETTER"||channel==="EMAIL"){setEditChannel(null);setSelected(null);if(design.channels?.[channel]){await customize(channel);}else await switchView(channel);}else await customize(channel);})()}
    onAction={action=>{switch(action){case "proof":if(classicHost)classicHost.onChannel("LETTER");else void renderProof();break;case "preview":setV5Preview(true);break;case "review":void(async()=>{if(await flushAll())onReview();})();break;case "history":setHistoryOpen(true);break;case "html":if(htmlSession)cancelHtml();else void openHtml();break;case "brand":setBrandOpen(true);break;case "assets":setLibrary("Assets");break;case "channel-settings":setSettingsChannel(editChannel||view);break;case "compare-source":setSourceComparison(true);break;case "review-adaptation":if(editChannel)change({...design,channels:{...design.channels,[editChannel]:{...design.channels![editChannel]!,reviewedSource:sourceIdentity(design)}}});break;case "shared":setEditChannel(null);setSelected(null);break;case "reset-adaptation":if(editChannel&&window.confirm("Remove this channel customization and use shared content? Saved revisions remain available.")){const channels={...design.channels};delete channels[editChannel];change({...design,channels});setEditChannel(null);}break;}}}
    library={librarySurface}
    pageInspector={(editChannel||view)!=="LETTER"?<div className="v5-format-properties"><p>{channelNames[editChannel||view]} uses its own responsive or message layout. Printed page settings apply to Letter.</p><button className="oc-button" onClick={()=>setSettingsChannel(editChannel||view)}>Format settings & schedule</button>{(editChannel||view)==="EMAIL"&&<><button className="oc-button" onClick={()=>setEmailSettings(true)}>Sender, compliance & test</button><label>Subject<input value={design.email.subject} disabled={!canEdit} onChange={event=>change({...design,email:{...design.email,subject:event.target.value}})}/></label><label>Preview text<input value={design.email.previewText} disabled={!canEdit} onChange={event=>change({...design,email:{...design.email,previewText:event.target.value}})}/></label></>}{editChannel&&<><p>{classicHost?"This format has its own content. Review Letter updates before applying them.":"This format has its own content. Shared changes require review."}</p><button className="oc-button" disabled={!canEdit} onClick={()=>change({...design,channels:{...design.channels,[editChannel]:{...design.channels![editChannel]!,reviewedSource:sourceIdentity(design)}}})}>Mark adaptation reviewed</button></>}</div>:<PageProperties design={design} change={change} readonly={!canEdit} advanced={<>{<DesignInspector hidePaper design={design} change={change} brand={brand} region={region} editRegion={openRegion} artifact={piece} recipient={recipient} gifts={gifts.data||[]} openBrand={()=>setBrandOpen(true)}/>}{resource.data.latestBrandId&&resource.data.latestBrandId!==design.brandRevisionId&&<button className="oc-button" onClick={()=>setBrandUpdate(true)}>Review brand update</button>}</>}/>}
    blockInspector={<fieldset disabled={!canEdit}>{selected&&editor?<BlockInspector key={`${selected.node.attrs?.studioId}:${selected.position}`} node={selected.node} position={selected.position} editor={editor} brand={brand} upload={chooseImage} crop={cropImage} imageWidth={assets.data?.find(asset=>asset.url===selected.node.attrs?.src)?.width||null} printWidth={((design.page.paper==="A4"?210/25.4:design.page.orientation==="landscape"?(design.page.paper==="LEGAL"?14:11):8.5)-design.page.margins.left-design.page.margins.right)*Number(selected.node.attrs?.width||100)/100} onChange={()=>{const actual=editor.state.doc.nodeAt(selected.position);if(actual)setSelected({node:actual.toJSON() as StudioNode,position:selected.position});}} onSection={node=>{setSavingSection(node);setSectionName("");}}/>:<p>Select a block on the page to edit its properties.</p>}</fieldset>}
    notes={<ContentNotes ref={notesRef} contentId={content.id} readonly={!canEdit} onDirty={setNotesDirty}/>}
    alerts={alerts} dialogs={dialogs} issues={(preview||output).issues}
    recipientControls={<><details><summary>Original letter & email names</summary><OriginalSourceNames contentId={content.id}/></details><div className="cs-recipient oc-form"><input aria-label="Search Studio recipients" placeholder="Find a recipient…" value={recipientSearch} onChange={event=>setRecipientSearch(event.target.value)}/><select aria-label="Studio recipient" value={recipient} onChange={event=>{setRecipient(event.target.value);setDonor(emptyDonor());setPreview(null);setProof(null);}}><option value="">No recipient · setup preview</option>{recipients.data?.map(person=><option key={person.id} value={person.id}>{person.displayName||person.organizationName||`${person.firstName} ${person.lastName}`}</option>)}</select><button className="oc-button" onClick={()=>void previewRecipient()}>Apply preview</button></div></>}
    pieceControls={classicHost?null:<div className="v5-command-stack">{(Object.keys(pieceNames) as ArtifactKind[]).map(kind=><button key={kind} aria-pressed={piece===kind} onClick={()=>{setEditChannel(null);setView("LETTER");switchPiece(kind);}}>{pieceNames[kind]}</button>)}</div>}
  >{documentSurface}</WorkspaceFrame>;
  return <section className={`cs-studio ${focused?"cs-focused":""}`} aria-label="oyamaCreate Studio"><input ref={file} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>{const selected=event.target.files?.[0];if(selected)void upload(selected);event.target.value="";}}/>
    <header className="cs-command"><div><span className="oc-eyebrow">OYAMACREATE STUDIO</span><h2>{content.name}</h2><span className="oc-help">{campaign.name}</span></div><div className="oc-actions"><button type="button" className="oc-button small" onClick={()=>setFocused(value=>!value)}>{focused?"Exit writing view":"Focus writing"}</button><span className="cs-save" role="status">{busy?"Working…":htmlDirty?"Unapplied HTML":dirty?"Unsaved · autosave on":`${notice||"Saved"} · r${revisions.current.content}`}</span><button className="oc-button" disabled={busy||(!dirty&&!htmlDirty)||!canEdit} onClick={()=>void flushAll()}><Save size={14}/>Save</button>{resource.data.latestBrandId&&resource.data.latestBrandId!==design.brandRevisionId&&<button className="oc-button" onClick={()=>setBrandUpdate(true)}>Review brand update</button>}<button className="oc-button" onClick={()=>void renderProof()} disabled={!campaign.channelsJson.includes("LETTER")||busy}><Eye size={14}/>Pack proof</button><button className="oc-button primary" disabled={busy} onClick={async()=>{if(await flushAll())onReview();}}>Review campaign</button></div></header>
    {alerts}
    <div className="cs-surface-tabs" role="group" aria-label="Builder panel"><button type="button" className="oc-button" aria-pressed={surface==="edit"} onClick={()=>setSurface("edit")}>Edit</button><button type="button" className="oc-button" aria-pressed={surface==="preview"} onClick={()=>{setPreviewCollapsed(false);setSurface("preview");}}>Preview</button></div>
    <div className="cs-unified-panes" ref={paneRef} data-surface={surface} data-preview-collapsed={previewCollapsed} style={{"--cs-edit-width":`${split}%`} as CSSProperties}><div className="cs-author-pane" data-editor-mode={htmlSession?"html":"visual"}>
    <div className="cs-author-mode"><strong>{editChannel?`Customize ${channelNames[editChannel]}`:"Shared content"}</strong><p>{editChannel?"Changes apply only to this channel.":"Write once, then check how your message works in every format."}</p>{editChannel&&<><button type="button" className="oc-button small" onClick={()=>{setEditChannel(null);setSelected(null);}}>Return to shared content</button><button type="button" className="oc-button small" disabled={!canEdit} onClick={()=>change({...design,channels:{...design.channels,[editChannel]:{...design.channels![editChannel]!,reviewedSource:sourceIdentity(design)}}})}>Mark adaptation reviewed</button><button type="button" className="oc-button small" onClick={()=>{const channels={...design.channels};delete channels[editChannel];change({...design,channels});setEditChannel(null);}}>Use shared version</button></>}</div>
    <div className="cs-context"><div className="oc-actions cs-legacy-edit-switch"><button className="oc-button" aria-pressed={view==="LETTER"} onClick={()=>void switchView("LETTER")}><FileText size={14}/>Letter</button>{resource.data.hasEmail&&<button className="oc-button" aria-pressed={view==="EMAIL"} onClick={()=>void switchView("EMAIL")}><Mail size={14}/>Email</button>}<span className={emailReviewRequired(design)?"cs-sync warning":"cs-sync"}>{emailReviewRequired(design)?"Email customizations need review":"Shared design linked"}</span></div><div className="cs-recipient"><input aria-label="Search Studio recipients" placeholder="Find a recipient…" value={recipientSearch} onChange={event=>setRecipientSearch(event.target.value)}/><select aria-label="Studio recipient" value={recipient} onChange={event=>{setRecipient(event.target.value);setDonor(emptyDonor());setPreview(null);setProof(null);}}><option value="">No recipient · setup preview</option>{recipients.data?.map(person=><option key={person.id} value={person.id}>{person.displayName||person.organizationName||`${person.firstName} ${person.lastName}`}</option>)}</select><button className="oc-button small" disabled={busy} onClick={()=>void previewRecipient()}>Apply preview</button></div></div>
    {view==="LETTER"&&<div className="cs-piece-tabs" role="group" aria-label="Appeal-pack pieces">{(Object.keys(pieceNames) as ArtifactKind[]).map(kind=><button key={kind} className="oc-button small" aria-pressed={piece===kind} onClick={()=>switchPiece(kind)}>{pieceNames[kind]}</button>)}<select aria-label="Studio zoom" value={zoom} onChange={event=>setZoom(Number(event.target.value))}><option value={0}>Fit to width</option>{[25,35,50,65,75,85,100,125].map(value=><option key={value} value={value}>{value}%</option>)}</select><button type="button" className="oc-button small" onClick={()=>setHistoryOpen(true)}><History size={13}/>History</button></div>}
    <div className="cs-view-tools"><div className="cs-edit-mode" role="group" aria-label="Editor mode"><button type="button" className="oc-button small" aria-pressed={!htmlSession} onClick={cancelHtml}>Visual</button><button type="button" className="oc-button small" aria-pressed={!!htmlSession} disabled={busy} onClick={()=>{if(!htmlSession)void openHtml();}}><Code2 size={13}/>HTML</button></div><button type="button" className="oc-button small" aria-pressed={mobilePanel==="settings"} onClick={()=>{setLibraryOpen(false);setMobilePanel(mobilePanel==="settings"?"write":"settings");}}>Block & design settings</button><button type="button" className="oc-button small" aria-pressed={libraryOpen} onClick={()=>{setMobilePanel("write");setLibraryOpen(value=>!value);}}><PanelLeft size={14}/>Design library</button><span>Write on the page · insert a block with /</span><button type="button" className="oc-button small" onClick={()=>{setReviewOpen(true);void previewRecipient("EMAIL");}}><Columns2 size={14}/>Compare outputs</button></div>
    <div className="cs-ribbon-host" hidden={!!htmlSession}><StudioToolbar editor={htmlSession||envelope||!canEdit?null:editor} onInsert={insert} onLayout={()=>{setSelected(null);setMobilePanel("settings");}} onReview={()=>{setReviewOpen(true);void previewRecipient(view);}}/></div>
    <div className={`cs-studio-grid ${libraryOpen?"":"library-collapsed"}`} data-tool-panel={htmlSession?"none":mobilePanel==="settings"?"settings":libraryOpen||mobilePanel==="blocks"?"library":"none"}>{librarySurface}<main className={`cs-canvas ${mobilePanel==="write"?"mobile-active":""}`} onDragOver={event=>{if(event.dataTransfer.types.includes("application/create-studio"))event.preventDefault();}} onDrop={event=>{const type=event.dataTransfer.getData("application/create-studio");if(type){event.preventDefault();const position=editor?.view.posAtCoords({left:event.clientX,top:event.clientY});if(position)editor?.commands.setTextSelection(position.pos);insert(type);}}}>
      {documentSurface}
    </main><aside className={`cs-inspector ${mobilePanel==="settings"?"mobile-active":""}`}><div className="cs-inspector-heading"><Paintbrush size={15}/><strong>{selected?"Selected block":"Design settings"}</strong>{selected&&<button className="oc-button small" onClick={()=>setSelected(null)}>Design</button>}<button type="button" className="oc-icon-button cs-close-inspector" aria-label="Close block and design settings" onClick={()=>setMobilePanel("write")}><X size={14}/></button></div><fieldset disabled={!canEdit}>{selected&&editor?<BlockInspector key={`${selected.node.attrs?.studioId}:${selected.position}`} node={selected.node} position={selected.position} editor={editor} brand={brand} upload={chooseImage} crop={cropImage} imageWidth={assets.data?.find(asset=>asset.url===selected.node.attrs?.src)?.width||null} printWidth={((design.page.paper==="A4"?210/25.4:design.page.orientation==="landscape"?(design.page.paper==="LEGAL"?14:11):8.5)-design.page.margins.left-design.page.margins.right)*Number(selected.node.attrs?.width||100)/100} onChange={()=>{const actual=editor.state.doc.nodeAt(selected.position);if(actual)setSelected({node:actual.toJSON() as StudioNode,position:selected.position});}} onSection={node=>{setSavingSection(node);setSectionName("");}}/>:<DesignInspector design={design} change={change} brand={brand} region={region} editRegion={openRegion} artifact={piece} recipient={recipient} gifts={gifts.data||[]} openBrand={()=>setBrandOpen(true)}/>}</fieldset></aside></div>
    {view==="EMAIL"&&<div className="cs-email-settings-bar"><label>Subject<input aria-label="Email subject" value={design.email.subject} disabled={!canEdit} onChange={event=>change({...design,email:{...design.email,subject:event.target.value}})}/></label><label>Preview text<input aria-label="Email preview text" value={design.email.previewText} disabled={!canEdit} onChange={event=>change({...design,email:{...design.email,previewText:event.target.value}})}/></label><button className="oc-button small" onClick={async()=>{if(await flushAll())setEmailSettings(true);}}>Sender, compliance & test</button>{["desktop","mobile","plain-text"].map(mode=><button type="button" className="oc-button small" key={mode} aria-pressed={previewMode===mode} onClick={()=>{setPreviewMode(mode);if(mode==="plain-text")void previewRecipient("EMAIL");}}>{mode}</button>)}{previewMode==="plain-text"&&<pre>{preview?.text||"Apply recipient preview to inspect plain text."}</pre>}</div>}
    {(preview||output.issues.length>0)&&<details className="cs-review-diagnostics"><summary>Data requirements, adaptations & decisions</summary>{(preview||output).issues.map((issue,index)=><p className={issue.blocking?"oc-error":"oc-help"} key={index}>{issue.message}</p>)}{preview?.adaptations.map((issue,index)=><p className="oc-help" key={`adapt-${index}`}>{issue.message}</p>)}{preview?.decisions.map((decision,index)=><p className="oc-help" key={`decision-${index}`}>{decision.rule}: {decision.result}</p>)}</details>}
    </div><div className="cs-pane-divider" role="separator" aria-label="Resize editor and preview" aria-orientation="vertical" aria-valuemin={30} aria-valuemax={70} aria-valuenow={split} tabIndex={0} onKeyDown={event=>{if(event.key==="ArrowLeft"||event.key==="ArrowRight"){event.preventDefault();setSplit(value=>Math.max(30,Math.min(70,value+(event.key==="ArrowLeft"?-5:5))));}}} onPointerDown={event=>event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={event=>{if(!event.currentTarget.hasPointerCapture(event.pointerId)||!paneRef.current)return;const box=paneRef.current.getBoundingClientRect();setSplit(Math.max(30,Math.min(70,(event.clientX-box.left)/box.width*100)));}}/>
    <div className="cs-preview-pane" hidden={previewCollapsed}><ChannelPreview content={content} campaign={campaign} design={htmlProjection||design} sourcePending={!!htmlSession&&htmlPending} active={!previewCollapsed} onCollapse={()=>{setPreviewCollapsed(true);setSurface("edit");}} recipient={recipient} formats={channelDrafts} readonly={!canEdit} onCustomize={channel=>void customize(channel)} onSettings={channel=>{setSettingsChannel(channel);setSurface("edit");}} onProof={kind=>void renderProof(kind)}/></div><aside className="cs-preview-rail" hidden={!previewCollapsed} aria-label="Collapsed live preview"><button type="button" aria-label="Show live preview" title="Show live preview" onClick={()=>{setPreviewCollapsed(false);setSurface("preview");}}><PanelRightOpen size={18}/><span>Live preview</span></button></aside></div>
    {dialogs}
  </section>;
});export default StudioWorkspace;
