/** Center live visual canvas for the webmaster full-page editor. */
"use client";

import WebmasterPageRenderer from "@/app/components/webmaster/rendering/WebmasterPageRenderer";
import { getDeviceCanvasClass } from "./editor-utils";
import type { DeviceMode, WebmasterDocument } from "./types";

interface WebmasterEditorCanvasProps {
  siteName: string;
  pageTitle: string;
  document: WebmasterDocument;
  device: DeviceMode;
  previewInEditor: boolean;
  selectedSectionId: string | null;
  selectedBlockId: string | null;
  onSelectSection: (sectionId: string) => void;
  onSelectBlock: (sectionId: string, blockId: string) => void;
  onUpdateBlockContent: (sectionId: string, blockId: string, patch: Record<string, unknown>) => void;
  onInsertSectionAt: (index: number) => void;
  onMoveSection: (sectionId: string, direction: "up" | "down") => void;
  onDuplicateSection: (sectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
}

/** Canvas renders visitor-like page output with minimal edit overlays. */
export default function WebmasterEditorCanvas(props: WebmasterEditorCanvasProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-100 p-4">
      {!props.previewInEditor ? (
        <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
          <span>{props.siteName}</span>
          <span>{props.device} canvas</span>
        </div>
      ) : null}

      <div className={`mx-auto transition-all ${getDeviceCanvasClass(props.device)}`}>
        <WebmasterPageRenderer
          siteName={props.siteName}
          pageTitle={props.pageTitle}
          document={props.document}
          mode={props.previewInEditor ? "preview" : "edit"}
          selectedSectionId={props.selectedSectionId}
          selectedBlockId={props.selectedBlockId}
          onSelectSection={props.onSelectSection}
          onSelectBlock={props.onSelectBlock}
          onUpdateBlockContent={props.onUpdateBlockContent}
          onInsertSectionAt={props.previewInEditor ? undefined : props.onInsertSectionAt}
          onMoveSection={props.previewInEditor ? undefined : props.onMoveSection}
          onDuplicateSection={props.previewInEditor ? undefined : props.onDuplicateSection}
          onDeleteSection={props.previewInEditor ? undefined : props.onDeleteSection}
        />
      </div>
    </section>
  );
}
