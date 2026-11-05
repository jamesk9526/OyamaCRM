import { dimensions } from "./design.js";
import type { StudioDesign } from "./types.js";
export const STUDIO_REGION_INSET_PX = 8;

export function studioRegionCss(root: string) {
  return `${root}{box-sizing:border-box;padding-top:${STUDIO_REGION_INSET_PX}px;font:9pt/normal Inter,Arial,sans-serif;text-align:left}${root} *{box-sizing:border-box}${root} img{display:inline;vertical-align:baseline}${root} strong,${root} b{font-weight:bolder}`;
}

/** Shared content metrics for editable fragmentation and the frozen Chromium proof. */
export function studioContentCss(design: StudioDesign, root = ".studio-content"): string {
  const s = design.styles;
  return `${root}{font-family:'${s.font}',serif;font-size:${s.fontSize}pt;line-height:${s.lineHeight};color:${s.color};overflow-wrap:anywhere;text-align:left}
${root} *{box-sizing:border-box}${root} p{margin:0 0 ${s.paragraphSpacing}pt;orphans:2;widows:2}${root} h1,${root} h2,${root} h3{font-weight:700;line-height:1.2;margin:0 0 12pt;break-after:avoid}${root} h1{font-size:24pt}${root} h2{font-size:18pt}${root} h3{font-size:14pt}
${root} ul{list-style:disc;padding-left:22pt}${root} ol{list-style:decimal;padding-left:22pt}${root} blockquote{border-left:3pt solid ${s.primary};padding-left:12pt;margin:9pt 0}${root} a{color:${s.primary};text-decoration:underline}
${root} table{width:100%;table-layout:fixed;border-collapse:collapse}${root} thead{display:table-header-group}${root} tr{break-inside:avoid}${root} td,${root} th{border:1px solid #c7d3df;padding:6pt;vertical-align:top;min-width:20px;overflow-wrap:anywhere}${root} th{background:#edf4fc;font-weight:600}
${root} img{max-width:100%;height:auto}${root} figure{margin:9pt 0;break-inside:avoid}${root} [data-keep-together],${root} [data-studio-atomic]{break-inside:avoid}${root} [data-letter-page-break]{break-before:column;height:0;margin:0;padding:0}${root} hr{border:0;border-top:1px solid #c7d3df;margin:12pt 0}`;
}
export function paginationMetrics(design: StudioDesign, gap = 28) {
  const size = dimensions(design.page); return { ...size, gap, pitch: size.width + gap, columnGap: size.width + gap - size.bodyWidth };
}
export function flowPageCount(scrollWidth: number, bodyWidth: number, columnGap: number) { return Math.max(1, Math.ceil((Math.max(bodyWidth, scrollWidth) + columnGap - 2) / (bodyWidth + columnGap))); }
