/** Shared metric card for refreshed Donor CRM dashboards and workspaces. */
import type { ReactNode } from "react";
import CRMCard from "@/app/components/ui/crm/CRMCard";

interface CRMMetricCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  helper?: ReactNode;
  tone?: "green" | "blue" | "purple" | "orange" | "slate";
  loading?: boolean;
  className?: string;
}

const toneClassName = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  blue: "bg-sky-50 text-sky-700 ring-sky-100",
  purple: "bg-violet-50 text-violet-700 ring-violet-100",
  orange: "bg-orange-50 text-orange-700 ring-orange-100",
  slate: "bg-slate-50 text-slate-600 ring-slate-100",
};

/** CRMMetricCard keeps KPI cards consistent without owning data fetching. */
export default function CRMMetricCard({ label, value, icon, helper, tone = "green", loading = false, className = "" }: CRMMetricCardProps) {
  return (
    <CRMCard className={`flex items-center gap-4 ${className}`} padding="lg">
      {icon ? (
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ring-1 ${toneClassName[tone]}`}>
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-600">{label}</p>
        {loading ? <div className="mt-2 h-7 w-24 animate-pulse rounded bg-slate-100" /> : <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>}
        {helper ? <div className="mt-2 text-xs font-medium text-slate-500">{helper}</div> : null}
      </div>
    </CRMCard>
  );
}
