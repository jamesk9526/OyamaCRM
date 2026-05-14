/** Top command bar for the Webmaster visual editor workspace. */
"use client";

import type { DeviceMode, PublishReadinessData, SaveState, WebmasterPage, WebmasterSite } from "./types";
import { getReadinessBadgeClass } from "./editor-utils";

interface WebmasterEditorTopBarProps {
  sites: WebmasterSite[];
  pages: WebmasterPage[];
  selectedSiteId: string;
  selectedPageId: string;
  saveState: SaveState;
  device: DeviceMode;
  previewInEditor: boolean;
  healthScore: number;
  canUndo: boolean;
  canRedo: boolean;
  readiness: PublishReadinessData | null;
  onSiteChange: (siteId: string) => void;
  onPageChange: (pageId: string) => void;
  onSave: () => void;
  onPreviewDraft: () => void;
  onOpenPublishSetup: () => void;
  onDeviceChange: (device: DeviceMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleInEditorPreview: () => void;
}

/** Editor command bar with page/site selectors and preview/publish controls. */
export default function WebmasterEditorTopBar(props: WebmasterEditorTopBarProps) {
  return (
    <div className="sticky top-0 z-30 rounded-xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={props.selectedSiteId}
          onChange={(event) => props.onSiteChange(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
        >
          {props.sites.map((site) => (
            <option key={site.id} value={site.id}>{site.name}</option>
          ))}
        </select>

        <select
          value={props.selectedPageId}
          onChange={(event) => props.onPageChange(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
        >
          {props.pages.map((page) => (
            <option key={page.id} value={page.id}>{page.title}</option>
          ))}
        </select>

        <button type="button" onClick={props.onSave} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
          Save Draft
        </button>

        <button type="button" onClick={props.onPreviewDraft} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
          Preview Page
        </button>

        <button type="button" onClick={props.onOpenPublishSetup} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
          Open Publish Setup
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
            {(["desktop", "tablet", "mobile"] as const).map((device) => (
              <button
                key={device}
                type="button"
                onClick={() => props.onDeviceChange(device)}
                className={`px-2.5 py-1.5 text-xs font-medium ${props.device === device ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
              >
                {device}
              </button>
            ))}
          </div>

          <button type="button" onClick={props.onUndo} disabled={!props.canUndo} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40">
            Undo
          </button>
          <button type="button" onClick={props.onRedo} disabled={!props.canRedo} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40">
            Redo
          </button>
          <button type="button" onClick={props.onToggleInEditorPreview} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
            {props.previewInEditor ? "Edit Site" : "In-editor Preview"}
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span>Draft Status: {props.saveState.detail ?? props.saveState.status}</span>
        <span>Health Score: {props.healthScore}</span>
        {props.readiness ? (
          <span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold ${getReadinessBadgeClass(props.readiness.status)}`}>
            Publish Readiness: {props.readiness.status}
          </span>
        ) : null}
      </div>
    </div>
  );
}
