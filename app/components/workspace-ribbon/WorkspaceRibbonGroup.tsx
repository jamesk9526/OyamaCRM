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
    <div className="workspace-ribbon-group flex min-w-fit flex-col gap-0.5 border-r border-slate-300 px-1.5 pt-1 pb-0.5 min-[1360px]:gap-1 min-[1360px]:px-2 min-[1360px]:pt-1.5 min-[1360px]:pb-1">
      <div className="workspace-ribbon-group-actions flex flex-wrap items-center gap-0.5 min-[1360px]:gap-1">{children}</div>
      <p className="workspace-ribbon-group-label block text-center text-[9px] font-medium text-slate-500 select-none">
        {label}
      </p>
    </div>
  );
}
