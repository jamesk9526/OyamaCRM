/** Shared soft status badge for Donor CRM visual refresh. */
import type { ReactNode } from "react";

interface CRMStatusBadgeProps {
  children: ReactNode;
  tone?: "green" | "yellow" | "orange" | "red" | "purple" | "gray" | "blue";
  className?: string;
}

const toneClassName = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  yellow: "border-yellow-200 bg-yellow-50 text-yellow-700",
  orange: "border-orange-200 bg-orange-50 text-orange-700",
  red: "border-red-200 bg-red-50 text-red-700",
  purple: "border-violet-200 bg-violet-50 text-violet-700",
  gray: "border-slate-200 bg-slate-50 text-slate-600",
  blue: "border-sky-200 bg-sky-50 text-sky-700",
};

/** CRMStatusBadge uses calm color treatment for statuses, tags, and readiness labels. */
export default function CRMStatusBadge({ children, tone = "gray", className = "" }: CRMStatusBadgeProps) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneClassName[tone]} ${className}`}>{children}</span>;
}
