import { EVENT_PAGE_SECTION_DEFINITIONS, getSectionDefinition } from "@/app/components/events/page-builder/section-config";
import type { EventPageSectionId, EventPageSectionState } from "@/app/components/events/page-builder/types";

interface EventPageBuilderSectionRailProps {
  sections: EventPageSectionState[];
  selectedSectionId: EventPageSectionId;
  onSelectSection: (sectionId: EventPageSectionId) => void;
  onMoveSection: (sectionId: EventPageSectionId, direction: "up" | "down") => void;
}

/** Left rail for section order and selection in the event page builder. */
export default function EventPageBuilderSectionRail({
  sections,
  selectedSectionId,
  onSelectSection,
  onMoveSection,
}: EventPageBuilderSectionRailProps) {
  const definitionMap = new Map(EVENT_PAGE_SECTION_DEFINITIONS.map((section) => [section.id, section]));

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Page Sections</h2>
        <span className="text-xs text-slate-500">{sections.length}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">Drag-free ordering for now. Move sections with arrows.</p>

      <div className="mt-3 space-y-2">
        {sections.map((section, index) => {
          const definition = definitionMap.get(section.id) ?? getSectionDefinition(section.id);
          const selected = selectedSectionId === section.id;

          return (
            <div
              key={section.id}
              className={[
                "rounded-lg border px-2 py-2 transition-colors",
                selected ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-slate-50",
                !section.enabled ? "opacity-60" : "",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => onSelectSection(section.id)}
                className="w-full text-left"
              >
                <p className="text-xs font-semibold text-slate-900">{definition.label}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{section.enabled ? "Visible" : "Hidden"}</p>
              </button>

              <div className="mt-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onMoveSection(section.id, "up")}
                  disabled={index === 0}
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  aria-label={`Move ${definition.label} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMoveSection(section.id, "down")}
                  disabled={index === sections.length - 1}
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  aria-label={`Move ${definition.label} down`}
                >
                  ↓
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
