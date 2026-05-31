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
    <div className="workspace-ribbon-group flex min-w-fit flex-col justify-between border-r border-slate-200 px-2 pb-0.5 last:border-r-0 min-[1360px]:px-2.5">
      <div className="workspace-ribbon-group-actions flex flex-wrap items-start justify-center gap-0.5">{children}</div>
      <p className="workspace-ribbon-group-label block pt-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 select-none">
        {label}
      </p>
    </div>
  );
}
