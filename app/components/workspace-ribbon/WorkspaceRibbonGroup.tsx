/** Group container used to organize related ribbon actions. */
import type { ReactNode } from "react";

interface WorkspaceRibbonGroupProps {
  label: string;
  children: ReactNode;
}

/**
 * Provides one labeled action group in the workspace ribbon row.
 */
export default function WorkspaceRibbonGroup({ label, children }: WorkspaceRibbonGroupProps) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-1 border-r border-gray-200 pr-2 last:border-r-0 last:pr-0">
      <div className="flex min-w-0 flex-wrap items-start gap-1">{children}</div>
      <p className="whitespace-nowrap text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}
