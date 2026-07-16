// Shared mobile navigation drawer for CRM module shells.
"use client";

import { useEffect, useId, useRef } from "react";

const DESKTOP_NAVIGATION_MEDIA_QUERY = "(min-width: 1024px)";

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("hidden") && element.getClientRects().length > 0);
}

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
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;

    const mediaQuery = window.matchMedia(DESKTOP_NAVIGATION_MEDIA_QUERY);
    const closeAtDesktop = () => {
      if (mediaQuery.matches) onClose();
    };

    closeAtDesktop();
    mediaQuery.addEventListener("change", closeAtDesktop);
    return () => mediaQuery.removeEventListener("change", closeAtDesktop);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        aria-label={`Close ${title}`}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
      />
      <div className={`absolute inset-y-0 left-0 flex max-w-[92vw] flex-col overflow-hidden bg-white shadow-2xl ${widthClassName}`}>
        <div className="flex min-h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-3" style={{ paddingTop: "max(0rem, env(safe-area-inset-top))" }}>
          <h2 id={titleId} className="truncate text-sm font-semibold text-slate-800">{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label={`Close ${title}`}
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
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
