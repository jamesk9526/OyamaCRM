/** Shared filter strip for refreshed Donor CRM list pages. */
import type { ReactNode } from "react";
import CRMCard from "@/app/components/ui/crm/CRMCard";

interface CRMFilterBarProps {
  children: ReactNode;
  className?: string;
}

/** CRMFilterBar standardizes spacing and surface treatment for search/filter controls. */
export default function CRMFilterBar({ children, className = "" }: CRMFilterBarProps) {
  return (
    <CRMCard padding="sm" className={`crm-filter-surface ${className}`}>
      <div className="grid gap-2 md:grid-cols-[minmax(240px,1fr)_auto] lg:flex lg:items-center lg:gap-3">{children}</div>
    </CRMCard>
  );
}
