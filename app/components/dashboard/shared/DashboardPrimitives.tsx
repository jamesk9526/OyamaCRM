"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";

export type DashboardMetricTone = "indigo" | "blue" | "violet" | "amber" | "sky";

export const DASHBOARD_PANEL_CLASS = "min-w-0 overflow-hidden rounded-[2px] border border-[#d1d1d1] bg-white";
export const DASHBOARD_PANEL_HEADER_CLASS = "flex items-center justify-between gap-3 border-b border-[#d1d1d1] bg-[#f3f2f1] px-5 py-3";

const METRIC_TONES: Record<DashboardMetricTone, { chip: string; stroke: string; iconPath: string }> = {
  indigo: { chip: "bg-[#eff6fc] text-[#0f6cbd]", stroke: "#0f6cbd", iconPath: "M12 5v14M5 12h14" },
  blue: { chip: "bg-[#deecf9] text-[#115ea3]", stroke: "#115ea3", iconPath: "M5 12h14M12 5v14" },
  violet: { chip: "bg-[#f3f2f1] text-[#424242]", stroke: "#616161", iconPath: "M12 4a4 4 0 100 8 4 4 0 000-8zM5 20a7 7 0 0114 0" },
  amber: { chip: "bg-amber-100 text-amber-700", stroke: "#d97706", iconPath: "M8 3.5v4M16 3.5v4M4.5 9h15M5.5 6.5h13a1 1 0 011 1v11a2 2 0 01-2 2h-11a2 2 0 01-2-2v-11a1 1 0 011-1z" },
  sky: { chip: "bg-[#eff6fc] text-[#0f548c]", stroke: "#0f6cbd", iconPath: "M3.5 6.75h17a1.75 1.75 0 011.75 1.75v7a1.75 1.75 0 01-1.75 1.75h-17A1.75 1.75 0 011.75 15.5v-7A1.75 1.75 0 013.5 6.75zm.25 1.25 8.25 6 8.25-6" },
};

function sparklinePath(values: number[], width = 102, height = 28): string {
  if (values.length <= 1) return `M0 ${height - 3} L${width} ${height - 3}`;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);
  return values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / spread) * (height - 5) - 2;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

export function DashboardMetricCard({
  title,
  value,
  trendText,
  trendPositive,
  tone,
  sparkValues,
  href,
  compactValue = false,
}: {
  title: string;
  value: string;
  trendText: string;
  trendPositive: boolean;
  tone: DashboardMetricTone;
  sparkValues: number[];
  href: string;
  compactValue?: boolean;
}) {
  const gradientId = `dashboard-spark-${useId().replace(/:/g, "")}`;
  const style = METRIC_TONES[tone];
  const path = sparklinePath(sparkValues);
  return (
    <Link href={href} className="group block rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f6cbd] focus-visible:ring-offset-2">
      <article className="relative h-full overflow-hidden rounded-[2px] border border-[#d1d1d1] bg-white px-4 py-3.5 transition-colors group-hover:border-[#0f6cbd] group-hover:bg-[#fafafa]">
        <span className="absolute inset-x-0 top-0 h-[3px] bg-[#0f6cbd]" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium text-slate-600">{title}</p>
            <p className={`mt-1 font-bold leading-none tracking-tight text-slate-900 ${compactValue ? "text-[20px]" : "text-[28px]"}`}>{value}</p>
          </div>
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-[2px] ${style.chip}`}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d={style.iconPath} />
            </svg>
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className={`text-[11px] font-semibold ${trendPositive ? "text-[#0f6cbd]" : "text-slate-500"}`}>{trendText}</p>
          {sparkValues.length > 1 ? (
            <svg width="102" height="28" viewBox="0 0 102 28" aria-hidden="true" className="shrink-0">
              <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={style.stroke} stopOpacity="0.24" /><stop offset="100%" stopColor={style.stroke} stopOpacity="0" /></linearGradient></defs>
              <path d={`${path} L102 28 L0 28 Z`} fill={`url(#${gradientId})`} stroke="none" />
              <path d={path} fill="none" stroke={style.stroke} strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : <span className="text-[10px] font-medium text-slate-400">Open details</span>}
        </div>
      </article>
    </Link>
  );
}

export function DashboardMiniTile({ label, value, detail, highlighted = false, href }: {
  label: string;
  value: string;
  detail: string;
  highlighted?: boolean;
  href?: string;
}) {
  const content = (
    <div className={`relative h-full overflow-hidden rounded-[2px] border border-t-[3px] border-t-[#0f6cbd] px-4 py-3.5 ${highlighted ? "border-[#cfe4fa] bg-[#eff6fc]" : "border-[#d1d1d1] bg-white"} ${href ? "transition-colors hover:border-[#0f6cbd] hover:bg-[#fafafa]" : ""}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-xs text-slate-600">{detail}</p>
        {href ? <span className="shrink-0 text-[11px] font-semibold text-[#0f6cbd]">Open</span> : null}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f6cbd]">{content}</Link> : content;
}

export function DashboardStatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[2px] bg-[#f3f2f1] px-3 py-1.5 text-[11px] font-medium text-slate-600 ring-1 ring-[#d1d1d1]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#0f6cbd]" aria-hidden="true" />
      {children}
    </span>
  );
}

export function DashboardPanel({ title, meta, action, children, className = "" }: {
  title: string;
  meta?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={`${DASHBOARD_PANEL_CLASS} ${className}`}>
      <div className={DASHBOARD_PANEL_HEADER_CLASS}>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {action ?? (meta ? <span className="text-[11px] font-medium text-slate-500">{meta}</span> : null)}
      </div>
      {children}
    </article>
  );
}
