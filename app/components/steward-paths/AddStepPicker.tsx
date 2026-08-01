/** Searchable insertion dialog used by every plus button in the visual builder. */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_LABELS, PALETTE_ITEMS } from "./palette-catalog";
import type { NodeCategory, NodePaletteItem } from "./workflow-types";

interface AddStepPickerProps {
  open: boolean;
  targetLabel: string;
  allowTriggers: boolean;
  onClose: () => void;
  onAdd: (item: NodePaletteItem) => void;
}

const CATEGORY_ORDER: NodeCategory[] = ["trigger", "timing", "email", "print", "task", "livecom", "donor-data", "logic", "safety"];

function categoryTone(category: NodeCategory): string {
  if (category === "trigger") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (category === "logic" || category === "timing") return "border-violet-200 bg-violet-50 text-violet-800";
  if (category === "safety") return "border-rose-200 bg-rose-50 text-rose-800";
  if (category === "email") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-slate-200 bg-slate-50 text-slate-800";
}

export default function AddStepPicker({ open, targetLabel, allowTriggers, onClose, onAdd }: AddStepPickerProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<NodeCategory | "all">("all");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCategory("all");
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return PALETTE_ITEMS.filter((item) => allowTriggers || item.category !== "trigger")
      .filter((item) => category === "all" || item.category === category)
      .filter((item) => !needle || `${item.label} ${item.summary} ${item.kind}`.toLowerCase().includes(needle));
  }, [allowTriggers, category, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="add-step-title">
      <button type="button" className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" onClick={onClose} aria-label="Close step picker" />
      <div className="relative flex max-h-[82dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_32px_100px_rgba(15,23,42,0.3)]">
        <header className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc,#eef6ff)] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0f6cbd]">Insert into path</p>
              <h2 id="add-step-title" className="mt-1 text-xl font-semibold text-slate-950">Choose a block</h2>
              <p className="mt-1 text-sm text-slate-600">{targetLabel}</p>
            </div>
            <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100" aria-label="Close step picker">×</button>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              ref={inputRef}
              type="search"
              aria-label="Search blocks"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search actions, conditions, waits, and safeguards"
              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0f6cbd] focus:ring-2 focus:ring-[#0f6cbd]/15"
            />
            <select aria-label="Filter blocks by type" value={category} onChange={(event) => setCategory(event.target.value as NodeCategory | "all")} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700">
              <option value="all">All block types</option>
              {CATEGORY_ORDER.filter((item) => allowTriggers || item !== "trigger").map((item) => <option key={item} value={item}>{CATEGORY_LABELS[item]}</option>)}
            </select>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visibleItems.map((item) => (
              <button
                key={item.kind}
                type="button"
                onClick={() => onAdd(item)}
                className={`group rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-[#0f6cbd] hover:shadow-md ${categoryTone(item.category)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold">{item.label}</span>
                  <span className="rounded-full border border-current/20 bg-white/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">{item.category}</span>
                </div>
                <p className="mt-1 text-xs leading-5 opacity-80">{item.summary}</p>
                <p className="mt-2 text-[10px] font-medium opacity-60">{item.kind}</p>
              </button>
            ))}
          </div>
          {visibleItems.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">No blocks match this search.</div> : null}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
          <span>{visibleItems.length} blocks available</span>
          <span>Esc closes · select once to insert</span>
        </footer>
      </div>
    </div>
  );
}
