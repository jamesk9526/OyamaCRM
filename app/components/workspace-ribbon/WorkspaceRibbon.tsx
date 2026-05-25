/** Wrapping grouped ribbon toolbar for project-library-first workspaces. */
import type { ReactNode } from "react";

interface WorkspaceRibbonProps {
  children: ReactNode;
}

/**
 * Wraps grouped actions in a ribbon command surface.
 * Groups always wrap to additional rows on narrow widths.
 */
export default function WorkspaceRibbon({ children }: WorkspaceRibbonProps) {
  return (
    <div className="workspace-ribbon-surface overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
      <div className="workspace-ribbon-commands flex flex-wrap items-stretch gap-0 px-1 py-1 min-[1360px]:px-1.5 min-[1360px]:py-1.5">
        {children}
      </div>
    </div>
  );
}
