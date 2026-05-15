/** Layout frame for ribbon-first workspaces with title row and center content area. */
import type { ReactNode } from "react";
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
    <div className="space-y-3">
      <div title={description}>
        <WorkspaceBreadcrumbBar
          items={items}
          statusLabel={statusLabel}
          metadata={metadata}
          primaryAction={primaryAction}
          overflowActions={overflowActions}
        />
      </div>

      {ribbon}

      <div className="min-w-0">{children}</div>
    </div>
  );
}
