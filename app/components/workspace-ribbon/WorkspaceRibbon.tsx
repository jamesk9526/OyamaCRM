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
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* 2px green accent bar — signals DonorCRM brand identity */}
      <div className="h-0.5 w-full bg-gradient-to-r from-green-500 via-green-400 to-green-300" />
      <div className="flex flex-wrap items-stretch gap-1 px-1 py-1 min-[1360px]:gap-1.5 min-[1360px]:px-1.5 min-[1360px]:py-1.5">
        {children}
      </div>
    </div>
  );
}
