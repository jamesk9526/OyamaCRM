/** Group container used to organize related ribbon actions. */
import type { ReactNode } from "react";

interface WorkspaceRibbonGroupProps {
  label: string;
  children: ReactNode;
}

/**
 * Provides one labeled action group inside a WorkspaceRibbon.
 * The group label sits below the buttons (Office-ribbon style),
 * keeping each action cluster visually distinct.
 */
export default function WorkspaceRibbonGroup({ label, children }: WorkspaceRibbonGroupProps) {
  return (
    <div className="workspace-ribbon-group flex min-w-fit flex-col justify-between gap-2 border-r border-slate-200 px-3 pb-1 last:border-r-0 min-[1360px]:px-4">
      <div className="workspace-ribbon-group-actions flex flex-wrap items-start justify-center gap-1.5">{children}</div>
      <p className="workspace-ribbon-group-label block text-center text-xs font-medium text-slate-600 select-none">
        {label}
      </p>
    </div>
  );
}
