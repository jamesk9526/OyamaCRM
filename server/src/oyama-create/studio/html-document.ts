import { parseDocument, DomUtils } from "htmlparser2";
import { CreateError, escapeHtml, string, type Channel } from "../domain.js";
import { normalizeDesign, walkNodes } from "./design.js";
import { htmlToStudio, sanitizeStudioHtml } from "./html.js";
import { renderRegion } from "./render.js";
import type { BrandDocument, StudioDesign, StudioDoc, StudioNode } from "./types.js";

export type HtmlScope="SHARED"|Channel;
type HtmlNode=ReturnType<typeof parseDocument>["children"][number];
const regions=["firstHeader","header","firstFooter","footer"] as const;
const e=escapeHtml;
const canonical=(html:string)=>DomUtils.getOuterHTML(parseDocument(html));

/** Authoring HTML never resolves recipient fields. Studio-only blocks remain recognizable markers. */
export function nodeHtml(node:StudioNode,primary:string):string{
  const a=node.attrs||{},children=()=>node.content?.map(child=>nodeHtml(child,primary)).join("")||"";
  const style=[a.textAlign?`text-align:${a.textAlign}`:"",a.indent?`margin-left:${Number(a.indent)*12}pt`:"",a.spacing!==undefined?`margin-bottom:${Number(a.spacing)}pt`:"",a.keepTogether?"break-inside:avoid":"",a.keepWithNext?"break-after:avoid":"",["studioCallout","studioImpact"].includes(node.type)?`background:${string(a.color)||"#edf4fc"};padding:12pt;border-left:3pt solid ${primary}`:"",["tableCell","tableHeader"].includes(node.type)?`${a.background?`background:${a.background};`:""}border:1px solid ${string(a.borderColor)||"#c7d3df"}`:""].filter(Boolean).join(";");
  const attr=style?` style="${e(style)}"`:"";
  if(node.type==="text"||node.type==="mergeField"){
    let html=e(node.type==="mergeField"?string(a.rawToken):node.text||"");
    for(const mark of node.marks||[]){const tag=({bold:"strong",italic:"em",underline:"u",strike:"s",code:"code",superscript:"sup",subscript:"sub"} as Record<string,string>)[mark.type];
      if(tag)html=`<${tag}>${html}</${tag}>`;
      if(mark.type==="link")html=`<a href="${e(string(mark.attrs?.href))}">${html}</a>`;
      if(mark.type==="textStyle"){const s=[mark.attrs?.color?`color:${mark.attrs.color}`:"",mark.attrs?.fontFamily?`font-family:${mark.attrs.fontFamily}`:"",mark.attrs?.fontSize?`font-size:${mark.attrs.fontSize}`:"",mark.attrs?.lineHeight?`line-height:${mark.attrs.lineHeight}`:""].filter(Boolean).join(";");if(s)html=`<span style="${e(s)}">${html}</span>`;}
      if(mark.type==="highlight")html=`<span style="background-color:${e(string(mark.attrs?.color)||"#fff2b2")}">${html}</span>`;
    }return html;
  }
  if(node.type==="hardBreak")return "<br>";
  const tag=({paragraph:"p",blockquote:"blockquote",bulletList:"ul",orderedList:"ol",listItem:"li",table:"table",tableRow:"tr",tableCell:"td",tableHeader:"th",studioGroup:"div",studioCallout:"div",studioImpact:"div"} as Record<string,string>)[node.type]||(node.type==="heading"?`h${Number(a.level)||2}`:"");
  if(tag)return `<${tag}${attr}${["td","th"].includes(tag)?` colspan="${Number(a.colspan)||1}" rowspan="${Number(a.rowspan)||1}"`:""}>${children()}</${tag}>`;
  if(node.type==="horizontalRule")return "<hr>";
  if(node.type==="letterPageBreak")return '<div data-letter-page-break="true"></div>';
  if(node.type==="letterSpacer")return `<div data-letter-spacer="true" style="height:${Number(a.height)||12}pt"></div>`;
  if(node.type==="studioColumns")return `<div style="display:flex;gap:14pt">${children()}</div>`;
  if(node.type==="studioColumn")return `<div style="width:${Number(a.width)||50}%">${children()}</div>`;
  if(node.type==="image"){const img=`<img src="${e(string(a.src))}" alt="${e(string(a.alt))}" style="display:block;max-width:100%;width:${Number(a.width)||100}%;${a.height?`height:${Number(a.height)}px;object-fit:${a.crop==="cover"?"cover":"contain"};object-position:${Number(a.focalX)||50}% ${Number(a.focalY)||50}%`:"height:auto"}">`,linked=a.href?`<a href="${e(string(a.href))}">${img}</a>`:img;return a.caption?`<figure>${linked}<figcaption>${e(string(a.caption))}</figcaption></figure>`:linked;}
  if(node.type==="studioHtml"||node.type==="studioLegacy")return sanitizeStudioHtml(string(a.html));
  if(["studioButton","studioFile","studioVideo"].includes(node.type))return `<p><a href="${e(string(a.href))}"${node.type==="studioButton"?` style="display:inline-block;padding:10px 18px;background:${e(string(a.color)||"#245ec7")};color:#ffffff"`:""}>${node.type==="studioVideo"&&a.thumbnail?`<img src="${e(string(a.thumbnail))}" alt="${e(string(a.label))}"><br>`:""}${e(string(a.label)||"Open link")}</a></p>`;
  // Keep configured/conditional CRM blocks intact instead of baking sample or donor values into source.
  return `<p>[Studio block: ${e(node.type)} — keep this marker to retain its CRM settings]</p>`;
}

function sourceParts(design:StudioDesign,brand:BrandDocument,scope:HtmlScope,hydrated=design){
  const body=scope!=="SHARED"&&design.channels?.[scope]?design.channels[scope]!.document:design.body;
  const hydratedBody=scope!=="SHARED"&&hydrated.channels?.[scope]?hydrated.channels[scope]!.document:hydrated.body;
  const blocks=new Map<string,{node:StudioNode;html:string}>();
  const docHtml=(doc:StudioDoc,materialized:StudioDoc,key:string)=>doc.content.map((node,index)=>{
    const id=`${key}:${string(node.attrs?.studioId)||index}`,html=nodeHtml(materialized.content[index]||node,design.styles.primary);blocks.set(id,{node,html});return `<div data-oyama-block="${e(id)}">${html}</div>`;
  }).join("\n");
  const parts=new Map<string,string>();
  if(scope==="SHARED"||scope==="LETTER")for(const key of regions)parts.set(key,design.regions[key].mode==="custom"?docHtml(design.regions[key].content,hydrated.regions[key].content,key):renderRegion(hydrated,{available:false,sensitiveAllowed:false,constituentId:null,name:"",salutation:"",address:"",entityKind:"",gift:null,giving:null,pledge:null,campaign:null,tags:[],recurring:null,responseCode:"",asOf:"2000-01-01T00:00:00Z"},brand,key,{authoring:true}));
  parts.set("body",docHtml(body,hydratedBody,"body"));
  if((scope==="SHARED"||scope==="LETTER")&&design.pack.replySlip.enabled)parts.set("replySlip",docHtml(design.pack.replySlip.content,hydrated.pack.replySlip.content,"replySlip"));
  return {parts,blocks};
}

export function exportHtmlDocument(design:StudioDesign,brand:BrandDocument,scope:HtmlScope="SHARED",hydrated=design){
  const {parts}=sourceParts(design,brand,scope,hydrated);
  return '<!doctype html>\n<html>\n<body>\n<!-- Region and Studio block markers preserve page furniture and configured CRM blocks. -->\n'+[...parts].map(([key,html])=>`<${key==="body"?"main":"div"} data-oyama-region="${key}">\n${html}\n</${key==="body"?"main":"div"}>`).join("\n\n")+'\n</body>\n</html>';
}

export const CLASSIC_REGIONS = ["body", ...regions, "replySlip"] as const;
export type ClassicRegion = typeof CLASSIC_REGIONS[number];
export function classicRegionHtml(design: StudioDesign, brand: BrandDocument, hydrated = design, includeBrand = false): Record<ClassicRegion, string> {
  const { parts } = sourceParts(design, brand, "LETTER", hydrated);
  return {
    body: parts.get("body") || "",
    firstHeader: includeBrand || design.regions.firstHeader.mode === "custom" ? parts.get("firstHeader") || "" : "",
    header: includeBrand || design.regions.header.mode === "custom" ? parts.get("header") || "" : "",
    firstFooter: includeBrand || design.regions.firstFooter.mode === "custom" ? parts.get("firstFooter") || "" : "",
    footer: includeBrand || design.regions.footer.mode === "custom" ? parts.get("footer") || "" : "",
    replySlip: parts.get("replySlip") || "",
  };
}

export function importHtmlDocument(design:StudioDesign,brand:BrandDocument,html:string,scope:HtmlScope="SHARED",hydrated=design){
  if(!html.trim())throw new CreateError(400,"Enter the letter HTML before applying it.");
  if(html.length>2000000)throw new CreateError(400,"The HTML source exceeds 2 MB. Its original remains unchanged.");
  const {parts,blocks}=sourceParts(design,brand,scope,hydrated),next=structuredClone(design),diagnostics:string[]=[],seen=new Set<string>();let sequence=0;
  const reserved=[design.body,...Object.values(design.regions).map(region=>region.content),design.pack.replySlip.content,...Object.values(design.channels||{}).map(channel=>channel.document)].flatMap(walkNodes).map(node=>string(node.attrs?.studioId));
  const prefix=()=>{let value="";do{value=`html-edit-${++sequence}`;}while(reserved.some(id=>id.startsWith(value+"-")));return value;};
  const parsed=parseDocument(html),sections=new Map<string,HtmlNode>();
  const stack=parsed.children.map(node=>({node,depth:0}));while(stack.length){const item=stack.pop()!;if(item.depth>60)throw new CreateError(400,"The HTML is too deeply nested. Simplify its layout before applying it.");if("children" in item.node)for(const child of item.node.children)stack.push({node:child,depth:item.depth+1});}
  let outsideContent=false;
  const visit=(node:HtmlNode)=>{if("attribs" in node&&node.attribs["data-oyama-region"]){const key=node.attribs["data-oyama-region"];if(!["body",...regions,"replySlip"].includes(key))throw new CreateError(400,`Unknown HTML region: ${key}.`);if(sections.has(key))throw new CreateError(400,`Keep only one ${key} HTML region.`);sections.set(key,node);return;}if("attribs" in node&&["head","script","style"].includes(node.name))return;if(node.type==="text"&&node.data.trim()||"attribs" in node&&!["html","body","meta","link"].includes(node.name))outsideContent=true;if("children" in node)node.children.forEach(visit);};parsed.children.forEach(visit);
  if(sections.size&&outsideContent)throw new CreateError(400,'Place new letter content inside data-oyama-region="body", or paste a complete replacement without region markers.');
  if(/<script\b|<style\b|\son\w+\s*=|javascript:/i.test(html))diagnostics.push("Unsafe or unsupported active markup was removed; compare the original before use.");
  const convert=(nodes:HtmlNode[]):StudioDoc=>{
    const result:StudioNode[]=[],pending:HtmlNode[]=[];
    const flush=()=>{if(!pending.length)return;const converted=htmlToStudio(pending.map(node=>DomUtils.getOuterHTML(node)).join(""),prefix());diagnostics.push(...converted.diagnostics);result.push(...converted.document.content);pending.length=0;};
    for(const node of nodes){const id="attribs" in node?node.attribs["data-oyama-block"]:"",original=id?blocks.get(id):null;
      if(original&&"children" in node&&canonical(DomUtils.getInnerHTML(node))===canonical(original.html)&&!seen.has(id)){flush();result.push(structuredClone(original.node));seen.add(id);}
      else if(id&&"children" in node){flush();const changed=htmlToStudio(DomUtils.getInnerHTML(node),prefix());diagnostics.push(...changed.diagnostics);if(original&&changed.document.content.length===1){const first=changed.document.content[0],old=original.node.attrs||{};first.attrs={...first.attrs,...Object.fromEntries(["emailOnly","printOnly","keepTogether","keepWithNext"].filter(key=>old[key]!==undefined).map(key=>[key,old[key]])),...(!seen.has(id)&&old.studioId?{studioId:old.studioId}:{})};seen.add(id);}if(original?.node.type.startsWith("studio")&&!['studioHtml','studioLegacy'].includes(original.node.type))diagnostics.push(`Changed ${original.node.type} HTML becomes authored content; its prior CRM configuration remains in revision history.`);result.push(...changed.document.content);}
      else pending.push(node);
    }flush();return {type:"doc",content:result};
  };
  let body:StudioDoc;
  if(sections.size){
    const main=sections.get("body");if(!main||!("children" in main))throw new CreateError(400,'Keep the data-oyama-region="body" region, or paste a complete replacement letter without region markers.');
    body=convert(main.children);
    if(scope==="SHARED"||scope==="LETTER")for(const key of regions){const section=sections.get(key),inner=section&&"children" in section?DomUtils.getInnerHTML(section).trim():"";
      if(canonical(inner)===canonical((parts.get(key)||"").trim()))continue;
      next.regions[key]=inner?{mode:"custom",presetId:"",content:convert(section&&"children" in section?section.children:[])}:{mode:"none",presetId:"",content:{type:"doc",content:[]}};
    }
    const reply=sections.get("replySlip");if(reply&&"children" in reply)next.pack.replySlip.content=convert(reply.children);else if(parts.has("replySlip"))next.pack.replySlip.enabled=false;
  }else{
    body=convert(parsed.children);
    if(scope==="SHARED"||scope==="LETTER"){for(const key of regions)next.regions[key].mode="none";next.pack.replySlip.enabled=false;diagnostics.push("Complete pasted HTML supplies its own page furniture. Existing repeated headers, footers and reply slip are disabled for this draft to avoid duplicates.");}
  }
  if(!body.content.length)throw new CreateError(400,"The HTML contains no letter content after sanitizing. The original is unchanged.");
  if(scope!=="SHARED"&&next.channels?.[scope]){if(JSON.stringify(body)!==JSON.stringify(next.channels[scope]!.document))next.channels[scope]={...next.channels[scope]!,document:body,reviewedSource:null};}else next.body=body;
  const normalized=normalizeDesign(next);
  return {design:normalized,diagnostics:[...new Set(diagnostics)]};
}
