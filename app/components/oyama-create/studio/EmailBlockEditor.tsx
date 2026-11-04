"use client";
import {useRef,useState} from "react";
import type {Editor} from "@tiptap/core";
import type {StudioNode,BrandDocument,StudioDesign,DonorContext} from "@/server/src/oyama-create/studio/types";
import {newBlock,STUDIO_BLOCKS} from "@/server/src/oyama-create/studio/registry";
import {walkNodes} from "@/server/src/oyama-create/studio/design";
import {Modal} from "../ui";
import StudioEditor from "./StudioEditor";
import StudioToolbar from "./StudioToolbar";
import BlockInspector from "./BlockInspector";
export default function EmailBlockEditor({node,design,brand,donor,upload,crop,apply,close}:{node:StudioNode;design:StudioDesign;brand:BrandDocument;donor:DonorContext;upload:(apply:(url:string)=>void)=>void;crop:(node:StudioNode,apply:(url:string)=>void)=>void;apply:(node:StudioNode)=>void;close:()=>void}){
 const [editor,setEditor]=useState<Editor|null>(null),[doc,setDoc]=useState({type:"doc" as const,content:[structuredClone(node)]}),[selected,setSelected]=useState<{node:StudioNode;position:number}|null>(null);
 const [initial]=useState(doc),context=useRef({design,brand,donor});
 function save(){const content=structuredClone(doc.content),id=String(node.attrs?.studioId);let result:StudioNode;if(content.length===1)result={...content[0],attrs:{...content[0].attrs,studioId:id}};else{for(const part of content)for(const child of walkNodes(part))if(child.attrs?.studioId)child.attrs.studioId=crypto.randomUUID();result={type:"studioGroup",attrs:{studioId:id},content};}apply(result);}
 function insert(type:string){if(!editor)return;const block=newBlock(type,crypto.randomUUID());editor.chain().focus().insertContent(block).run();if(type==="image")upload(url=>{editor.state.doc.descendants((item,pos)=>{if(item.attrs.studioId===block.attrs?.studioId)editor.view.dispatch(editor.state.tr.setNodeMarkup(pos,undefined,{...item.attrs,src:url}));});});}
 return <Modal title="Customize this email block" wide close={close}><p className="oc-help">Keep rich text, images, tables, signatures and links in this protected email version. Shared letter edits will request review before replacing it.</p><StudioToolbar editor={editor}/><select aria-label="Insert email override block" value="" onChange={event=>{if(event.target.value)insert(event.target.value);}}><option value="">Insert into this customization…</option>{STUDIO_BLOCKS.filter(block=>!block.printOnly).map(block=><option key={block.type} value={block.type}>{block.name}</option>)}</select><div className="cs-email-custom-editor"><div className="cs-email-custom-canvas"><StudioEditor initial={initial} context={context} onChange={setDoc} onReady={setEditor} onSelect={(node,position)=>setSelected(node?{node,position}:null)}/></div>{selected&&editor&&<BlockInspector node={selected.node} position={selected.position} editor={editor} brand={brand} upload={upload} crop={crop} imageWidth={null} printWidth={6.5} onChange={()=>{const current=editor.state.doc.nodeAt(selected.position);if(current)setSelected({...selected,node:current.toJSON() as StudioNode});}}/>}</div><div className="oc-actions"><button className="oc-button" onClick={close}>Keep previous customization</button><button className="oc-button primary" onClick={save}>Apply customized block</button></div></Modal>;
}
