/** Shared table shell for refreshed Donor CRM list pages. */
import type { ReactNode } from "react";
import CRMCard from "@/app/components/ui/crm/CRMCard";

interface CRMDataTableProps {
  children: ReactNode;
  className?: string;
}

/** CRMDataTable provides a softer scroll container while preserving native table markup inside. */
export default function CRMDataTable({ children, className = "" }: CRMDataTableProps) {
  return (
    <CRMCard padding="none" className={`overflow-hidden ${className}`}>
      <div className="max-w-full overflow-x-auto border-t border-slate-100">
        {children}
      </div>
    </CRMCard>
  );
}
