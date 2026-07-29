import type { CrmRibbonCommandHandlers, CrmRibbonContext } from "@/app/components/ui/crm/ribbon/types";

export const WORKSPACE_COMMAND_CONTEXT_EVENT = "oyama:workspace-command-context";

export interface WorkspaceCommandContextDetail {
  pathname: string;
  context: CrmRibbonContext;
  handlers: CrmRibbonCommandHandlers;
}

/** Publishes page actions to the compact top-bar workspace control. */
export function publishWorkspaceCommandContext(detail: WorkspaceCommandContextDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<WorkspaceCommandContextDetail>(WORKSPACE_COMMAND_CONTEXT_EVENT, { detail }));
}
