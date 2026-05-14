/** Shared full-page renderer for webmaster edit and preview surfaces. */
"use client";

import type { SectionInstance } from "@/app/modules/webmaster/schema";
import type { WebmasterDocument } from "@/app/components/webmaster/editor/types";
import WebmasterSectionRenderer from "./WebmasterSectionRenderer";

interface WebmasterPageRendererProps {
  siteName: string;
  pageTitle: string;
  document: WebmasterDocument;
  mode: "edit" | "preview" | "published";
  selectedSectionId?: string | null;
  selectedBlockId?: string | null;
  onSelectSection?: (sectionId: string) => void;
  onSelectBlock?: (sectionId: string, blockId: string) => void;
  onUpdateBlockContent?: (sectionId: string, blockId: string, patch: Record<string, unknown>) => void;
  onInsertSectionAt?: (index: number) => void;
  onMoveSection?: (sectionId: string, direction: "up" | "down") => void;
  onDuplicateSection?: (sectionId: string) => void;
  onDeleteSection?: (sectionId: string) => void;
}

function renderSection(
  section: SectionInstance,
  index: number,
  props: WebmasterPageRendererProps,
): React.ReactNode {
  const isEdit = props.mode === "edit";

  return (
    <div key={section.id} className="relative">
      {isEdit && props.onInsertSectionAt ? (
        <div className="absolute -top-3 left-1/2 z-20 -translate-x-1/2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              props.onInsertSectionAt?.(index);
            }}
            className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50"
          >
            + Add Section
          </button>
        </div>
      ) : null}

      <WebmasterSectionRenderer
        section={section}
        mode={props.mode}
        selectedSection={props.selectedSectionId === section.id}
        selectedBlockId={props.selectedBlockId ?? null}
        onSelectSection={() => props.onSelectSection?.(section.id)}
        onSelectBlock={(blockId) => props.onSelectBlock?.(section.id, blockId)}
        onUpdateBlockContent={(blockId, patch) => props.onUpdateBlockContent?.(section.id, blockId, patch)}
        onMoveSection={(direction) => props.onMoveSection?.(section.id, direction)}
        onDuplicateSection={() => props.onDuplicateSection?.(section.id)}
        onDeleteSection={() => props.onDeleteSection?.(section.id)}
      />
    </div>
  );
}

/** Renders the full page so edit and preview share one visual output pipeline. */
export default function WebmasterPageRenderer(props: WebmasterPageRendererProps) {
  const isEdit = props.mode === "edit";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {!isEdit ? (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
          {props.siteName} • {props.pageTitle}
        </div>
      ) : null}

      <div className="space-y-0">
        {props.document.sections.map((section, index) => renderSection(section, index, props))}
        {isEdit && props.onInsertSectionAt ? (
          <div className="border-t border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center">
            <button
              type="button"
              onClick={() => props.onInsertSectionAt?.(props.document.sections.length)}
              className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              + Add Section To End
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
