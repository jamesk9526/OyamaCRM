"use client";

import Link from "next/link";
import { CircleHelp, LifeBuoy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface HelpContent {
  title: string;
  steps: string[];
  helpHref: string;
}

function helpForPath(pathname: string): HelpContent {
  if (pathname.startsWith("/constituents")) return { title: "Working with constituents", steps: ["Search before creating a new record to avoid duplicates.", "Use the profile timeline to review gifts, tasks, and communications.", "Keep contact preferences current before outreach."], helpHref: "/help-content/constituents" };
  if (pathname.startsWith("/donations")) return { title: "Recording gifts", steps: ["Confirm the donor and designation before saving.", "Use the payment status to distinguish pending and completed gifts.", "Review the donor timeline after a correction or refund."], helpHref: "/help-content/donations" };
  if (pathname.startsWith("/campaigns") || pathname.startsWith("/communications") || pathname.startsWith("/oyama-email")) return { title: "Planning communications", steps: ["Start with an audience that respects preferences and suppressions.", "Review content and recipients before scheduling or sending.", "Use delivery history to follow up on results."], helpHref: "/help-content/communications" };
  if (pathname.startsWith("/steward-paths")) return { title: "Building a Steward Path", steps: ["Begin with the enrollment trigger that matches the donor journey.", "Use delays and approval steps for reviewable outreach.", "Test the path with a safe constituent before activation."], helpHref: "/help-content/steward-paths" };
  if (pathname.startsWith("/reports")) return { title: "Reading reports", steps: ["Confirm the date range and reporting window first.", "Use filters to narrow the records behind a total.", "Export only after reviewing the visible results."], helpHref: "/help-content/reports" };
  if (pathname.startsWith("/settings")) return { title: "Managing settings", steps: ["Changes here can affect the whole organization.", "Verify email delivery settings before enabling outreach.", "Set the support recipient so issue reports reach your team."], helpHref: "/help-content/settings" };
  return { title: "Getting around Donor CRM", steps: ["Use the left navigation to move between fundraising workspaces.", "Use search to open people, gifts, and tools quickly.", "Use this help button whenever a page needs a refresher."], helpHref: "/help" };
}

/** Small location-aware help control present on every standard Donor CRM workspace page. */
export default function CrmContextualHelp({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const content = helpForPath(pathname);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={ref} className="fixed bottom-5 right-5 z-70" data-html2canvas-ignore="true">
      {open ? (
        <section aria-label="Page help" className="absolute bottom-14 right-0 w-[min(22rem,calc(100vw-2.5rem))] rounded-lg border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.2)]">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0f6cbd]">Quick guide</p><h2 className="mt-1 text-sm font-semibold text-slate-950">{content.title}</h2></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close page help" className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X className="h-4 w-4" /></button>
          </div>
          <ol className="mt-3 space-y-2 text-sm leading-5 text-slate-600">{content.steps.map((step, index) => <li key={step} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-[#0f6cbd]">{index + 1}</span><span>{step}</span></li>)}</ol>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <Link href={content.helpHref} className="text-sm font-semibold text-[#0f6cbd] hover:text-[#115ea3]">More help</Link>
            <button type="button" onClick={() => { setOpen(false); window.dispatchEvent(new Event("oyamacrm:open-support-ticket")); }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-[#0f6cbd]"><LifeBuoy className="h-4 w-4" />Report a problem</button>
          </div>
        </section>
      ) : null}
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label="Open page help" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#0f6cbd] bg-white text-[#0f6cbd] shadow-lg transition hover:bg-[#0f6cbd] hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-300"><CircleHelp className="h-5 w-5" /></button>
    </div>
  );
}