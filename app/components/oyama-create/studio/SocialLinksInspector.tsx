"use client";
export default function SocialLinksInspector({value,change}:{value:string;change:(value:string)=>void}){
  let links:Array<{label:string;url:string}>=[];try{const parsed=JSON.parse(value);if(Array.isArray(parsed))links=parsed;}catch{/* invalid prior values can be replaced with the form */}
  const update=(index:number,key:"label"|"url",value:string)=>change(JSON.stringify(links.map((item,position)=>position===index?{...item,[key]:value}:item)));
  return <section className="oc-form"><h3>Social profiles</h3>{links.map((link,index)=><div className="oc-form" key={index}><label>Profile label<input value={link.label} onChange={event=>update(index,"label",event.target.value)}/></label><label>Profile URL<input type="url" value={link.url} placeholder="https://" onChange={event=>update(index,"url",event.target.value)}/></label><button className="oc-button small" type="button" onClick={()=>change(JSON.stringify(links.filter((_,position)=>position!==index)))}>Remove profile</button></div>)}<button className="oc-button" type="button" disabled={links.length>=20} onClick={()=>change(JSON.stringify([...links,{label:"",url:""}]))}>Add profile link</button></section>;
}
