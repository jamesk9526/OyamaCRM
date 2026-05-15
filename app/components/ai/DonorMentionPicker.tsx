/**
 * DonorMentionPicker — floating autocomplete dropdown triggered by "@" in the composer.
 * Searches constituents by name and injects a structured @[Name](id) mention tag
 * into the draft on selection.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

export interface MentionedDonor {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  donorStatus: string | null;
  totalLifetimeGiving?: number | null;
  lastGiftDate?: string | null;
}

interface Props {
  /** The raw text currently in the query after the "@" symbol. */
  query: string;
  /** Called when the user selects a donor. */
  onSelect: (donor: MentionedDonor) => void;
  /** Called when the picker should be dismissed (Escape, click-outside handled by parent). */
  onDismiss: () => void;
  /** Position hint — "above" the composer input. */
  anchorRef: React.RefObject<HTMLElement | null>;
}

/** Debounce helper */
function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function DonorMentionPicker({ query, onSelect, onDismiss, anchorRef }: Props) {
  const [results, setResults]   = useState<MentionedDonor[]>([]);
  const [loading, setLoading]   = useState(false);
  const [cursor, setCursor]     = useState(0);
  const listRef                 = useRef<HTMLDivElement>(null);
  const debouncedQuery          = useDebounce(query, 200);

  // Search constituents when query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    apiFetch<MentionedDonor[]>(`/api/constituents?search=${encodeURIComponent(debouncedQuery)}&limit=8`)
      .then((data) => { setResults(data); setCursor(0); })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  // Keyboard navigation — parent must forward keydown events here
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!results.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        const chosen = results[cursor];
        if (chosen) { e.preventDefault(); onSelect(chosen); }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [results, cursor, onSelect, onDismiss]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const displayName = (d: MentionedDonor) =>
    [d.firstName, d.lastName].filter(Boolean).join(" ") || d.email || "Unknown";

  if (!debouncedQuery.trim() && !loading) return null;

  return (
    <div
      ref={listRef as React.RefObject<HTMLDivElement>}
      className="absolute bottom-full left-0 mb-2 z-50 w-72 rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
      role="listbox"
      aria-label="Donor mention picker"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-100 bg-slate-50">
        <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Mention donor{query ? ` — "${query}"` : ""}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto text-slate-300 hover:text-slate-500 text-xs"
          tabIndex={-1}
          aria-label="Close"
        >✕</button>
      </div>

      {/* Results */}
      <div className="max-h-[240px] overflow-y-auto">
        {loading && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a10 10 0 100 10" />
            </svg>
            Searching…
          </div>
        )}

        {!loading && results.length === 0 && debouncedQuery.trim() && (
          <div className="px-4 py-3 text-sm text-slate-400">No constituents found for &ldquo;{debouncedQuery}&rdquo;</div>
        )}

        {results.map((d, i) => (
          <button
            key={d.id}
            data-idx={i}
            type="button"
            role="option"
            aria-selected={i === cursor}
            onClick={() => onSelect(d)}
            onMouseEnter={() => setCursor(i)}
            className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${
              i === cursor ? "bg-emerald-50" : "hover:bg-slate-50"
            }`}
          >
            {/* Avatar */}
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 uppercase">
              {(d.firstName?.[0] ?? d.lastName?.[0] ?? "?").toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{displayName(d)}</p>
              <p className="truncate text-[11px] text-slate-400">
                {d.email ?? "No email"}
                {d.donorStatus ? ` · ${d.donorStatus}` : ""}
                {typeof d.totalLifetimeGiving === "number"
                  ? ` · $${d.totalLifetimeGiving.toLocaleString()}`
                  : ""}
              </p>
            </div>
            {i === cursor && (
              <span className="shrink-0 mt-1 text-[10px] text-emerald-600 font-medium">↵</span>
            )}
          </button>
        ))}
      </div>

      {/* Footer hint */}
      {results.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-1 text-[10px] text-slate-400">
          ↑↓ navigate · Enter select · Esc dismiss
        </div>
      )}
    </div>
  );
}
