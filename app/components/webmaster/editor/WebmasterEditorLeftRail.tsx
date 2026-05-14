/** Left rail for pages, add-section, layers, and supporting Webmaster tools. */
"use client";

import { listSectionManifests } from "@/app/modules/webmaster/section-registry";
import type { LeftRailPanel, WebmasterDocument, WebmasterPage } from "./types";

interface WebmasterEditorLeftRailProps {
  activePanel: LeftRailPanel;
  pages: WebmasterPage[];
  selectedPageId: string;
  document: WebmasterDocument | null;
  selectedSectionId: string | null;
  selectedBlockId: string | null;
  onPanelChange: (panel: LeftRailPanel) => void;
  onPageSelect: (pageId: string) => void;
  onAddSection: (type: string) => void;
  onSelectLayer: (sectionId: string, blockId?: string) => void;
}

const PANELS: Array<{ key: LeftRailPanel; label: string }> = [
  { key: "pages", label: "Pages" },
  { key: "add-section", label: "Add Section" },
  { key: "layers", label: "Layers" },
  { key: "assets", label: "Assets" },
  { key: "theme", label: "Theme" },
  { key: "forms", label: "Forms" },
  { key: "seo", label: "SEO" },
  { key: "settings", label: "Settings" },
];

/** Contextual rail keeps structural tools available while canvas remains page-first. */
export default function WebmasterEditorLeftRail(props: WebmasterEditorLeftRailProps) {
  const manifests = listSectionManifests();

  return (
    <aside className="h-full rounded-xl border border-slate-200 bg-white p-3">
      <div className="grid grid-cols-2 gap-1">
        {PANELS.map((panel) => (
          <button
            key={panel.key}
            type="button"
            onClick={() => props.onPanelChange(panel.key)}
            className={`rounded-md px-2 py-1.5 text-left text-[11px] font-semibold ${props.activePanel === panel.key ? "bg-emerald-100 text-emerald-800" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
          >
            {panel.label}
          </button>
        ))}
      </div>

      <div className="mt-3 max-h-[calc(100vh-245px)] overflow-auto pr-1">
        {props.activePanel === "pages" ? (
          <div className="space-y-2">
            {props.pages.map((page) => (
              <button
                key={page.id}
                type="button"
                onClick={() => props.onPageSelect(page.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left ${props.selectedPageId === page.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <p className="text-xs font-semibold text-slate-800">{page.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{page.path}</p>
              </button>
            ))}
          </div>
        ) : null}

        {props.activePanel === "add-section" ? (
          <div className="space-y-2">
            {manifests.map((manifest) => (
              <button
                key={manifest.type}
                type="button"
                onClick={() => props.onAddSection(manifest.type)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
              >
                <p className="text-xs font-semibold text-slate-800">{manifest.name}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{manifest.category}</p>
              </button>
            ))}
          </div>
        ) : null}

        {props.activePanel === "layers" ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Page</p>
              <p className="text-xs font-semibold text-slate-800">Visual Layers</p>
            </div>
            {props.document?.sections.map((section) => (
              <div key={section.id} className="rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => props.onSelectLayer(section.id)}
                  className={`w-full rounded-t-lg px-3 py-2 text-left text-xs font-semibold ${props.selectedSectionId === section.id ? "bg-emerald-50 text-emerald-800" : "bg-white text-slate-800"}`}
                >
                  {section.label || section.type}
                </button>
                <div className="space-y-1 border-t border-slate-100 bg-white px-2 py-2">
                  {section.blocks.map((block) => (
                    <button
                      key={block.id}
                      type="button"
                      onClick={() => props.onSelectLayer(section.id, block.id)}
                      className={`w-full rounded-md px-2 py-1 text-left text-[11px] ${props.selectedBlockId === block.id ? "bg-emerald-100 text-emerald-800" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                      {String(block.content.text ?? block.content.question ?? block.type)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {props.activePanel === "assets" || props.activePanel === "theme" || props.activePanel === "forms" || props.activePanel === "seo" || props.activePanel === "settings" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
            This panel is visible in the editor workspace and will be expanded in the next pass. Continue using the right inspector and publishing workspace for active controls.
          </div>
        ) : null}
      </div>
    </aside>
  );
}
