"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useDialogFocus } from "@/app/components/ui/useDialogFocus";

/** Quick Add dropdown for Donor CRM mode — links to the most common creation flows. */
export default function DonorQuickAddButton() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, open, () => setOpen(false));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const items = [
    { label: "New Gift", href: "/donations/new", icon: "M12 2v20m7-15H9a3 3 0 100 6h6a3 3 0 110 6H5" },
    { label: "New Constituent", href: "/constituents/new", icon: "M12 4a4 4 0 100 8 4 4 0 000-8zM6 20v-1a6 6 0 0112 0v1" },
    { label: "New Campaign", href: "/campaigns", icon: "M12 3l2.8 5.7L21 9.6l-4.5 4.4 1 6.2L12 17l-5.5 3.2 1-6.2L3 9.6l6.2-.9L12 3z" },
    { label: "New Task", href: "/tasks", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" },
  ];

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Quick Add"
        className="oyama-reference-quick-add inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#0f6cbd] bg-[#0f6cbd] px-2.5 text-[13px] font-semibold text-white transition-colors hover:border-[#115ea3] hover:bg-[#115ea3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60cdff]"
      >
        <svg className="h-4 w-4 shrink-0 text-white/95" fill="none" stroke="currentColor" strokeWidth={2.25} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
        </svg>
        <span>Quick Add</span>
        <svg className={`h-3.5 w-3.5 shrink-0 text-white/85 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.25} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Quick Add" className="absolute left-0 top-full z-50 mt-1.5 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-slate-700 transition-colors hover:bg-[#eff6fc] hover:text-[#0f548c]"
            >
              <svg className="h-4 w-4 shrink-0 text-[#0f6cbd]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

