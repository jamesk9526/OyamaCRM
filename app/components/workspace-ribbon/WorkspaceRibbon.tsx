/** Horizontal grouped ribbon toolbar for project-library-first workspaces. */
import type { ReactNode } from "react";

interface WorkspaceRibbonProps {
  children: ReactNode;
}

/**
 * Wraps grouped actions in a single horizontal ribbon row.
 */
export default function WorkspaceRibbon({ children }: WorkspaceRibbonProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-2">
      <div className="flex min-w-max items-stretch gap-2">{children}</div>
    </div>
  );
}
