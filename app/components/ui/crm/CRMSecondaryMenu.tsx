"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Native disclosure for secondary actions; preserves normal link/button keyboard behavior. */
export default function CRMSecondaryMenu({ label = "More actions", children }: { label?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <details ref={ref} className="relative">
      <summary className="donor-button cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {label}<ChevronDown className="h-4 w-4" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 grid w-60 max-w-[calc(100vw-2rem)] gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg [&>a]:w-full [&>a]:justify-start [&>button]:w-full [&>button]:justify-start"
        onClick={(event) => {
          const action = (event.target as HTMLElement).closest("a,button");
          if (action && !action.hasAttribute("disabled") && ref.current) {
            ref.current.open = false;
            ref.current.querySelector("summary")?.focus();
          }
        }}>
        {children}
      </div>
    </details>
  );
}
