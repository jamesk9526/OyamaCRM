/** Group container used to organize related ribbon actions. */
import type { ReactNode } from "react";

interface WorkspaceRibbonGroupProps {
  label: string;
  children: ReactNode;
}

/**
 * Provides one labeled action group inside a WorkspaceRibbon.
 * The group label sits above the buttons (Office-ribbon style),
 * keeping each action cluster visually distinct.
 */
export default function WorkspaceRibbonGroup({ label, children }: WorkspaceRibbonGroupProps) {
  return (
    <div className="flex min-w-fit flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 px-2 pt-1.5 pb-1">
      {/* Buttons row */}
      <div className="flex flex-wrap items-center gap-1">{children}</div>
      {/* Group label — below buttons, Office-style */}
      <p className="text-center text-[9px] font-semibold uppercase tracking-widest text-slate-400 select-none">
        {label}
      </p>
    </div>
  );
}
