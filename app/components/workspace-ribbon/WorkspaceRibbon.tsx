/** Wrapping grouped ribbon toolbar for project-library-first workspaces. */
import type { ReactNode } from "react";

interface WorkspaceRibbonProps {
  children: ReactNode;
  /** Override: scroll horizontally rather than wrapping to a second row. Default: wrap. */
  scrollable?: boolean;
}

/**
 * Wraps grouped actions in a horizontal command surface.
 * Groups wrap to the next row by default; pass scrollable for single-row ribbon.
 */
export default function WorkspaceRibbon({ children, scrollable = false }: WorkspaceRibbonProps) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm${scrollable ? " overflow-x-auto scrollbar-none" : ""}`}>
      <div className={`flex items-stretch gap-1.5 px-1.5 py-1.5${scrollable ? " min-w-max" : " flex-wrap"}`}>
        {children}
      </div>
    </div>
  );
}
