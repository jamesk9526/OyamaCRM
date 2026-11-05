"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Floating tools escape the ribbon's horizontal scroll viewport. */
export default function ToolbarPopover({label,icon,disabled=false,children}:{label:string;icon:ReactNode;disabled?:boolean;children:ReactNode}){
  const [open,setOpen]=useState(false),[position,setPosition]=useState({left:8,top:8}),id=useId();
  const button=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    if(!open)return;
    const place=()=>{if(!button.current||!panel.current)return;const anchor=button.current.getBoundingClientRect(),box=panel.current.getBoundingClientRect(),boundary=button.current.closest('.cs-author-pane')?.getBoundingClientRect();setPosition({left:Math.max((boundary?.left||0)+8,Math.min(anchor.left,(boundary?.right||innerWidth)-box.width-8)),top:anchor.bottom+box.height+6<=innerHeight?anchor.bottom+6:Math.max(8,anchor.top-box.height-6)});};
    place();window.addEventListener("resize",place);window.addEventListener("scroll",place,true);
    const frame=requestAnimationFrame(()=>panel.current?.querySelector<HTMLElement>("input,button,textarea,select")?.focus());
    return()=>{cancelAnimationFrame(frame);window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);};
  },[open]);
  useEffect(()=>{
    if(!open)return;
    const dismiss=(event:PointerEvent|FocusEvent)=>{const target=event.target as Node;if(!button.current?.contains(target)&&!panel.current?.contains(target))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();setOpen(false);button.current?.focus();}};
    document.addEventListener("pointerdown",dismiss);document.addEventListener("focusin",dismiss);document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("pointerdown",dismiss);document.removeEventListener("focusin",dismiss);document.removeEventListener("keydown",escape);};
  },[open]);
  return <><button ref={button} type="button" className="cs-tool" aria-label={label} aria-expanded={open&&!disabled} aria-controls={open&&!disabled?id:undefined} aria-haspopup="dialog" disabled={disabled} onMouseDown={event=>event.preventDefault()} onClick={()=>setOpen(value=>!value)}>{icon}</button>{open&&!disabled&&createPortal(<div ref={panel} id={id} role="dialog" aria-label={label} className="oc-app cs-toolbar-floating" style={position}>{children}</div>,document.body)}</>;
}
