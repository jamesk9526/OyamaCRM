"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

/** One keyboard-accessible action disclosure that can escape scrolling record tables. */
export default function DonorRecordActions({ label, children }: { label: string; children: ReactNode }) {
  const id = useId(); const button = useRef<HTMLButtonElement>(null); const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const close = (restore = false) => { setPosition(null); if (restore) button.current?.focus(); };
  useEffect(() => {
    if (!position) return;
    panel.current?.querySelector<HTMLElement>("a,button:not(:disabled)")?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node)) setPosition(null); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setPosition(null); button.current?.focus(); } };
    const move = (event: Event) => { if (!panel.current?.contains(event.target as Node)) setPosition(null); };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", key); window.addEventListener("resize", move); document.addEventListener("scroll", move, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key); window.removeEventListener("resize", move); document.removeEventListener("scroll", move, true); };
  }, [position]);
  return <><button ref={button} className="donor-record-actions-button" type="button" aria-label={label} aria-expanded={Boolean(position)} aria-controls={position ? id : undefined} onClick={() => {
    if (position) { close(); return; }
    const bounds = button.current!.getBoundingClientRect(); const height = Math.min(420, window.innerHeight - 24);
    const top = bounds.bottom + height + 8 <= window.innerHeight ? bounds.bottom + 6 : Math.max(8, bounds.top - height - 6);
    setPosition({ top, left: Math.max(8, Math.min(bounds.right - 260, window.innerWidth - 268)), maxHeight: Math.min(height, window.innerHeight - top - 8) });
  }}><MoreHorizontal size={18} aria-hidden="true" /><span className="sr-only">Actions</span></button>{position && createPortal(<div ref={panel} id={id} role="group" aria-label={label} tabIndex={-1} className="donor-record-actions-panel" style={{ top: position.top, left: position.left, maxHeight: position.maxHeight }} onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== button.current) close(); }} onClick={(event) => { const action = (event.target as HTMLElement).closest("a,button"); if (action && !action.hasAttribute("disabled")) close(true); }}>{children}</div>, document.body)}</>;
}
