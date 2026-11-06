import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { paginateFlow, type FlowLine, type FlowBreak } from "@/server/src/oyama-create/studio/pagination";
import { dimensions } from "@/server/src/oyama-create/studio/design";
import type { StudioDesign } from "@/server/src/oyama-create/studio/types";

const key = new PluginKey<{ decorations: DecorationSet; breaks: FlowBreak[] }>("createVerticalPagination");
function measuredLines(view: EditorView): FlowLine[] {
  const root = view.dom, origin = root.getBoundingClientRect();
  const scale = origin.width / root.offsetWidth || 1, lines: FlowLine[] = [];
  const box = (element: HTMLElement, position: number, table = false) => { const rect = element.getBoundingClientRect(); lines.push({ position, top: (rect.top - origin.top) / scale, bottom: (rect.bottom - origin.top) / scale, table }); };
  view.state.doc.descendants((node, position) => {
    const element = view.nodeDOM(position);
    if (!(element instanceof HTMLElement)) return;
    if (node.type.name === "letterPageBreak") { const top = (element.getBoundingClientRect().top - origin.top) / scale; lines.push({ position, top, bottom: top, hardBreak: true }); return false; }
    if (node.type.name === "table") {
      const first=node.firstChild,head=[...element.querySelectorAll("tr")].find(row=>!row.closest("[data-create-page-gap]")),hasHeader=first?.childCount&&Array.from({length:first.childCount},(_,i)=>first.child(i).type.name).every(name=>name==="tableHeader");
      const headerHeight=hasHeader&&head?head.getBoundingClientRect().height/scale:0;
      node.forEach((row, offset) => { const dom = view.nodeDOM(position + 1 + offset); if (dom instanceof HTMLElement) { box(dom, position + 1 + offset, true);const line=lines[lines.length-1];line.columns=Array.from({length:row.childCount},(_,i)=>Number(row.child(i).attrs.colspan)||1).reduce((a,b)=>a+b,0);if(offset>0)line.headerHeight=headerHeight;else if(hasHeader)line.keepWithNext=true; } }); return false;
    }
    if ((node.isAtom && !node.isInline) || node.attrs.keepTogether || node.attrs.keepWithNext || node.type.name==="heading") { box(element, position);lines[lines.length-1].keepWithNext=!!node.attrs.keepWithNext||node.type.name==="heading";return false; }
    if (!["paragraph", "heading"].includes(node.type.name)) return;
    const firstLine=lines.length;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT); let text: globalThis.Node | null;
    let current: FlowLine | null = null;
    while ((text = walker.nextNode())) {
      if (text.parentElement?.closest("[data-create-page-gap]")) continue;
      const value = text.textContent || "";
      for (const word of value.matchAll(/\S+\s*/g)) {
        const range = document.createRange(); range.setStart(text, word.index!); range.setEnd(text, word.index! + word[0].trimEnd().length);
        const rect = range.getBoundingClientRect(); if (!rect.height) continue;
        const top = (rect.top - origin.top) / scale, bottom = (rect.bottom - origin.top) / scale;
        if (current && Math.abs(current.top - top) < 2) current.bottom = Math.max(current.bottom, bottom);
        else { let from: number; try { from = view.posAtDOM(text, word.index!); } catch { continue; } current = { position: from, top, bottom }; lines.push(current); }
      }
    }
    if (!current) box(element, position + 1);
    else if(lines.length-firstLine>=2){lines[firstLine].keepWithNext=true;lines[lines.length-2].keepWithNext=true;}
    return false;
  });
  return lines;
}
export default Extension.create<{ enabled: () => boolean; design: () => StudioDesign }>({
  name: "createVerticalPagination", addOptions: () => ({ enabled: () => false, design: () => { throw new Error("Pagination requires page geometry."); } }),
  addProseMirrorPlugins() {
    const options = this.options;
    let activeView:EditorView|null=null;
    return [new Plugin<{decorations:DecorationSet;breaks:FlowBreak[]}>({
      key,
      state: {
        init: () => ({ decorations: DecorationSet.empty, breaks: [] }),
        apply(tr, previous) {
          const next = tr.getMeta(key) as { breaks: FlowBreak[] } | undefined;
          if (!next) return { ...previous, decorations: previous.decorations.map(tr.mapping, tr.doc) };
          const decorations = next.breaks.map(item => Decoration.widget(item.position, () => {
            const widget = document.createElement(item.table ? "tr" : "span"); widget.dataset.createPageGap = "true"; widget.contentEditable = "false"; widget.setAttribute("aria-hidden", "true");
            if (item.table) {
              const cell = document.createElement("td"); cell.colSpan = item.columns||1; cell.style.cssText = "padding:0!important;border:0!important;line-height:0";
              const blank=document.createElement("div");blank.style.height=`${Math.max(0,item.height-(item.headerHeight||0))}px`;cell.append(blank);
              if(item.headerHeight&&activeView){const row=activeView.nodeDOM(item.position);const header=row instanceof HTMLElement?[...(row.closest("table")?.querySelectorAll("tr")||[])].find(candidate=>!candidate.closest("[data-create-page-gap]")):null;if(header){const repeated=document.createElement("table");repeated.inert=true;repeated.style.margin="0";const cols=header.closest("table")?.querySelector("colgroup");if(cols)repeated.append(cols.cloneNode(true));repeated.append(header.cloneNode(true));cell.append(repeated);}}
              widget.append(cell);
            }
            else widget.style.cssText = `display:block;height:${item.height}px;margin:0;padding:0;border:0;line-height:0;pointer-events:none`;
            return widget;
          }, { side: -1, key: `${item.position}:${item.height}` }));
          return { breaks: next.breaks, decorations: DecorationSet.create(tr.doc, decorations) };
        },
      },
      props: { decorations: state => options.enabled() ? key.getState(state)?.decorations : null },
      view(view) {
        activeView=view;
        let frame = 0, disposed = false;
        const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
        const measure = () => {
          if (disposed || !options.enabled() || view.composing || !view.dom.isConnected || !view.dom.getBoundingClientRect().width) return;
          const widgets = view.dom.querySelectorAll<HTMLElement>("[data-create-page-gap]"); widgets.forEach(element => { element.style.display = "none"; });
          const metrics = dimensions(options.design().page), lines=measuredLines(view),result = paginateFlow(lines, metrics.bodyHeight, metrics.height + 28);
          widgets.forEach(element => { element.style.display = element.tagName === "TR" ? "table-row" : "block"; });
          const previous = key.getState(view.state);
          if (JSON.stringify(previous?.breaks) !== JSON.stringify(result.breaks)) view.dispatch(view.state.tr.setMeta(key, result).setMeta("addToHistory", false));
          const issue=lines.some(line=>line.bottom-line.top>metrics.bodyHeight+1)?"A row, image or preserved layout is taller than the printable page. Resize it, edit its HTML, or review its production PDF before approval.":result.pages>200?"This design exceeds the 200-page editing limit. Split it into smaller pieces.":"";
          view.dom.dispatchEvent(new CustomEvent("create-page-layout", { bubbles: true, detail: { pages: Math.min(200, result.pages),issue } }));
        };
        const resize = new ResizeObserver(schedule); resize.observe(view.dom);
        view.dom.addEventListener("load", schedule, true); view.dom.addEventListener("compositionend", schedule); view.dom.addEventListener("create-measure-pages", schedule);
        void document.fonts.ready.then(schedule); schedule();
        return { update(next, previous) { if (next.state.doc !== previous.doc) schedule(); }, destroy() { disposed = true;activeView=null; cancelAnimationFrame(frame); resize.disconnect(); view.dom.removeEventListener("load", schedule, true); view.dom.removeEventListener("compositionend", schedule); view.dom.removeEventListener("create-measure-pages", schedule); } };
      },
    })];
  },
});
