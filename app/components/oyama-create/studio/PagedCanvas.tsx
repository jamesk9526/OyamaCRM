"use client";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { emptyDonor, renderStudio } from "@/server/src/oyama-create/studio/render";
import type { StudioDesign } from "@/server/src/oyama-create/studio/types";
import { flowPageCount, paginationMetrics, studioContentCss, studioRegionCss } from "@/server/src/oyama-create/studio/layout";
import PageThumbnailBar from "./PageThumbnailBar";

function PageRegion({ design, footer, first, html, onEdit }: { design: StudioDesign; footer?: boolean; first: boolean; html: string; onEdit: () => void }) {
  const edge = footer ? "bottom" : "top";
  const height = design.page.margins[edge] * 96;
  const editHeight = (footer ? design.page.footerHeight : design.page.headerHeight) * 96;
  const name = `${first ? "first-page" : "continuation"} ${footer ? "footer" : "header"}`;
  return <div className="cs-paper-region" data-region-name={name} data-margin={edge} style={{ [edge]: 0, left: design.page.margins.left * 96, right: design.page.margins.right * 96, height }}>
    <div className="cs-paper-region-content" style={{ position: "relative", minHeight: Math.min(height, editHeight) }}>
      <div inert dangerouslySetInnerHTML={{ __html: html }}/>
      <button className="cs-paper-region-edit" type="button" aria-label={`Edit ${name}`} onClick={onEdit}/>
    </div>
  </div>;
}

type CanvasProps = { design: StudioDesign; children: ReactNode; headers: [string, string]; footers: [string, string]; zoom: number; onPages: (count: number) => void; onRegion: (key: keyof StudioDesign["regions"]) => void; vertical?: boolean };
export default function PagedCanvas(props: CanvasProps) { return props.vertical ? <VerticalPagedCanvas {...props}/> : <HorizontalPagedCanvas {...props}/>; }
function HorizontalPagedCanvas({ design, children, headers, footers, zoom, onPages, onRegion }: CanvasProps) {
  const rail = useRef<HTMLDivElement>(null), flow = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(1), [issue, setIssue] = useState("");
  const [currentPage,setCurrentPage]=useState(1);
  const metrics = paginationMetrics(design);
  const [availableWidth, setAvailableWidth] = useState(0);
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setAvailableWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const scale = zoom ? zoom / 100 : availableWidth ? Math.min(1, availableWidth / metrics.width) : 1;
  const previousScale=useRef(scale);
  const [firstHeader, continuationHeader] = headers, [firstFooter, continuationFooter] = footers;
  useLayoutEffect(()=>{const viewport=rail.current;if(viewport&&previousScale.current!==scale){viewport.scrollLeft*=scale/previousScale.current;viewport.scrollTop*=scale/previousScale.current;}previousScale.current=scale;},[scale]);
  useEffect(() => {
    const root = flow.current, viewport = rail.current; if (!root || !viewport) return;
    let frame = 0, composing = false, disposed = false;
    const measure = () => { if (composing || disposed) return; cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {
      const editable = root.querySelector<HTMLElement>(".cs-editable"); if (!editable) return;
      const count = flowPageCount(editable.scrollWidth, metrics.bodyWidth, metrics.columnGap);
      const oversized = [...editable.querySelectorAll<HTMLElement>("tr,[data-studio-atomic],[data-keep-together]")].some(element => element.getBoundingClientRect().height / scale > metrics.bodyHeight + 2);
      const clippedRegion = [...viewport.querySelectorAll<HTMLElement>(".cs-paper-region")].find(element => element.scrollHeight > element.clientHeight + 2);
      setIssue(count > 200 ? "This design exceeds the 200-page editing limit. Split it into smaller pieces." : oversized ? "A table row, image or grouped block is taller than one page. Resize or split it before proofing." : clippedRegion ? `The ${clippedRegion.dataset.regionName} exceeds the ${clippedRegion.dataset.margin} margin. Adjust the margin in Design settings or reduce the region content.` : "");
      setPages(Math.min(count, 200)); onPages(Math.min(count, 200));
    }); };
    const start = () => { composing = true; }, end = () => { composing = false; measure(); };
    const mutation = new MutationObserver(measure), resize = new ResizeObserver(measure);
    mutation.observe(root, { childList: true, subtree: true, characterData: true, attributes: true }); resize.observe(root);
    root.addEventListener("compositionstart", start); root.addEventListener("compositionend", end); viewport.addEventListener("load", measure, true);
    void document.fonts.ready.then(measure); measure();
    return () => { disposed = true; cancelAnimationFrame(frame); mutation.disconnect(); resize.disconnect(); root.removeEventListener("compositionstart", start); root.removeEventListener("compositionend", end); viewport.removeEventListener("load", measure, true); };
  }, [metrics.bodyWidth, metrics.bodyHeight, metrics.columnGap, onPages, scale, design, firstHeader, continuationHeader, firstFooter, continuationFooter]);
  const thumbnailHtml = renderStudio(design,emptyDonor(),{version:1,identity:{},profiles:[],presets:[],signers:[],defaultSignerId:null}).html;
  const totalWidth = pages * metrics.pitch - metrics.gap;
  const selectPage=(page:number)=>{setCurrentPage(page);rail.current?.scrollTo({left:(page-1)*metrics.pitch*scale,behavior:"instant"});};
  const chrome = (html: string, page: number) => html.replace(/(<span[^>]*data-studio-page-number[^>]*>)[\s\S]*?<\/span>/g, `$1${page}</span>`).replace(/(<span[^>]*data-studio-total-pages[^>]*>)[\s\S]*?<\/span>/g, `$1${pages}</span>`);
  return <div className="cs-paged-canvas">{issue && <div className="oc-error cs-page-warning" role="alert">{issue}</div>}<div className="cs-page-rail" ref={rail} role="region" aria-label="Document pages" tabIndex={0} onScroll={()=>{if(rail.current)setCurrentPage(Math.max(1,Math.min(pages,Math.round(rail.current.scrollLeft/(metrics.pitch*scale))+1)));}}><div style={{ width: totalWidth * scale, height: metrics.height * scale, position: "relative" }}><div className="cs-page-track" style={{ width: totalWidth, height: metrics.height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
    <style>{studioContentCss(design)}{studioRegionCss(".cs-paper-region-content")}{`.cs-editable{width:${metrics.bodyWidth}px;height:${metrics.bodyHeight}px;column-width:${metrics.bodyWidth}px;column-gap:${metrics.columnGap}px;column-fill:auto;outline:none;min-height:0}`}</style>
    {Array.from({ length: pages }, (_, index) => <div key={index} className="cs-paper-page" style={{ left: index * metrics.pitch, width: metrics.width, height: metrics.height, background: design.styles.background }}>
      <PageRegion design={design} first={!index} html={chrome(headers[index ? 1 : 0], index + 1)} onEdit={() => onRegion(index ? "header" : "firstHeader")}/>
      <PageRegion design={design} first={!index} footer html={chrome(footers[index ? 1 : 0], index + 1)} onEdit={() => onRegion(index ? "footer" : "firstFooter")}/>
    </div>)}
    <div ref={flow} className="cs-flow-origin" style={{ position: "absolute", left: design.page.margins.left * 96, top: design.page.margins.top * 96, width: metrics.bodyWidth, height: metrics.bodyHeight }}>{children}</div>
  </div></div></div><PageThumbnailBar pages={pages} current={Math.min(currentPage,pages)} html={thumbnailHtml} metrics={metrics} onSelect={selectPage}/></div>;
}


function VerticalPagedCanvas({design, children, headers, footers, zoom, onPages, onRegion}: CanvasProps) {
  const rail = useRef<HTMLDivElement>(null), [width,setWidth]=useState(0), [pages,setPages]=useState(1),[issue,setIssue]=useState("");
  const metrics=paginationMetrics(design), pitch=metrics.height+28;
  const previousScale=useRef(1);
  const scale=zoom?zoom/100:Math.max(.5,Math.min(1.3,Math.floor((width-55)/metrics.width*20)/20));
  useEffect(()=>{rail.current?.dispatchEvent(new CustomEvent("create-page-scale",{bubbles:true,detail:Math.round(scale*100)}));},[scale]);
  useLayoutEffect(()=>{if(rail.current&&previousScale.current!==scale){rail.current.scrollTop*=scale/previousScale.current;rail.current.scrollLeft*=scale/previousScale.current;}previousScale.current=scale;},[scale]);
  useEffect(()=>{const element=rail.current;if(!element)return;const observer=new ResizeObserver(([entry])=>setWidth(entry.borderBoxSize[0]?.inlineSize||entry.contentRect.width));observer.observe(element);return()=>observer.disconnect();},[]);
  useEffect(()=>{
    const element=rail.current;if(!element)return;
    const layout=(event:Event)=>{const detail=(event as CustomEvent<{pages:number;issue?:string}>).detail;const count=detail.pages;setIssue(detail.issue||"");setPages(count);onPages(count);};
    const jump=(event:Event)=>element.scrollTo({top:((event as CustomEvent<number>).detail-1)*pitch*scale,behavior:"instant"});
    element.addEventListener("create-page-layout",layout);element.addEventListener("create-jump-page",jump);
    const editor=element.querySelector(".cs-editable");editor?.dispatchEvent(new Event("create-measure-pages"));
    return()=>{element.removeEventListener("create-page-layout",layout);element.removeEventListener("create-jump-page",jump);};
  },[onPages,pitch,scale]);
  const chrome=(html:string,page:number)=>html.replace(/(<span[^>]*data-studio-page-number[^>]*>)[\s\S]*?<\/span>/g,`$1${page}</span>`).replace(/(<span[^>]*data-studio-total-pages[^>]*>)[\s\S]*?<\/span>/g,`$1${pages}</span>`);
  return <div className="cs-paged-canvas cv5-vertical">{issue&&<div className="oc-error cs-page-warning" role="alert">{issue}</div>}<div className="cs-page-rail" ref={rail} role="region" aria-label="Document pages" tabIndex={0} onScroll={()=>{if(rail.current)rail.current.dispatchEvent(new CustomEvent("create-page-position",{bubbles:true,detail:Math.max(1,Math.min(pages,Math.floor(rail.current.scrollTop/(pitch*scale))+1))}));}}>
    <div className="cv5-paper-frame" style={{width:metrics.width*scale,height:(pages*pitch-28)*scale}}><div className="cv5-paper-track" style={{width:metrics.width,height:pages*pitch-28,transform:`scale(${scale})`,transformOrigin:"top left"}}>
      <style>{studioContentCss(design,".cv5-flow .cs-editable")}{studioRegionCss(".cv5-paper-track .cs-paper-region-content")}{`.cv5-flow .cs-editable{width:${metrics.bodyWidth}px!important;height:auto!important;min-height:${metrics.bodyHeight}px;columns:auto!important;padding:0!important;outline:none}.cv5-flow [data-letter-page-break]{break-before:auto!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important}.cv5-flow .cs-block-label{display:none}`}</style>
      {Array.from({length:pages},(_,index)=><div className="cs-paper-page" data-page-number={index+1} key={index} style={{top:index*pitch,width:metrics.width,height:metrics.height,background:design.styles.background,"--guide-top":`${design.page.margins.top*96}px`,"--guide-right":`${design.page.margins.right*96}px`,"--guide-bottom":`${design.page.margins.bottom*96}px`,"--guide-left":`${design.page.margins.left*96}px`} as CSSProperties}>
        <div className="cv5-ruler" aria-hidden="true">{Array.from({length:Math.ceil(metrics.width/96)},(_,i)=><span key={i} style={{left:i*96}}>{i}</span>)}</div>
        <PageRegion design={design} first={!index} html={chrome(headers[index?1:0],index+1)} onEdit={()=>onRegion(index?"header":"firstHeader")}/>
        <PageRegion design={design} footer first={!index} html={chrome(footers[index?1:0],index+1)} onEdit={()=>onRegion(index?"footer":"firstFooter")}/>
      </div>)}
      <div className="cv5-flow" style={{position:"absolute",left:design.page.margins.left*96,top:design.page.margins.top*96,width:metrics.bodyWidth}}>{children}</div>
    </div></div>
  </div></div>;
}
