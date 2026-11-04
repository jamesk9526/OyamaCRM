"use client";
import { useEffect } from "react";
export function useDraftGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const anchor = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.download || link.href === location.href || link.hash && new URL(link.href).pathname === location.pathname) return;
      if (!window.confirm("Leave this workspace with unsaved changes? Your last saved server draft is retained.")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", warn); document.addEventListener("click", anchor, true);
    const navigation = (window as unknown as { navigation?: EventTarget }).navigation;
    const traverse = (event: Event) => { const item = event as Event & { navigationType?: string }; if (item.navigationType === "traverse" && event.cancelable && !window.confirm("Leave with unsaved changes? Your last saved server draft is retained.")) event.preventDefault(); };
    navigation?.addEventListener("navigate", traverse);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", anchor, true); navigation?.removeEventListener("navigate", traverse); };
  }, [dirty]);
}
