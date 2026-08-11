"use client";

import { useMemo, useState } from "react";
import { EVENT_PAGE_SECTION_DEFINITIONS, getSectionDefinition } from "@/app/components/events/page-builder/section-config";
import type { EventPageSectionId, EventPageSectionState } from "@/app/components/events/page-builder/types";

interface EventPageBuilderSectionRailProps {
  sections: EventPageSectionState[];
  selectedSectionId: EventPageSectionId;
  onSelectSection: (sectionId: EventPageSectionId) => void;
  onMoveSection: (sectionId: EventPageSectionId, direction: "up" | "down") => void;
  onReorderSections: (draggedSectionId: EventPageSectionId, targetSectionId: EventPageSectionId) => void;
  onToggleSection: (sectionId: EventPageSectionId) => void;
}

/** Left rail for section order and selection in the event page builder. */
export default function EventPageBuilderSectionRail({
  sections,
  selectedSectionId,
  onSelectSection,
  onMoveSection,
  onReorderSections,
  onToggleSection,
}: EventPageBuilderSectionRailProps) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const definitionMap = new Map(EVENT_PAGE_SECTION_DEFINITIONS.map((section) => [section.id, section]));
  const hiddenSections = useMemo(() => sections.filter((section) => !section.enabled), [sections]);
  const filteredHiddenSections = useMemo(() => {
    const normalized = libraryQuery.trim().toLowerCase();
    return hiddenSections.filter((section) => {
      const definition = getSectionDefinition(section.id);
      return !normalized || `${definition.label} ${definition.description}`.toLowerCase().includes(normalized);
    });
  }, [hiddenSections, libraryQuery]);
  const visibleSections = useMemo(() => sections.filter((section) => section.enabled), [sections]);
  const selectedIndex = sections.findIndex((section) => section.id === selectedSectionId);

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-[#d1d1d1] bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Page Sections</h2>
            <p className="mt-1 text-xs text-slate-500">Arrange the public event page flow.</p>
          </div>
          <span className="bg-[#eff6fc] px-2 py-0.5 text-xs font-semibold text-[#0f548c]">{visibleSections.length}/{sections.length}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-2">
            <p className="text-sm font-bold text-emerald-700">{visibleSections.length}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-700/80">Visible</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
            <p className="text-sm font-bold text-slate-700">{hiddenSections.length}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Hidden</p>
          </div>
          <div className="rounded-lg border border-violet-100 bg-violet-50 px-2 py-2">
            <p className="text-sm font-bold text-violet-700">{selectedIndex + 1 || 1}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-700/80">Active</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {sections.map((section, index) => {
          const definition = definitionMap.get(section.id) ?? getSectionDefinition(section.id);
          const selected = selectedSectionId === section.id;

          return (
            <div
              key={section.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", section.id);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                const draggedId = event.dataTransfer.getData("text/plain") as EventPageSectionId;
                if (draggedId && draggedId !== section.id) {
                  onReorderSections(draggedId, section.id);
                }
               }}
               className={[
                 "group rounded-xl border px-3 py-2.5 transition-colors",
                 selected ? "border-violet-400 bg-violet-50 shadow-[0_0_0_1px_rgba(139,92,246,0.16)]" : "border-slate-200 bg-white hover:border-violet-200 hover:bg-slate-50",
                 !section.enabled ? "opacity-60" : "",
               ].join(" ")}
             >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="grid h-7 w-7 cursor-grab place-items-center rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-500 active:cursor-grabbing"
                  aria-label={`Drag ${definition.label}`}
                >
                  ⋮⋮
                </button>
                 <button
                   type="button"
                   onClick={() => onSelectSection(section.id)}
                   className="min-w-0 flex-1 text-left"
                 >
                   <p className="truncate text-xs font-semibold text-slate-900">{definition.label.replace(" Section", "")}</p>
                   <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{definition.description}</p>
                 </button>
                 <button
                  type="button"
                  onClick={() => onToggleSection(section.id)}
                  className="grid h-7 w-7 place-items-center rounded-md text-xs text-slate-500 hover:bg-slate-100"
                  aria-label={section.enabled ? `Hide ${definition.label}` : `Show ${definition.label}`}
                >
                  {section.enabled ? "◉" : "○"}
                </button>
               </div>
               <div className="mt-2 flex items-center justify-between gap-2">
                 <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${section.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                   {section.enabled ? "Visible" : "Hidden"}
                 </span>
                 {selected ? <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">Editing</span> : null}
               </div>

               <div className="mt-2 hidden items-center gap-1 group-hover:flex">
                <button
                  type="button"
                  onClick={() => onMoveSection(section.id, "up")}
                  disabled={index === 0}
                  className="inline-flex h-6 items-center rounded border border-slate-300 px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                  Move Up
                </button>
                <button
                  type="button"
                  onClick={() => onMoveSection(section.id, "down")}
                  disabled={index === sections.length - 1}
                  className="inline-flex h-6 items-center rounded border border-slate-300 px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                  Move Down
                </button>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setLibraryOpen((open) => !open)}
          className="mt-3 flex h-10 w-full items-center justify-center rounded-lg border border-violet-300 bg-white text-xs font-semibold text-violet-700 hover:bg-violet-50"
        >
          + Add Section
        </button>
        {libraryOpen ? (
          <div className="border border-[#d1d1d1] bg-[#fafafa] p-2">
            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0f548c]">Available blocks</p>
            <input value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="Search blocks" aria-label="Search page blocks" className="my-2 h-9 w-full border border-[#8a8886] bg-white px-2 text-xs outline-none focus:border-[#0f6cbd]" />
            {hiddenSections.length === 0 ? (
              <p className="px-2 py-2 text-xs text-violet-700">All block types are already on this page.</p>
            ) : (
              <div className="space-y-1">
                {filteredHiddenSections.map((section) => {
                  const definition = definitionMap.get(section.id) ?? getSectionDefinition(section.id);
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => {
                        onToggleSection(section.id);
                        onSelectSection(section.id);
                        setLibraryOpen(false);
                      }}
                      className="w-full border border-transparent bg-white px-2 py-2 text-left text-xs font-semibold text-slate-800 hover:border-[#96c6eb] hover:bg-[#eff6fc]"
                    >
                      {definition.label}
                    </button>
                  );
                })}
                {filteredHiddenSections.length === 0 ? <p className="px-2 py-2 text-xs text-[#616161]">No blocks match that search.</p> : null}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
