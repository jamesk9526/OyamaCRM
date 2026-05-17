// Shared mobile navigation drawer for CRM module shells.
"use client";

import { useEffect } from "react";

interface MobileSidebarDrawerProps {
  /** Whether the drawer is visible. */
  open: boolean;
  /** Accessible title shown in the drawer header. */
  title: string;
  /** Closes the drawer from overlay, close button, or Escape. */
  onClose: () => void;
  /** Expanded sidebar instance for the active module. */
  children: React.ReactNode;
  /** Optional width class for module-specific sidebar widths. */
  widthClassName?: string;
}

/** Provides consistent touch-friendly mobile nav behavior across all CRM shells. */
export default function MobileSidebarDrawer({
  open,
  title,
  onClose,
  children,
  widthClassName = "w-[min(20rem,92vw)]",
}: MobileSidebarDrawerProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label={`Close ${title}`}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
      />
      <div className={`absolute inset-y-0 left-0 flex max-w-[92vw] flex-col overflow-hidden bg-white shadow-2xl ${widthClassName}`}>
        <div className="flex min-h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-3" style={{ paddingTop: "max(0rem, env(safe-area-inset-top))" }}>
          <p className="truncate text-sm font-semibold text-slate-800">{title}</p>
          <button
            type="button"
            aria-label={`Close ${title}`}
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
