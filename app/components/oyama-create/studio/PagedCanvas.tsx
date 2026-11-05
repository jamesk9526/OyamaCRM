"use client";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { emptyDonor, renderStudio } from "@/server/src/oyama-create/studio/render";
import type { StudioDesign } from "@/server/src/oyama-create/studio/types";
import { flowPageCount, paginationMetrics, studioContentCss } from "@/server/src/oyama-create/studio/layout";
import PageThumbnailBar from "./PageThumbnailBar";

export default function PagedCanvas({ design, children, headers, footers, zoom, onPages, onRegion }: { design: StudioDesign; children: ReactNode; headers: [string, string]; footers: [string, string]; zoom: number; onPages: (count: number) => void; onRegion: (key: keyof StudioDesign["regions"]) => void }) {
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
  useLayoutEffect(()=>{const viewport=rail.current;if(viewport&&previousScale.current!==scale){viewport.scrollLeft*=scale/previousScale.current;viewport.scrollTop*=scale/previousScale.current;}previousScale.current=scale;},[scale]);
  useEffect(() => {
    const root = flow.current; if (!root) return;
    let frame = 0, composing = false, disposed = false;
    const measure = () => { if (composing || disposed) return; cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {
      const editable = root.querySelector<HTMLElement>(".cs-editable"); if (!editable) return;
      const count = flowPageCount(editable.scrollWidth, metrics.bodyWidth, metrics.columnGap);
      const oversized = [...editable.querySelectorAll<HTMLElement>("tr,[data-studio-atomic],[data-keep-together]")].some(element => element.getBoundingClientRect().height / scale > metrics.bodyHeight + 2);
      setIssue(count > 200 ? "This design exceeds the 200-page editing limit. Split it into smaller pieces." : oversized ? "A table row, image or grouped block is taller than one page. Resize or split it before proofing." : "");
      setPages(Math.min(count, 200)); onPages(Math.min(count, 200));
    }); };
    const start = () => { composing = true; }, end = () => { composing = false; measure(); };
    const mutation = new MutationObserver(measure), resize = new ResizeObserver(measure);
    mutation.observe(root, { childList: true, subtree: true, characterData: true, attributes: true }); resize.observe(root);
    root.addEventListener("compositionstart", start); root.addEventListener("compositionend", end); root.addEventListener("load", measure, true);
    void document.fonts.ready.then(measure); measure();
    return () => { disposed = true; cancelAnimationFrame(frame); mutation.disconnect(); resize.disconnect(); root.removeEventListener("compositionstart", start); root.removeEventListener("compositionend", end); root.removeEventListener("load", measure, true); };
  }, [metrics.bodyWidth, metrics.bodyHeight, metrics.columnGap, onPages, scale, design]);
  const thumbnailHtml = renderStudio(design,emptyDonor(),{version:1,identity:{},profiles:[],presets:[],signers:[],defaultSignerId:null}).html;
  const totalWidth = pages * metrics.pitch - metrics.gap;
  const selectPage=(page:number)=>{setCurrentPage(page);rail.current?.scrollTo({left:(page-1)*metrics.pitch*scale,behavior:"instant"});};
  const chrome = (html: string, page: number) => html.replace(/(<span[^>]*data-studio-page-number[^>]*>)[\s\S]*?<\/span>/g, `$1${page}</span>`).replace(/(<span[^>]*data-studio-total-pages[^>]*>)[\s\S]*?<\/span>/g, `$1${pages}</span>`);
  return <div className="cs-paged-canvas">{issue && <div className="oc-error cs-page-warning" role="alert">{issue}</div>}<div className="cs-page-rail" ref={rail} role="region" aria-label="Document pages" tabIndex={0} onScroll={()=>{if(rail.current)setCurrentPage(Math.max(1,Math.min(pages,Math.round(rail.current.scrollLeft/(metrics.pitch*scale))+1)));}}><div style={{ width: totalWidth * scale, height: metrics.height * scale, position: "relative" }}><div className="cs-page-track" style={{ width: totalWidth, height: metrics.height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
    <style>{studioContentCss(design)}{`.cs-editable{width:${metrics.bodyWidth}px;height:${metrics.bodyHeight}px;column-width:${metrics.bodyWidth}px;column-gap:${metrics.columnGap}px;column-fill:auto;outline:none;min-height:0}`}</style>
    {Array.from({ length: pages }, (_, index) => <div key={index} className="cs-paper-page" style={{ left: index * metrics.pitch, width: metrics.width, height: metrics.height, background: design.styles.background }}><button type="button" aria-label={index ? "Edit continuation header" : "Edit first-page header"} className="cs-paper-header" style={{ left: design.page.margins.left * 96, right: design.page.margins.right * 96, top: 10, height: design.page.headerHeight * 96 }} onClick={() => onRegion(index ? "header" : "firstHeader")} dangerouslySetInnerHTML={{ __html: chrome(headers[index ? 1 : 0], index + 1) }}/><button type="button" aria-label={index ? "Edit continuation footer" : "Edit first-page footer"} className="cs-paper-footer" style={{ left: design.page.margins.left * 96, right: design.page.margins.right * 96, bottom: 10, height: design.page.footerHeight * 96 }} onClick={() => onRegion(index ? "footer" : "firstFooter")} dangerouslySetInnerHTML={{ __html: chrome(footers[index ? 1 : 0], index + 1) }}/></div>)}
    <div ref={flow} className="cs-flow-origin" style={{ position: "absolute", left: design.page.margins.left * 96, top: design.page.margins.top * 96, width: metrics.bodyWidth, height: metrics.bodyHeight }}>{children}</div>
  </div></div></div><PageThumbnailBar pages={pages} current={Math.min(currentPage,pages)} html={thumbnailHtml} metrics={metrics} onSelect={selectPage}/></div>;
}
