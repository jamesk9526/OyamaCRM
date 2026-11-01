"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import CRMCard from "./CRMCard";

/** Consistent native-table shell; interaction is supplied by the internal spreadsheet enhancer. */
export default function CRMDataTable({children,className=""}: {children:ReactNode;className?:string}) {
 const [compact,setCompact]=useState(false);
 const [selection,setSelection]=useState({address:"A1",count:0});
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const root=ref.current;
  const receive=(event:Event)=>setSelection((event as CustomEvent<{address:string;count:number}>).detail);
  root?.addEventListener('crm:sheet-selection',receive);
  return ()=>root?.removeEventListener('crm:sheet-selection',receive);
 },[]);
 return <div ref={ref}><CRMCard padding="none" className={`oyama-table-shell overflow-hidden ${className}`}>
  <div className="crm-table-toolbar"><div className="flex items-center gap-3"><span className="sheet-address" aria-label="Active cell">{selection.address}</span><span className="hidden sm:inline text-xs">{selection.count>1?`${selection.count} cells selected`:'Records'}</span><small className="hidden lg:inline">Arrows to navigate · Shift to select · Ctrl+C to copy · Drag column edges to resize</small></div><button type="button" aria-pressed={compact} onClick={()=>setCompact(value=>!value)}>{compact?'Comfortable rows':'Compact rows'}</button></div>
  <div role="region" aria-label="Records table" data-density={compact?'compact':'comfortable'} className="crm-table-scroll max-w-full overflow-x-auto border-t border-slate-100">{children}</div>
 </CRMCard></div>;
}
