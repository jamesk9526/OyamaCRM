"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, Layers3, Plus, Search, X } from "lucide-react";
import { getSectionDefinition } from "@/app/components/events/page-builder/section-config";
import type { EventPageSectionId, EventPageSectionState } from "@/app/components/events/page-builder/types";

interface EventPageBuilderSectionRailProps {
  sections: EventPageSectionState[];
  selectedSectionId: EventPageSectionId;
  onSelectSection: (sectionId: EventPageSectionId) => void;
  onMoveSection: (sectionId: EventPageSectionId, direction: "up" | "down") => void;
  onReorderSections: (draggedSectionId: EventPageSectionId, targetSectionId: EventPageSectionId) => void;
  onToggleSection: (sectionId: EventPageSectionId) => void;
}

/** Canonical page structure panel. Visibility and ordering live only here. */
export default function EventPageBuilderSectionRail({ sections, selectedSectionId, onSelectSection, onMoveSection, onReorderSections, onToggleSection }: EventPageBuilderSectionRailProps) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const visibleSections = useMemo(() => sections.filter((section) => section.enabled), [sections]);
  const hiddenSections = useMemo(() => sections.filter((section) => !section.enabled), [sections]);
  const filteredHiddenSections = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    return hiddenSections.filter((section) => {
      const definition = getSectionDefinition(section.id);
      return !query || `${definition.label} ${definition.description}`.toLowerCase().includes(query);
    });
  }, [hiddenSections, libraryQuery]);

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-300 bg-slate-100" aria-label="Page structure">
      <div className="flex min-h-[58px] items-center justify-between border-b border-slate-300 bg-slate-200/70 px-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Structure</p>
          <h2 className="truncate text-sm font-semibold text-slate-950">Page sections</h2>
        </div>
        <span className="border border-slate-300 bg-white px-2 py-1 font-mono text-[10px] font-bold text-slate-600">{visibleSections.length} LIVE</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="space-y-1" role="list" aria-label="Visible page sections">
          {visibleSections.map((section, visibleIndex) => {
            const definition = getSectionDefinition(section.id);
            const selected = selectedSectionId === section.id;
            return (
              <div
                key={section.id}
                draggable
                onDragStart={(event) => { event.dataTransfer.setData("text/plain", section.id); event.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                onDrop={(event) => { event.preventDefault(); const draggedId = event.dataTransfer.getData("text/plain") as EventPageSectionId; if (draggedId && draggedId !== section.id) onReorderSections(draggedId, section.id); }}
                className={`group border transition ${selected ? "border-sky-500 bg-white shadow-[inset_3px_0_0_#0ea5e9]" : "border-transparent bg-slate-50 hover:border-slate-300 hover:bg-white"}`}
                role="listitem"
              >
                <div className="flex min-h-[54px] items-center gap-1.5 px-1.5">
                  <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-400" aria-hidden />
                  <button type="button" onClick={() => onSelectSection(section.id)} className="min-w-0 flex-1 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-500">
                    <span className="flex items-center gap-2">
                      <span className={`font-mono text-[9px] font-bold ${selected ? "text-sky-600" : "text-slate-400"}`}>{String(visibleIndex + 1).padStart(2, "0")}</span>
                      <span className="truncate text-xs font-semibold text-slate-900">{definition.label.replace(" Section", "")}</span>
                    </span>
                    <span className="mt-0.5 block truncate pl-6 text-[10px] text-slate-500">{definition.description}</span>
                  </button>
                  <div className="flex shrink-0 items-center">
                    <button type="button" onClick={() => onMoveSection(section.id, "up")} disabled={visibleIndex === 0} className="grid h-7 w-6 place-items-center text-slate-500 hover:bg-slate-100 hover:text-slate-950 disabled:invisible" aria-label={`Move ${definition.label} up`}><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => onMoveSection(section.id, "down")} disabled={visibleIndex === visibleSections.length - 1} className="grid h-7 w-6 place-items-center text-slate-500 hover:bg-slate-100 hover:text-slate-950 disabled:invisible" aria-label={`Move ${definition.label} down`}><ChevronDown className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => onToggleSection(section.id)} className="grid h-7 w-7 place-items-center text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label={`Hide ${definition.label}`} title="Hide section"><Eye className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {visibleSections.length === 0 ? <div className="border border-dashed border-slate-400 bg-white p-5 text-center"><Layers3 className="mx-auto h-5 w-5 text-slate-400" /><p className="mt-2 text-xs font-semibold text-slate-700">Your page has no visible sections</p><p className="mt-1 text-[11px] text-slate-500">Add a section to continue.</p></div> : null}

        <button type="button" onClick={() => setLibraryOpen(true)} className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 border border-dashed border-slate-400 bg-slate-50 text-xs font-semibold text-slate-700 hover:border-sky-500 hover:bg-sky-50 hover:text-sky-800">
          <Plus className="h-3.5 w-3.5" />Add section
        </button>

        {libraryOpen ? (
          <div className="mt-2 border border-slate-400 bg-white shadow-sm">
            <div className="flex h-10 items-center justify-between border-b border-slate-200 px-3"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Section library</p><button type="button" onClick={() => setLibraryOpen(false)} className="grid h-7 w-7 place-items-center text-slate-500 hover:bg-slate-100 hover:text-slate-950" aria-label="Close section library"><X className="h-3.5 w-3.5" /></button></div>
            <label className="m-2 flex h-9 items-center gap-2 border border-slate-300 bg-slate-50 px-2 focus-within:border-sky-500"><Search className="h-3.5 w-3.5 text-slate-400" /><span className="sr-only">Search sections</span><input value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="Find a section" className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400" /></label>
            <div className="max-h-64 overflow-y-auto border-t border-slate-200 p-1">
              {filteredHiddenSections.map((section) => { const definition = getSectionDefinition(section.id); return <button key={section.id} type="button" onClick={() => { onToggleSection(section.id); onSelectSection(section.id); setLibraryOpen(false); setLibraryQuery(""); }} className="flex w-full items-center gap-2 border border-transparent px-2 py-2 text-left hover:border-sky-200 hover:bg-sky-50"><EyeOff className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-800">{definition.label.replace(" Section", "")}</span><span className="block truncate text-[10px] text-slate-500">{definition.description}</span></span></button>; })}
              {hiddenSections.length === 0 ? <p className="px-3 py-5 text-center text-xs text-slate-500">Every section type is already in use.</p> : null}
              {hiddenSections.length > 0 && filteredHiddenSections.length === 0 ? <p className="px-3 py-5 text-center text-xs text-slate-500">No sections match that search.</p> : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-300 bg-slate-200/60 px-3 py-2 text-[10px] leading-4 text-slate-500">Drag to reorder · Select a row to edit</div>
    </aside>
  );
}
