"use client";

import { useState, type CSSProperties } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
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
  if (!open) return null;
  const eventImageUrl = sections.find((section) => section.id === "hero")?.design?.backgroundImageUrl;

  return <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/82 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${mode === "event" ? "Event page" : "Registration"} preview`}>
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-950 px-4 py-3 text-white">
      <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">{mode === "event" ? "Event page preview" : "Registration preview"}</p><h2 className="truncate text-sm font-semibold">{data.event.name}</h2></div>
      <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 p-1" aria-label="Preview viewport">{(["desktop", "tablet", "mobile"] as const).map((item) => { const Icon = item === "desktop" ? Monitor : item === "tablet" ? Tablet : Smartphone; return <button key={item} type="button" onClick={() => setDevice(item)} title={`${item} preview`} aria-pressed={device === item} className={`grid h-8 w-9 place-items-center rounded ${device === item ? "bg-white text-slate-950" : "text-white/70 hover:bg-white/10"}`}><Icon className="h-4 w-4" /></button>; })}</div>
      <div className="flex min-w-0 items-center gap-2"><span className="hidden max-w-[28rem] truncate rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 lg:block">{data.publicUrl}</span><button type="button" onClick={onClose} className="inline-flex h-9 items-center justify-center rounded-md bg-white px-4 text-xs font-semibold text-slate-950 hover:bg-violet-50">Close preview</button></div>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-5"><div className={`mx-auto transition-[max-width] duration-200 ${widths[device]}`}><div className="overflow-hidden rounded-lg bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">{mode === "event" ? <EventPageDocument sections={sections} data={data} /> : <div className="event-public-document bg-slate-50 p-3 sm:p-6" style={{ "--event-brand-primary": data.branding?.primaryColor || "#0f6cbd", "--event-brand-accent": data.branding?.accentColor || "#5c2d91" } as CSSProperties}><PublicEventRegistrationForm pageSlug={data.pageSlug} ticketTypes={data.ticketTypes} paymentPolicy={data.paymentPolicy} currency={data.currency} event={data.event} branding={data.branding} eventImageUrl={eventImageUrl} previewOnly /></div>}</div></div></div>
  </div>;
}
