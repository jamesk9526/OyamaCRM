/** Shared clean action strip for refreshed Donor CRM pages. */
import type { ReactNode } from "react";
import CRMCard from "@/app/components/ui/crm/CRMCard";

interface CRMActionBarProps {
  children: ReactNode;
  className?: string;
}

/** CRMActionBar replaces heavy segmented toolbar boxes with one calm control strip. */
export default function CRMActionBar({ children, className = "" }: CRMActionBarProps) {
  return (
    <CRMCard padding="sm" className={`bg-gradient-to-b from-white to-slate-50 ${className}`}>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </CRMCard>
  );
}
