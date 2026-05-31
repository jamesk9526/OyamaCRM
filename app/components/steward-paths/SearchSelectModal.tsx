/**
 * SearchSelectModal renders a reusable searchable picker modal.
 */
"use client";

import { useEffect } from "react";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";

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
    <WorkspaceSetupModal
      title={title}
      subtitle="Search and select one linked record."
      checklist={["Search", "Review options", "Select record"]}
      onClose={onClose}
      maxWidthClassName="max-w-4xl"
      closeOnBackdropClick
    >
      <div className="space-y-4 px-4 py-4">
        <input
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          autoFocus
          placeholder={searchPlaceholder}
          className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
        />

        <div className="min-h-0 max-h-[52vh] overflow-y-auto">
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
    </WorkspaceSetupModal>
  );
}
