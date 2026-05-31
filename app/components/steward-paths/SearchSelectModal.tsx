/**
 * SearchSelectModal renders a reusable searchable picker modal.
 */
"use client";

import { useEffect } from "react";

export interface SearchSelectOption {
  id: string;
  name: string;
  status?: string;
  subtitle?: string;
}

interface SearchSelectModalProps {
  open: boolean;
  title: string;
  searchValue: string;
  searchPlaceholder: string;
  options: SearchSelectOption[];
  selectedId?: string;
  loading?: boolean;
  error?: string | null;
  emptyLabel?: string;
  onSearchChange: (value: string) => void;
  onSelect: (optionId: string) => void;
  onClose: () => void;
}

/** Modal list picker used by inspector fields that link email/letter entities. */
export default function SearchSelectModal({
  open,
  title,
  searchValue,
  searchPlaceholder,
  options,
  selectedId,
  loading = false,
  error,
  emptyLabel = "No results match your search.",
  onSearchChange,
  onSelect,
  onClose,
}: SearchSelectModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[78vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            aria-label="Close search modal"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4 12 12M12 4 4 12" />
            </svg>
          </button>
        </div>

        <div className="border-b border-slate-200 px-4 py-3">
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            autoFocus
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">Loading options...</p>
          ) : error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : options.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">{emptyLabel}</p>
          ) : (
            <div className="space-y-1.5">
              {options.map((option) => {
                const isSelected = option.id === selectedId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onSelect(option.id);
                      onClose();
                    }}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${isSelected ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{option.name}</p>
                      {option.subtitle ? <p className="truncate text-xs text-slate-500">{option.subtitle}</p> : null}
                    </div>
                    <div className="ml-2 flex items-center gap-1.5">
                      {option.status ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                          {option.status}
                        </span>
                      ) : null}
                      {isSelected ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Selected
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
