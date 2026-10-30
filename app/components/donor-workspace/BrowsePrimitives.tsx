import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";

export function DonorQuickViews({ label, items }: { label: string; items: Array<{ label: string; active: boolean; onClick: () => void }> }) {
  return <div className="donor-quick-views" role="group" aria-label={label}>{items.map((item) => <button key={item.label} type="button" aria-pressed={item.active} onClick={item.onClick}>{item.label}</button>)}</div>;
}

export function DonorFilterPanel({ children, count = 0 }: { children: ReactNode; count?: number }) {
  return <details className="donor-filter-panel"><summary><SlidersHorizontal size={15} aria-hidden="true" />Refine filters{count > 0 && <span>{count} applied</span>}</summary><div className="donor-filter-fields">{children}</div></details>;
}

export function DonorFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <button type="button" className="donor-filter-chip" onClick={onRemove} aria-label={`Remove filter: ${label}`}>{label}<X size={12} aria-hidden="true" /></button>;
}

export function DonorSelectionBar({ count, noun, description, onClear, children }: { count: number; noun: string; description: string; onClear: () => void; children: ReactNode }) {
  return <section className="donor-selection-bar" aria-label="Selected records"><div aria-live="polite"><strong>{count.toLocaleString()} {noun}{count === 1 ? "" : "s"} selected</strong><p>{description}</p></div><div className="donor-selection-actions">{children}<button className="donor-button" type="button" onClick={onClear}>Clear selection</button></div></section>;
}

export function DonorPagination({ page, pageSize, total, totalPages, loading, onPage, onPageSize }: { page: number; pageSize: number; total: number; totalPages: number; loading: boolean; onPage: (page: number) => void; onPageSize?: (size: number) => void }) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  return <div className="donor-pagination"><p aria-live="polite">{loading ? "Updating results…" : `${start.toLocaleString()}–${Math.min(page * pageSize, total).toLocaleString()} of ${total.toLocaleString()} records`}</p><div>{onPageSize && <label>Rows per page<select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))}>{[25, 50, 100, 250, 500].map((size) => <option value={size} key={size}>{size}</option>)}</select></label>}<button className="donor-button" type="button" disabled={loading || page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={14} />Previous</button><span>Page {page} of {Math.max(1, totalPages)}</span><button className="donor-button" type="button" disabled={loading || page >= Math.max(1, totalPages)} onClick={() => onPage(page + 1)}>Next<ChevronRight size={14} /></button></div></div>;
}
