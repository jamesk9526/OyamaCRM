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
    <Link href={href} className="group flex min-h-[64px] items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/55 px-3 py-2.5 transition-colors hover:border-emerald-200 hover:bg-emerald-50/45">
      {icon ? <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-slate-200/80 group-hover:text-emerald-800">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-slate-900">{title}</span>
        {description ? <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{description}</span> : null}
        {actionLabel ? <span className="mt-1 block text-[11px] font-semibold text-emerald-700">{actionLabel}</span> : null}
      </span>
      <span className="text-slate-300 transition-colors group-hover:text-emerald-600" aria-hidden="true">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}
