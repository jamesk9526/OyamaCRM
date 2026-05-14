/**
 * WorkspaceMain wraps the primary content region in the workspace frame.
 */
import type { ReactNode } from "react";

interface WorkspaceMainProps {
  children: ReactNode;
}

/** Main center work area where tables, editors, builders, and reports live. */
export default function WorkspaceMain({ children }: WorkspaceMainProps) {
  return <main className="min-w-0 flex-1">{children}</main>;
}
