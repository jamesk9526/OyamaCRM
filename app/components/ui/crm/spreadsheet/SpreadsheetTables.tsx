"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import "./spreadsheet.css";

const EXCLUDED = '[data-spreadsheet="off"],[role="presentation"],.event-public-document,.custom-report-presentation,[data-public-document],[data-oyama-authored],[contenteditable="true"]';
const INTERACTIVE = 'input,textarea,select,button,a,[contenteditable="true"],[role="textbox"]';
type Cell = HTMLTableCellElement;
function matrix(table: HTMLTableElement): Cell[][] {
  const result: Cell[][] = [];
  Array.from(table.rows).filter(row => row.getClientRects().length).forEach((row,r) => {
    result[r] ??= [];
    let c = 0;
    Array.from(row.cells).filter(cell => cell.getClientRects().length).forEach(cell => {
      while(result[r][c]) c++;
      for(let dr=0;dr<cell.rowSpan;dr++) for(let dc=0;dc<cell.colSpan;dc++) {
        result[r+dr] ??= []; result[r+dr][c+dc] = cell;
      }
      c += cell.colSpan;
    });
  });
  return result;
}
function position(rows: Cell[][], cell: Cell) {
  for(let r=0;r<rows.length;r++) { const c=rows[r].indexOf(cell); if(c>=0) return {r,c}; }
  return null;
}
export function columnLabel(index: number): string {
  let label = "";
  for(let n=index+1;n>0;n=Math.floor((n-1)/26)) label=String.fromCharCode(65+(n-1)%26)+label;
  return label;
}
/** Progressive enhancement for internal native tables; record editing stays with each feature. */
export default function SpreadsheetTables() {
  const pathname = usePathname();
  useEffect(() => {
    const root = document.body;
    if(!root) return;
    let active: Cell | null = null, anchor: Cell | null = null, frame = 0, suppressClickUntil = 0;
    const originalCursor=document.body.style.cursor, originalSelect=document.body.style.userSelect;
    let highlighted: Cell[] = [];
    let suppressHeader: Cell | null = null;
    let resizing: {table: HTMLTableElement; header: Cell; x: number; width: number} | null = null;
    const tableFor = (target: Element) => {
      const table = target.closest<HTMLTableElement>('table[data-spreadsheet="true"]');
      return table && table.closest('[data-oyama-internal="true"]') && !table.closest(EXCLUDED) ? table : null;
    };
    const scan = () => {
      frame=0;
      root.querySelectorAll<HTMLTableElement>('table').forEach(table => {
        if(!table.closest('[data-oyama-internal="true"]') || table.closest(EXCLUDED) || table.closest('table table')) return;
        table.dataset.spreadsheet = "true";
        let column=0;
        Array.from(table.tHead?.rows[0]?.cells ?? []).forEach(cell=>{cell.dataset.sheetColumn=columnLabel(column);column+=cell.colSpan;});
        if(!table.querySelector('[data-sheet-focus="true"]')) {
          const first=matrix(table)[0]?.[0];
          if(first) { first.tabIndex=0; first.dataset.sheetFocus="true"; }
        }
      });
    };
    const schedule = () => { if(!frame) frame=requestAnimationFrame(scan); };
    scan();
    window.addEventListener("resize",schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(root,{childList:true,subtree:true});
    const select = (cell: Cell, extend = false) => {
      const table=tableFor(cell); if(!table) return;
      const rows=matrix(table), end=position(rows,cell); if(!end) return;
      if(!extend || !anchor?.isConnected || anchor.closest('table')!==table) anchor=cell;
      const start=position(rows,anchor!) ?? end;
      highlighted.forEach(item=>{delete item.dataset.sheetSelected;}); highlighted=[];
      for(let r=Math.min(start.r,end.r);r<=Math.max(start.r,end.r);r++) {
        for(let c=Math.min(start.c,end.c);c<=Math.max(start.c,end.c);c++) {
          const item=rows[r]?.[c]; if(item && !highlighted.includes(item)) {item.dataset.sheetSelected="true"; highlighted.push(item);}
        }
      }
      root.querySelectorAll<HTMLElement>('[data-sheet-focus="true"]').forEach(item=>{item.tabIndex=-1;delete item.dataset.sheetFocus;});
      active=cell; cell.tabIndex=0; cell.dataset.sheetFocus="true"; cell.focus({preventScroll:true});
      cell.scrollIntoView({block:"nearest",inline:"nearest"});
      const address=`${columnLabel(end.c)}${end.r+1}`;
      table.closest('.oyama-table-shell')?.dispatchEvent(new CustomEvent('crm:sheet-selection',{bubbles:true,detail:{address,count:highlighted.length}}));
    };
    const click = (event: MouseEvent) => {
      if(Date.now()<suppressClickUntil && (event.target as HTMLElement).closest("th")===suppressHeader) {event.preventDefault();event.stopPropagation();return;}
      const target=event.target as HTMLElement;
      if(target.closest(INTERACTIVE) || !tableFor(target)) return;
      const cell=target.closest<Cell>('td,th'); if(cell) select(cell,event.shiftKey);
    };
    const keydown = (event: KeyboardEvent) => {
      const target=event.target as HTMLElement, cell=target.closest<Cell>('td,th');
      if(!cell || target.closest(INTERACTIVE) || !tableFor(cell)) return;
      if(event.key==='Escape') {highlighted.forEach(item=>delete item.dataset.sheetSelected);highlighted=[];anchor=null;return;}
      if(event.key==='Enter' || event.key==='F2') {const control=cell.querySelector<HTMLElement>(INTERACTIVE);if(control) {event.preventDefault();control.focus();}return;}
      const keys=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End']; if(!keys.includes(event.key)) return;
      const rows=matrix(tableFor(cell)!), pos=position(rows,cell); if(!pos) return;
      let {r,c}=pos;
      if(event.key==='ArrowUp') r--;
      if(event.key==='ArrowDown') r+=cell.rowSpan;
      if(event.key==='ArrowLeft') c--;
      if(event.key==='ArrowRight') c+=cell.colSpan;
      if(event.key==='Home') {c=0;if(event.ctrlKey||event.metaKey) r=0;}
      if(event.key==='End') {if(event.ctrlKey||event.metaKey) r=rows.length-1;c=rows[r].length-1;}
      r=Math.max(0,Math.min(rows.length-1,r));c=Math.max(0,Math.min(rows[r].length-1,c));
      const next=rows[r]?.[c];if(next){event.preventDefault();select(next,event.shiftKey);}
    };
    const copy = (event: ClipboardEvent) => {
      const target=event.target as HTMLElement;
      if(!active?.isConnected || !tableFor(target) || target.closest(INTERACTIVE) || window.getSelection()?.toString()) return;
      const rows=matrix(tableFor(active)!), selected=new Set(highlighted.length ? highlighted : [active]);
      const text=rows.filter(row=>row.some(cell=>selected.has(cell))).map(row=>row.filter(cell=>selected.has(cell)).map(cell=>cell.innerText.trim().replace(/[\t\r\n]+/g,' ')).join('\t')).join('\n');
      if(event.clipboardData){event.preventDefault();event.clipboardData.setData('text/plain',text);}
    };
    const pointerdown = (event: PointerEvent) => {
      const target=event.target as HTMLElement, header=target.closest<Cell>('thead th');
      if(!header || !tableFor(header) || header.colSpan!==1 || Math.abs(header.getBoundingClientRect().right-event.clientX)>8) return;
      event.preventDefault();event.stopPropagation();
      const table=tableFor(header)!;
      Array.from(table.tHead?.rows[0]?.cells ?? []).forEach(cell=>{cell.style.width=`${cell.getBoundingClientRect().width}px`;});
      table.style.tableLayout='fixed';table.style.width=`${table.getBoundingClientRect().width}px`;
      resizing={table,header,x:event.clientX,width:header.getBoundingClientRect().width};
      document.body.style.cursor='col-resize';document.body.style.userSelect='none';
    };
    const pointermove = (event: PointerEvent) => {
      if(!resizing) return;
      const width=Math.max(56,resizing.width+event.clientX-resizing.x);
      const delta=width-resizing.header.getBoundingClientRect().width;
      resizing.table.style.width=`${resizing.table.getBoundingClientRect().width+delta}px`;
      resizing.header.style.width=`${width}px`;
    };
    const stopResize = () => {if(resizing) {suppressClickUntil=Date.now()+150;suppressHeader=resizing.header;}resizing=null;document.body.style.cursor=originalCursor;document.body.style.userSelect=originalSelect;};
    root.addEventListener('click',click,true);root.addEventListener('keydown',keydown);root.addEventListener('copy',copy);
    root.addEventListener('pointerdown',pointerdown,true);document.addEventListener('pointermove',pointermove);document.addEventListener('pointerup',stopResize);
    return () => { observer.disconnect();window.removeEventListener("resize",schedule);cancelAnimationFrame(frame);stopResize();
      root.removeEventListener('click',click,true);root.removeEventListener('keydown',keydown);root.removeEventListener('copy',copy);root.removeEventListener('pointerdown',pointerdown,true);
      document.removeEventListener('pointermove',pointermove);document.removeEventListener('pointerup',stopResize);
    };
  },[pathname]);
  return null;
}
