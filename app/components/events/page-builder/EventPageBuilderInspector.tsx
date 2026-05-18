import { getSectionDefinition, getSectionSourceFields } from "@/app/components/events/page-builder/section-config";
import type { EventPageSectionId, EventPageSectionState } from "@/app/components/events/page-builder/types";

interface EventPageBuilderInspectorProps {
  section: EventPageSectionState;
  onUpdateSection: (sectionId: EventPageSectionId, updater: (current: EventPageSectionState) => EventPageSectionState) => void;
}

/** Right inspector for section-level settings and source-of-truth binding. */
export default function EventPageBuilderInspector({ section, onUpdateSection }: EventPageBuilderInspectorProps) {
  const definition = getSectionDefinition(section.id);
  const sourceFields = getSectionSourceFields(section.id);

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Section Settings</h2>
      <p className="mt-1 text-xs text-slate-500">{definition.label}</p>

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-xs font-semibold text-slate-700">Content</p>
        <p className="mt-1 text-xs text-slate-600">{definition.description}</p>
      </div>

      <div className="mt-3 space-y-3">
        <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <span>
            <p className="text-xs font-semibold text-slate-800">Show Section</p>
            <p className="text-[11px] text-slate-500">Hide without deleting section configuration.</p>
          </span>
          <input
            type="checkbox"
            checked={section.enabled}
            onChange={(event) => {
              const nextChecked = event.target.checked;
              onUpdateSection(section.id, (current) => ({
                ...current,
                enabled: nextChecked,
              }));
            }}
            className="h-4 w-4 rounded border-slate-300 text-violet-600"
          />
        </label>

        <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <span>
            <p className="text-xs font-semibold text-slate-800">Lock To Event Data</p>
            <p className="text-[11px] text-slate-500">Keep this section synced to Events CRM source-of-truth fields.</p>
          </span>
          <input
            type="checkbox"
            checked={section.lockToEventData}
            onChange={(event) => {
              const nextChecked = event.target.checked;
              onUpdateSection(section.id, (current) => ({
                ...current,
                lockToEventData: nextChecked,
              }));
            }}
            className="h-4 w-4 rounded border-slate-300 text-violet-600"
          />
        </label>
      </div>

      <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
        <p className="text-xs font-semibold text-violet-800">Connected Fields</p>
        <ul className="mt-2 space-y-1 text-[11px] text-violet-900">
          {sourceFields.map((field) => (
            <li key={field}>• {field}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
