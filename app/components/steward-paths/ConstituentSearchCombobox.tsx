/**
 * ConstituentSearchCombobox — inline search-by-name picker used by the
 * Steward Paths builder "Test Workflow" flow.
 * Fetches from GET /api/constituents?search=&limit=8 and returns the
 * selected constituent's id + display name to the parent.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface ConstituentResult {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  donorStatus: string | null;
}

interface ConstituentSearchComboboxProps {
  /** Called when the user confirms a constituent (selects and clicks Run). */
  onConfirm: (id: string, displayName: string) => void;
  /** Called when the user dismisses without selecting. */
  onCancel: () => void;
  disabled?: boolean;
}

function fullName(c: ConstituentResult): string {
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || c.id;
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function ConstituentSearchCombobox({
  onConfirm,
  onCancel,
  disabled,
}: ConstituentSearchComboboxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ConstituentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<ConstituentResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 220);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch results whenever debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    if (selected && fullName(selected) === debouncedQuery) {
      // Query matches the already-selected item — skip re-fetch
      return;
    }
    setLoading(true);
    apiFetch<ConstituentResult[]>(
      `/api/constituents?search=${encodeURIComponent(debouncedQuery)}&limit=8`,
    )
      .then((data) => {
        setResults(data);
        setCursor(0);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery, selected]);

  function handleSelect(c: ConstituentResult) {
    setSelected(c);
    setQuery(fullName(c));
    setResults([]);
  }

  function handleConfirm() {
    const target = selected ?? (results[0] ?? null);
    if (!target) return;
    onConfirm(target.id, fullName(target));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((c) => Math.min(c + 1, results.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const pick = results[cursor];
        if (pick) {
          event.preventDefault();
          handleSelect(pick);
          return;
        }
      }
    }
    if (event.key === "Enter" && selected) {
      event.preventDefault();
      handleConfirm();
    }
    if (event.key === "Escape") {
      onCancel();
    }
  }

  const showDropdown = results.length > 0 && !selected;
  const canRun = Boolean(selected) || Boolean(results[0]);

  return (
    <div className="relative flex items-center gap-1.5">
      {/* Search input */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
          viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"
        >
          <circle cx="7" cy="7" r="4.5" />
          <path strokeLinecap="round" d="M10.5 10.5l3 3" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selected) setSelected(null); // clear selection if user edits
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search donor by name or email"
          autoComplete="off"
          className="w-52 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
        />
        {loading && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
          </span>
        )}

        {/* Dropdown */}
        {showDropdown && (
          <div
            ref={listRef}
            className="absolute left-0 top-full z-40 mt-1 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            {results.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(c); }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${
                  i === cursor ? "bg-green-50" : "hover:bg-slate-50"
                }`}
              >
                {/* Avatar initials */}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                  {(c.firstName?.[0] ?? c.email?.[0] ?? "?").toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-900">{fullName(c)}</p>
                  <p className="truncate text-[11px] text-slate-400">{c.email ?? c.id}</p>
                </div>
                {c.donorStatus && (
                  <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                    {c.donorStatus}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Run button */}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={!canRun || disabled}
        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Run
      </button>

      {/* Cancel */}
      <button
        type="button"
        onClick={onCancel}
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
        title="Cancel"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
}
