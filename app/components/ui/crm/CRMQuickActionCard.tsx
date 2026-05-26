/** Shared quick action card for refreshed Donor CRM dashboards. */
import Link from "next/link";
import type { ReactNode } from "react";

interface CRMQuickActionCardProps {
  href: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
}

/** CRMQuickActionCard gives dashboard and workspace launchers one consistent shape. */
export default function CRMQuickActionCard({ href, title, description, icon, actionLabel }: CRMQuickActionCardProps) {
  return (
    <Link href={href} className="group flex min-h-[82px] items-start gap-3 rounded-2xl border border-slate-100 bg-gradient-to-br from-white via-white to-slate-50 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.045)] transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/45 hover:shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
      {icon ? <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 group-hover:bg-white">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-950">{title}</span>
        {description ? <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span> : null}
        {actionLabel ? <span className="mt-2 block text-xs font-semibold text-emerald-700">{actionLabel}</span> : null}
      </span>
      <span className="mt-1 text-slate-400 transition-colors group-hover:text-emerald-600" aria-hidden="true">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}
