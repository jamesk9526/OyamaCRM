"use client";
import { BuilderCard } from "./LetterBuilderKit";
/** Canonical per-document paper/margins editor. Branding stays in organization settings. */
export default function LetterDocumentSettings({pageSize,margins,onChange}:{pageSize?:string;margins:Record<string,number>;onChange:(value:Record<string,unknown>)=>void}) {
 return <BuilderCard title="Document settings"><label className="lb-field">Paper size<select aria-label="Paper size" value={pageSize||"Letter (8.5 x 11 in)"} onChange={e=>onChange({pageSize:e.target.value})}><option>Letter (8.5 x 11 in)</option><option>A4 (8.27 x 11.69 in)</option><option>Legal (8.5 x 14 in)</option></select></label><p className="lb-label">Margins (inches)</p><div className="lb-margin-grid">{Object.entries(margins).map(([key,value])=><label className="lb-field" key={key}>{key}<input type="number" min="0.125" max="1.5" step="0.125" value={value} onChange={e=>{const number=e.target.valueAsNumber;if(Number.isFinite(number))onChange({margins:{...margins,[key]:Math.min(1.5,Math.max(.125,number))}});}}/></label>)}</div></BuilderCard>;
}
