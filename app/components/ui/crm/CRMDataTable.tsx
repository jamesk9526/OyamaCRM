"use client";

/** Shared table shell for refreshed Donor CRM list pages. */
import { useState, type KeyboardEvent, type ReactNode } from "react";
import CRMCard from "@/app/components/ui/crm/CRMCard";

interface CRMDataTableProps {
  children: ReactNode;
  className?: string;
}

/** CRMDataTable provides a softer scroll container while preserving native table markup inside. */
export default function CRMDataTable({ children, className = "" }: CRMDataTableProps) {
  const [compact, setCompact] = useState(false);
  function navigateCell(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("input,button,a,select,textarea,[contenteditable=true]")) return;
    const cell = target.closest<HTMLTableCellElement>("td,th");
    if (!cell || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const table = cell.closest("table");
    if (!table) return;
    const rows = Array.from(table.rows);
    const row = rows.indexOf(cell.parentElement as HTMLTableRowElement);
    let nextRow = row, nextColumn = cell.cellIndex;
    if (event.key === "ArrowUp") nextRow--;
    if (event.key === "ArrowDown") nextRow++;
    if (event.key === "ArrowLeft") nextColumn--;
    if (event.key === "ArrowRight") nextColumn++;
    if (event.key === "Home") nextColumn = 0;
    if (event.key === "End") nextColumn = rows[row].cells.length - 1;
    const next = rows[Math.max(0, Math.min(rows.length - 1, nextRow))]?.cells[Math.max(0, nextColumn)];
    if (next) { event.preventDefault(); cell.tabIndex = -1; next.tabIndex = 0; next.focus(); }
  }
  return (
    <CRMCard padding="none" className={`oyama-table-shell overflow-hidden ${className}`}>
      <div className="crm-table-toolbar"><span>Records <small className="hidden md:inline">· Click a cell, then use arrow keys to navigate</small></span><button type="button" aria-pressed={compact} onClick={() => setCompact(value => !value)}>{compact ? "Comfortable rows" : "Compact rows"}</button></div>
      <div onKeyDown={navigateCell} onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("a,button,input,select,textarea")) return;
        const cell = target.closest<HTMLTableCellElement>("td,th");
        if (cell) {
          event.currentTarget.querySelectorAll<HTMLElement>("td[tabindex],th[tabindex]").forEach(item => { item.tabIndex = -1; });
          cell.tabIndex = 0; cell.focus({ preventScroll: true });
        }
      }} tabIndex={0} role="region" aria-label="Records table" data-density={compact ? "compact" : "comfortable"} className="crm-table-scroll max-w-full overflow-x-auto border-t border-slate-100">
        {children}
      </div>
    </CRMCard>
  );
}
