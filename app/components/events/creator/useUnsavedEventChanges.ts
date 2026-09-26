"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Warn on links, browser history traversal, and closing/reloading the page. */
export function useUnsavedEventChanges(dirty: boolean, message: string) {
  const pathname = usePathname();
  const query = useSearchParams();
  useEffect(() => {
    if (!dirty) return;
    const currentUrl = window.location.href;
    const currentState = window.history.state;
    const navigation = (window as unknown as { navigation?: EventTarget }).navigation;
    function navigate(event: Event) {
      const traversal = event as Event & { navigationType?: string };
      if (traversal.navigationType === "traverse" && event.cancelable && !window.confirm(message)) event.preventDefault();
    }
    function unload(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ""; }
    function leave(event: MouseEvent) {
      const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (link && link.target !== "_blank" && !link.getAttribute("href")?.startsWith("#") && !window.confirm(message)) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }
    function traverse(event: PopStateEvent) {
      if (!window.confirm(message)) {
        event.stopImmediatePropagation();
        // Keep Next's history tree together with the URL when a traversal is cancelled.
        window.history.pushState(currentState, "", currentUrl);
      }
    }
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    // Modern browsers can cancel traversal before Next or the URL changes.
    // Older browsers need the popstate restoration fallback.
    if (navigation) navigation.addEventListener("navigate", navigate);
    else window.addEventListener("popstate", traverse, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", leave, true);
      if (navigation) navigation.removeEventListener("navigate", navigate);
      else window.removeEventListener("popstate", traverse, true);
    };
  }, [dirty, message, pathname, query]);
}
