/** Shared clean action strip for refreshed Donor CRM pages. */
"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import ContextualRibbon from "@/app/components/ui/crm/ribbon/ContextualRibbon";
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

/** CRMActionBar renders the new shared Microsoft-style contextual ribbon surface. */
export default function CRMActionBar({ className = "", context, commandHandlers, children }: CRMActionBarProps) {
  const pathname = usePathname();
  const hasLegacyChildren = Boolean(children);

  return (
    <div className="space-y-2">
      <ContextualRibbon
        pathname={pathname}
        context={context}
        handlers={commandHandlers}
        className={className}
      />
      {hasLegacyChildren ? (
        <div className="hidden" aria-hidden="true">
          {children as ReactNode}
        </div>
      ) : null}
    </div>
  );
}
