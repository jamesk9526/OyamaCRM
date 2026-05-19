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
    <div className="flex min-w-fit flex-col gap-0.5 rounded-lg border border-slate-100 bg-slate-50/70 px-1.5 pt-1 pb-0.5 min-[1360px]:gap-1 min-[1360px]:px-2 min-[1360px]:pt-1.5 min-[1360px]:pb-1">
      {/* Buttons row */}
      <div className="flex flex-wrap items-center gap-0.5 min-[1360px]:gap-1">{children}</div>
      {/* Group label — always visible so compact ribbons remain readable. */}
      <p className="block text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400/90 select-none">
        {label}
      </p>
    </div>
  );
}
