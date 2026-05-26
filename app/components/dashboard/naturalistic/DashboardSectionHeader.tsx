/**
 * DashboardSectionHeader provides consistent editorial section rhythm for the Donor Dashboard.
 */

import type { ReactNode } from "react";

interface DashboardSectionHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export default function DashboardSectionHeader({ eyebrow, title, description, action }: DashboardSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
