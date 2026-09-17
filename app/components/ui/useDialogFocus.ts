"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Keep dialog focus stable while form values and close callbacks change. */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    const candidates = () => Array.from(ref.current?.querySelectorAll<HTMLElement>(
      "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])",
    ) ?? []).filter((element) => element.getClientRects().length > 0 && !element.closest('[inert], [aria-hidden="true"]'));
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const items = candidates();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) { event.preventDefault(); ref.current?.focus(); return; }
      const outside = !ref.current?.contains(document.activeElement);
      if (event.shiftKey && (outside || document.activeElement === first || document.activeElement === ref.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (outside || document.activeElement === last || document.activeElement === ref.current)) {
        event.preventDefault(); first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", keydown);
    const frame = window.requestAnimationFrame(() => {
      const preferred = ref.current?.querySelector<HTMLElement>("[data-modal-autofocus]");
      (preferred ?? candidates()[0] ?? ref.current)?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", keydown);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [open, ref]);
}
