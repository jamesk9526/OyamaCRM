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
    <CRMCard className={`group flex min-h-[5.6rem] items-start gap-2.5 transition duration-150 hover:border-slate-300 hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)] ${className}`} padding="sm">
      {icon ? (
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ${toneClassName[tone]}`}>
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
        {loading ? <div className="mt-1.5 h-6 w-24 animate-pulse rounded bg-slate-100" /> : <p className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-900">{value}</p>}
        {helper ? <div className="mt-1 text-[11px] font-medium leading-4 text-slate-500">{helper}</div> : null}
      </div>
    </CRMCard>
  );
}
