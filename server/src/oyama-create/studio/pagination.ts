/** Geometry only. Page boundaries never enter document JSON or undo history. */
export type FlowLine = { position: number; top: number; bottom: number; hardBreak?: boolean; table?: boolean; columns?: number; headerHeight?: number; keepWithNext?: boolean };
export type FlowBreak = { position: number; height: number; table: boolean; columns?: number; headerHeight?: number };
export function paginateFlow(lines: FlowLine[], bodyHeight: number, pagePitch: number) {
  const breaks: FlowBreak[] = []; let offset = 0, page = 0, last = 0;
  for (let index=0;index<lines.length;index++) {
    const line=lines[index];let groupEnd=index;
    while(groupEnd<lines.length-1&&lines[groupEnd].keepWithNext&&!lines[groupEnd+1].hardBreak)groupEnd++;
    const top = line.top + offset, bottom = line.bottom + offset;
    const keepGroup=groupEnd>index&&lines[groupEnd].bottom-line.top<=bodyHeight&&lines[groupEnd].bottom+offset>page*pagePitch+bodyHeight+1;
    if (line.hardBreak || keepGroup || bottom > page * pagePitch + bodyHeight + 1) {
      if (line.bottom - line.top > bodyHeight + 1) { last=Math.max(last,bottom);page=Math.floor(bottom/pagePitch);continue; }
      const next = Math.max(page + 1, Math.floor(top / pagePitch));
      const height = Math.max(0, next * pagePitch - top) + (line.table ? line.headerHeight || 0 : 0);
      if (height > 0) { breaks.push({ position: line.position, height, table: line.table === true, ...(line.columns?{columns:line.columns}:{}), ...(line.headerHeight?{headerHeight:line.headerHeight}:{}) }); offset += height; }
      page = next;
    }
    last = Math.max(last, line.bottom + offset);
  }
  return { breaks, pages: Math.max(1, Math.ceil((last + pagePitch - bodyHeight) / pagePitch)) };
}
