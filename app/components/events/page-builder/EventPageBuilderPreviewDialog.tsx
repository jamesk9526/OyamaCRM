"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Monitor, Smartphone, Tablet, X } from "lucide-react";
import PublicEventRegistrationForm from "@/app/components/events/public/PublicEventRegistrationForm";
import type { EventPageBuilderWorkspaceData, EventPageSectionState } from "@/app/components/events/page-builder/types";
import { EventPageDocument } from "@/app/components/events/page-builder/EventPageBuilderPreview";

type PreviewDevice = "desktop" | "tablet" | "mobile";

interface EventPageBuilderPreviewDialogProps {
  open: boolean;
  sections: EventPageSectionState[];
  data: EventPageBuilderWorkspaceData;
  mode: "event" | "registration";
  onClose: () => void;
}

const widths: Record<PreviewDevice, string> = { desktop: "max-w-6xl", tablet: "max-w-3xl", mobile: "max-w-[390px]" };

/** Exact public page or checkout preview with explicit responsive viewports. */
export default function EventPageBuilderPreviewDialog({ open, sections, data, mode, onClose }: EventPageBuilderPreviewDialogProps) {
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);
  if (!open) return null;
  const eventImageUrl = sections.find((section) => section.id === "hero")?.design?.backgroundImageUrl;

  return <div className="fixed inset-0 z-50 flex flex-col bg-slate-900" role="dialog" aria-modal="true" aria-label={`${mode === "event" ? "Event page" : "Registration"} preview`}>
    <header className="flex min-h-[64px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-950 px-3 py-2 text-white sm:px-4">
      <div className="min-w-0"><p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-sky-300">{mode === "event" ? "Full site preview" : "Registration test"}</p><h2 className="truncate text-sm font-semibold">{data.event.name}</h2></div>
      <div className="flex items-center gap-1 border border-slate-700 bg-slate-900 p-1" aria-label="Preview viewport">{(["desktop", "tablet", "mobile"] as const).map((item) => { const Icon = item === "desktop" ? Monitor : item === "tablet" ? Tablet : Smartphone; return <button key={item} type="button" onClick={() => setDevice(item)} title={`${item} preview`} aria-label={`${item} preview`} aria-pressed={device === item} className={`grid h-8 w-9 place-items-center border ${device === item ? "border-sky-400 bg-sky-400 text-slate-950" : "border-transparent text-slate-400 hover:bg-slate-800 hover:text-white"}`}><Icon className="h-4 w-4" /></button>; })}</div>
      <div className="flex min-w-0 items-center gap-2"><span className="hidden max-w-[28rem] truncate border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-[10px] text-slate-400 lg:block">{data.publicUrl}</span><button type="button" onClick={onClose} autoFocus className="grid h-9 w-9 place-items-center bg-white text-slate-950 hover:bg-sky-100" aria-label="Close preview" title="Close preview"><X className="h-4 w-4" /></button></div>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto bg-slate-800 px-3 py-5 sm:px-5"><div className={`mx-auto border border-slate-600 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.32)] transition-[max-width] duration-200 ${widths[device]}`}><div className="flex h-7 items-center justify-between bg-slate-950 px-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-slate-300"><span>{device} viewport</span><span className="text-emerald-300">Preview only</span></div>{mode === "event" ? <EventPageDocument sections={sections} data={data} /> : <div className="event-public-document bg-slate-50 p-3 sm:p-6" style={{ "--event-brand-primary": data.branding?.primaryColor || "#0f6cbd", "--event-brand-accent": data.branding?.accentColor || "#5c2d91" } as CSSProperties}><PublicEventRegistrationForm pageSlug={data.pageSlug} ticketTypes={data.ticketTypes} paymentPolicy={data.paymentPolicy} currency={data.currency} event={data.event} branding={data.branding} eventImageUrl={eventImageUrl} previewOnly /></div>}</div></div>
  </div>;
}
