/**
 * FirstRunCard — first-visit walkthrough modal overlay shown once per tool.
 * Persists dismissal in localStorage under the provided storageKey.
 * "Maybe later" closes for the session. "Got it" closes and never shows again.
 * Use storageKey like "howto:constituents", "howto:donations", etc.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface FirstRunCardProps {
  /** Unique localStorage key, e.g. "howto:constituents" */
  storageKey: string;
  /** Modal headline, e.g. "Getting started with Constituents" */
  title: string;
  /** Short numbered steps */
  steps: string[];
  className?: string;
}

export default function FirstRunCard({ storageKey, title, steps }: FirstRunCardProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Only reveal after hydration — avoids SSR mismatch
  useEffect(() => {
    setMounted(true);
    try {
      if (!localStorage.getItem(storageKey)) {
        // Small delay so the page settles before the modal appears
        const t = setTimeout(() => setOpen(true), 420);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage unavailable — stay hidden
    }
  }, [storageKey]);

  // Keyboard: Escape = maybe-later close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLater();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function closeLater() {
    setOpen(false);
  }

  function closePermanent() {
    try { localStorage.setItem(storageKey, "1"); } catch { /* ignore */ }
    setOpen(false);
  }

  if (!mounted || !open) return null;

  return createPortal(
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) closeLater(); }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="frm-title"
    >
      {/* Card */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden"
      >
        {/* Green accent top bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-green-500 to-emerald-400" />

        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-5 pb-4">
          <span className="mt-0.5 shrink-0 rounded-xl bg-green-100 p-2 text-green-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-green-600">Quick Start</p>
            <h2 id="frm-title" className="mt-0.5 text-base font-bold text-gray-900 leading-snug">{title}</h2>
          </div>
          <button
            type="button"
            onClick={closeLater}
            title="Close"
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close walkthrough"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Steps */}
        <ol className="flex flex-col gap-2.5 px-6 pb-5">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-[11px] font-bold text-green-700 mt-0.5">
                {i + 1}
              </span>
              <span className="text-[13.5px] leading-relaxed text-gray-700">{step}</span>
            </li>
          ))}
        </ol>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={closeLater}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
          >
            Maybe later
          </button>
          <button
            type="button"
            onClick={closePermanent}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            Got it, don&apos;t show again
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
