"use client";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, PanelsTopLeft } from "lucide-react";
import type { paginationMetrics } from "@/server/src/oyama-create/studio/layout";

export default function PageThumbnailBar({pages,current,html,metrics,onSelect}:{pages:number;current:number;html:string;metrics:ReturnType<typeof paginationMetrics>;onSelect:(page:number)=>void}){
  const [expanded,setExpanded]=useState(true),id=useId();
  const navigation=useRef<HTMLElement>(null);
  useLayoutEffect(()=>{const element=navigation.current;if(!element||!expanded)return;const keepVisible=()=>{const active=element.querySelector<HTMLElement>('[aria-current="page"]');if(!active)return;const viewport=element.getBoundingClientRect(),item=active.getBoundingClientRect();if(item.left<viewport.left)element.scrollLeft+=item.left-viewport.left-8;else if(item.right>viewport.right)element.scrollLeft+=item.right-viewport.right+8;};keepVisible();const resize=new ResizeObserver(keepVisible);resize.observe(element);return()=>resize.disconnect();},[current,expanded,pages]);
  return <section className="cs-page-dock" aria-label="Page thumbnails">
    <div className="cs-page-dock-toolbar">
      <button type="button" className="cs-page-dock-toggle" aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(value=>!value)}><PanelsTopLeft size={14}/><strong>Pages</strong><span>{current} / {pages}</span>{expanded?<ChevronDown size={14}/>:<ChevronUp size={14}/>}</button>
      <span className="cs-page-proof-note">PDF proof confirms final pagination</span>
      <div className="cs-page-stepper"><button type="button" aria-label="Previous page" disabled={current<=1} onClick={()=>onSelect(current-1)}><ChevronLeft size={16}/></button><button type="button" aria-label="Next page" disabled={current>=pages} onClick={()=>onSelect(current+1)}><ChevronRight size={16}/></button></div>
    </div>
    <nav ref={navigation} id={id} className="cs-page-navigation" aria-label="Page outline" hidden={!expanded}>{Array.from({length:pages},(_,index)=><button type="button" key={index} className="cs-page-thumbnail" aria-label={`Go to page ${index+1}`} aria-current={current===index+1?"page":undefined} onClick={()=>onSelect(index+1)}>
      <span aria-hidden="true" className="cs-thumbnail-paper"><span className="studio-content cs-thumbnail-content" style={{position:"absolute",left:5-index*metrics.pitch*.067,top:5,width:metrics.bodyWidth,height:metrics.bodyHeight,columnWidth:metrics.bodyWidth,columnGap:metrics.columnGap,columnFill:"auto",transform:"scale(.067)",transformOrigin:"top left"}} dangerouslySetInnerHTML={{__html:html}}/></span><span>Page {index+1}</span>
    </button>)}</nav>
  </section>;
}
