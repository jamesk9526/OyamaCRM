/** Shared clean action strip for refreshed Donor CRM pages. */
"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { publishWorkspaceCommandContext } from "@/app/lib/workspace-command-context";
import type {
  CrmRibbonCommandHandlers,
  CrmRibbonContext,
} from "@/app/components/ui/crm/ribbon/types";

interface CRMActionBarProps {
  children?: ReactNode;
  className?: string;
  context?: CrmRibbonContext;
  commandHandlers?: CrmRibbonCommandHandlers;
}

/** Registers page actions for the compact top-bar workspace status control. */
export default function CRMActionBar({ className = "", context, commandHandlers, children }: CRMActionBarProps) {
  const pathname = usePathname();
  const hasLegacyChildren = Boolean(children);

  useEffect(() => {
    publishWorkspaceCommandContext({
      pathname,
      context: context ?? {},
      handlers: commandHandlers ?? {},
    });
  }, [pathname, context, commandHandlers]);

  return (
    <div className={`hidden ${className}`} aria-hidden="true">
      {hasLegacyChildren ? (
        <div>{children as ReactNode}</div>
      ) : null}
    </div>
  );
}
