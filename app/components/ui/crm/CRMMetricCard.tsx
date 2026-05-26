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
    <CRMCard className={`group flex min-h-[7.25rem] items-start gap-3 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_16px_34px_rgba(15,23,42,0.08)] ${className}`} padding="md">
      {icon ? (
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ${toneClassName[tone]}`}>
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold uppercase tracking-[0.11em] text-slate-400">{label}</p>
        {loading ? <div className="mt-2 h-7 w-24 animate-pulse rounded bg-slate-100" /> : <p className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-950">{value}</p>}
        {helper ? <div className="mt-2 text-xs font-medium leading-5 text-slate-500">{helper}</div> : null}
      </div>
    </CRMCard>
  );
}
