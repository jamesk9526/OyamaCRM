/** Shared page header for refreshed Donor CRM pages. */
import type { ReactNode } from "react";

interface CRMPageHeaderProps {
  breadcrumb: ReactNode;
  title: string;
  description?: string;
  status?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  className?: string;
}

/** CRMPageHeader gives every Donor CRM page one consistent hierarchy and primary action area. */
export default function CRMPageHeader({ breadcrumb, title, description, status, primaryAction, secondaryActions, className = "" }: CRMPageHeaderProps) {
  return (
    <header className={`crm-page-header-surface flex flex-col gap-3 rounded-xl border px-4 py-3 lg:flex-row lg:items-start lg:justify-between ${className}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          {breadcrumb}
          {status ? <span className="min-w-0">{status}</span> : null}
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      {(primaryAction || secondaryActions) ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {secondaryActions}
          {primaryAction}
        </div>
      ) : null}
    </header>
  );
}
