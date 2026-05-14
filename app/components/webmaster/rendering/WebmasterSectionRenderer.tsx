/** Renders one visual section with lightweight edit overlays. */
"use client";

import type { SectionInstance } from "@/app/modules/webmaster/schema";
import WebmasterBlockRenderer from "./WebmasterBlockRenderer";

interface WebmasterSectionRendererProps {
  section: SectionInstance;
  mode: "edit" | "preview" | "published";
  selectedSection: boolean;
  selectedBlockId: string | null;
  onSelectSection?: () => void;
  onSelectBlock?: (blockId: string) => void;
  onUpdateBlockContent?: (blockId: string, patch: Record<string, unknown>) => void;
  onMoveSection?: (direction: "up" | "down") => void;
  onDuplicateSection?: () => void;
  onDeleteSection?: () => void;
}

function sectionSpacing(value: unknown): string {
  const spacing = String(value ?? "comfortable");
  if (spacing === "compact") return "py-8";
  if (spacing === "loose") return "py-20";
  return "py-14";
}

/** Section renderer keeps canvas visitor-like while showing controls only during editing. */
export default function WebmasterSectionRenderer({
  section,
  mode,
  selectedSection,
  selectedBlockId,
  onSelectSection,
  onSelectBlock,
  onUpdateBlockContent,
  onMoveSection,
  onDuplicateSection,
  onDeleteSection,
}: WebmasterSectionRendererProps) {
  const background = String(section.settings.background ?? "#ffffff");
  const isEdit = mode === "edit";

  return (
    <section
      onClick={() => onSelectSection?.()}
      className={`relative border transition ${isEdit ? "cursor-pointer" : "cursor-default"} ${selectedSection && isEdit ? "border-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" : "border-transparent"}`}
      style={{ backgroundColor: background }}
      data-section-id={section.id}
    >
      {isEdit && selectedSection ? (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-md border border-slate-200 bg-white/95 p-1 shadow-sm">
          <button type="button" onClick={(event) => { event.stopPropagation(); onMoveSection?.("up"); }} className="rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">Up</button>
          <button type="button" onClick={(event) => { event.stopPropagation(); onMoveSection?.("down"); }} className="rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">Down</button>
          <button type="button" onClick={(event) => { event.stopPropagation(); onDuplicateSection?.(); }} className="rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">Duplicate</button>
          <button type="button" onClick={(event) => { event.stopPropagation(); onDeleteSection?.(); }} className="rounded px-2 py-1 text-xs text-rose-700 hover:bg-rose-50">Delete</button>
        </div>
      ) : null}

      <div className={`mx-auto w-full max-w-6xl px-6 ${sectionSpacing(section.settings.spacing)}`}>
        <div className="space-y-5">
          {section.blocks.map((block) => (
            <WebmasterBlockRenderer
              key={block.id}
              block={block}
              mode={mode}
              selected={selectedBlockId === block.id}
              onSelect={() => {
                onSelectSection?.();
                onSelectBlock?.(block.id);
              }}
              onUpdateContent={(patch) => onUpdateBlockContent?.(block.id, patch)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
