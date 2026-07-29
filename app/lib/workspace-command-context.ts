import type { CrmRibbonCommandHandlers, CrmRibbonContext } from "@/app/components/ui/crm/ribbon/types";

export const WORKSPACE_COMMAND_CONTEXT_EVENT = "oyama:workspace-command-context";

export interface WorkspaceCommandEntry {
  id: string;
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export interface WorkspaceCommandContextDetail {
  pathname: string;
  context: CrmRibbonContext;
  handlers: CrmRibbonCommandHandlers;
  commands?: WorkspaceCommandEntry[];
}

let latestWorkspaceCommandContext: WorkspaceCommandContextDetail | null = null;

export function getWorkspaceCommandContext(pathname: string): WorkspaceCommandContextDetail | null {
  return latestWorkspaceCommandContext?.pathname === pathname ? latestWorkspaceCommandContext : null;
}

/** Publishes page actions to the compact top-bar workspace control. */
export function publishWorkspaceCommandContext(detail: WorkspaceCommandContextDetail): void {
  if (typeof window === "undefined") return;
  latestWorkspaceCommandContext = detail;
  window.dispatchEvent(new CustomEvent<WorkspaceCommandContextDetail>(WORKSPACE_COMMAND_CONTEXT_EVENT, { detail }));
}
