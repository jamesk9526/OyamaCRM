"use client";

// Fullscreen in-app public preview for the event page builder.
import type { EventPageBuilderWorkspaceData, EventPageSectionState } from "@/app/components/events/page-builder/types";
import { EventPageDocument } from "@/app/components/events/page-builder/EventPageBuilderPreview";

interface EventPageBuilderPreviewDialogProps {
  open: boolean;
  sections: EventPageSectionState[];
  data: EventPageBuilderWorkspaceData;
  onClose: () => void;
}

/** Renders the public page preview without opening a separate browser tab. */
export default function EventPageBuilderPreviewDialog({ open, sections, data, onClose }: EventPageBuilderPreviewDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/82 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Event page preview">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-950 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">Public Preview</p>
          <h2 className="truncate text-sm font-semibold">{data.event.name}</h2>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden max-w-[34rem] truncate rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 md:block">
            {data.publicUrl}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center justify-center rounded-md bg-white px-3 text-xs font-semibold text-slate-950 hover:bg-violet-50"
          >
            Close Preview
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <EventPageDocument sections={sections} data={data} />
      </div>
    </div>
  );
}
