/** Shared empty state for refreshed Donor CRM pages. */
import type { ReactNode } from "react";
import CRMCard from "@/app/components/ui/crm/CRMCard";

interface CRMEmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}

/** CRMEmptyState keeps no-data moments calm and actionable. */
export default function CRMEmptyState({ title, description, action, icon }: CRMEmptyStateProps) {
  return (
    <CRMCard className="border-dashed text-center" padding="lg">
      {icon ? <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">{icon}</div> : null}
      <h2 className="text-base font-bold text-slate-950">{title}</h2>
      <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-slate-600">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </CRMCard>
  );
}
