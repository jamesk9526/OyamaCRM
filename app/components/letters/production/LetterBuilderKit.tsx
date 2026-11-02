"use client";
import { useState, type ReactNode, type ButtonHTMLAttributes } from "react";
import { FileText, Heading, AlignLeft, UserRound, Image, Table2, PenLine, Minus, MoveVertical, FilePlus2, Search, Check, AlertCircle, Braces } from "lucide-react";
import type { Editor, JSONContent } from "@tiptap/core";
import { tokenizeMergeFields } from "./LetterEditor";

export function BuilderButton({primary=false,className="",...props}:ButtonHTMLAttributes<HTMLButtonElement>&{primary?:boolean}){
 return <button type="button" {...props} className={`lb-button ${primary?"lb-button-primary":""} ${className}`}/>;
}
export function BuilderCard({title,children}: {title:string;children:ReactNode}) { return <section className="lb-card"><h3>{title}</h3><div className="lb-card-body">{children}</div></section>; }
export function BuilderStatus({state,children}:{state:"saved"|"warning"|"draft";children:ReactNode}) {return <span className={`lb-status lb-status-${state}`}>{state==="saved"?<Check size={13}/>:state==="warning"?<AlertCircle size={13}/>:<FileText size={13}/>} {children}</span>;}
export function ReviewChecklist({items}:{items:Array<{label:string;ok:boolean}>}){return <ul className="lb-checklist">{items.map(item=><li key={item.label}>{item.ok?<Check size={17} className="lb-check"/>:<AlertCircle size={17} className="lb-warning"/>}<span>{item.label}</span></li>)}</ul>;}

const blocks=[
 {id:"paragraph",label:"Text",description:"Add a paragraph",icon:AlignLeft,group:"Writing"},
 {id:"heading",label:"Heading",description:"Add a section heading",icon:Heading,group:"Writing"},
 {id:"greeting",label:"Salutation",description:"Personalize a greeting",icon:UserRound,group:"Writing"},
 {id:"image",label:"Image",description:"Upload a letter image",icon:Image,group:"Layout"},
 {id:"plain-table",label:"Table",description:"Insert an editable table",icon:Table2,group:"Layout"},
 {id:"table",label:"Gift details",description:"Insert donation merge fields",icon:Table2,group:"Giving"},
 {id:"signature",label:"Signature",description:"Open signer settings",icon:PenLine,group:"Writing"},
 {id:"divider",label:"Divider",description:"Separate sections",icon:Minus,group:"Layout"},
 {id:"spacer",label:"Spacer",description:"Add breathing room",icon:MoveVertical,group:"Layout"},
 {id:"break",label:"Page break",description:"Start a new printed page",icon:FilePlus2,group:"Layout"},
];
export function insertLetterBlock(editor:Editor,id:string){
 if(id==="plain-table"){editor.chain().focus().insertTable({rows:3,cols:2,withHeaderRow:true}).run();return;}
 const content:Record<string,string|JSONContent>={paragraph:{type:"paragraph"},heading:{type:"heading",attrs:{level:2}},greeting:'<p>Dear <span data-merge-field="" data-token="donor.firstName">{{donor.firstName}}</span>,</p>',table:'<table><thead><tr><th>Gift date</th><th>Gift amount</th><th>Fund</th></tr></thead><tbody><tr><td>{{gift.date}}</td><td>{{gift.amount}}</td><td>{{gift.fund}}</td></tr></tbody></table>',divider:{type:"horizontalRule"},spacer:{type:"letterSpacer",attrs:{height:"18pt"}},break:{type:"letterPageBreak"}};
 if(id==="paragraph"||id==="heading"){
  const selection=editor.state.selection.$from;
  const position=selection.depth>0?selection.after(1):editor.state.doc.content.size;
  const node=id==="heading"?{type:"heading",attrs:{level:2}}:{type:"paragraph"};
  editor.chain().focus().insertContentAt(position,node).setTextSelection(position+1).run();return;
 }
 const value=content[id];if(value)editor.chain().focus().insertContent(typeof value === "string" ? tokenizeMergeFields(value) : value).run();
}
export function BlockLibrary({onInsert,disabled}:{onInsert:(id:string)=>void;disabled:boolean}){
 const [search,setSearch]=useState("");
 const [group,setGroup]=useState("All");
 const filtered = blocks.filter(block => (group === "All" || block.group === group) && `${block.label} ${block.description}`.toLowerCase().includes(search.toLowerCase()));
 return <section className="lb-library" aria-label="Document block library">
   <h2><FileText size={17} aria-hidden="true"/>Document blocks</h2>
   <label className="lb-search"><Search size={16} aria-hidden="true"/><input aria-label="Search document blocks" placeholder="Search blocks…" value={search} onChange={event=>setSearch(event.target.value)}/></label>
   <div className="lb-filter" role="group" aria-label="Block categories">{["All","Writing","Layout","Giving"].map(value=><button key={value} type="button" aria-pressed={group===value} onClick={()=>setGroup(value)}>{value}</button>)}</div>
   <div className="lb-block-grid">{filtered.map(block=><button type="button" className="lb-block" key={block.id} disabled={disabled} draggable={!disabled}
     onDragStart={event=>{event.dataTransfer.setData("application/oyama-letter-block",block.id);event.dataTransfer.effectAllowed="copy";}} onClick={()=>onInsert(block.id)}>
     <block.icon size={21} aria-hidden="true"/><span><strong>{block.label}</strong><small>{block.description}</small></span>
   </button>)}</div>
   {!filtered.length ? <p role="status" className="lb-help">No matching blocks. Try another search or category.</p> : null}
   <p className="lb-help">Add content here. Click to insert at the cursor, or drag into the letter. Format selected text in the toolbar.</p>
 </section>;
}
export function MergeFieldLibrary({sections,onInsert}:{sections:Array<{label:string;fields:string[]}>;onInsert:(token:string)=>void}){
 const [search,setSearch]=useState("");
 const query=search.trim().toLowerCase();
 const matches=sections.map(section=>({...section,fields:section.fields.filter(token=>token.toLowerCase().includes(query))})).filter(section=>section.fields.length);
 return <BuilderCard title="Merge fields">
   <label className="lb-search"><Search size={16} aria-hidden="true"/><input aria-label="Search merge fields" placeholder="Find a field…" value={search} onChange={event=>setSearch(event.target.value)}/></label>
   {matches.map(section=><details key={section.label} open={!!query||undefined}><summary>{section.label}</summary><div className="lb-chips">{section.fields.map(token=><button type="button" key={token} title={`Insert ${token}`} onMouseDown={event=>event.preventDefault()} onClick={()=>onInsert(token)}><Braces size={12} aria-hidden="true"/>{token.replace(/[{}]/g,"")}</button>)}</div></details>)}
   {!sections.length ? <p className="lb-help">Merge fields are unavailable. Refresh the workspace to retry.</p> : !matches.length ? <p role="status" className="lb-help">No matching fields. Try a contact or gift field name.</p> : null}
 </BuilderCard>;
}
