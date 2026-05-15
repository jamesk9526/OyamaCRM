/** Layout frame for ribbon-first workspaces with title row and center content area. */
import type { ReactNode } from "react";
import EnterprisePageShell from "@/app/components/layout/EnterprisePageShell";
import WorkspaceBreadcrumbBar, { type WorkspaceBreadcrumbItem } from "@/app/components/layout/WorkspaceBreadcrumbBar";

interface WorkspaceRibbonFrameProps {
  title: string;
  description: string;
  breadcrumbItems?: WorkspaceBreadcrumbItem[];
  statusLabel?: string;
  metadata?: string;
  primaryAction?: ReactNode;
  overflowActions?: ReactNode;
  ribbon: ReactNode;
  children: ReactNode;
}

/**
 * Standard frame: title row, ribbon row, then core workspace content.
 */
export default function WorkspaceRibbonFrame({
  title,
  description,
  breadcrumbItems,
  statusLabel,
  metadata,
  primaryAction,
  overflowActions,
  ribbon,
  children,
}: WorkspaceRibbonFrameProps) {
  const items = breadcrumbItems ?? [
    { label: "Donor CRM", href: "/" },
    { label: title },
  ];

  return (
    <EnterprisePageShell
      ribbon={(
        <div className="space-y-2">
          <WorkspaceBreadcrumbBar
            items={items}
            statusLabel={statusLabel}
            metadata={metadata}
            primaryAction={primaryAction}
            overflowActions={overflowActions}
          />
          {ribbon}
        </div>
      )}
    >
      {children}
    </EnterprisePageShell>
  );
}
