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
    <Link href={href} className="group flex min-h-[76px] items-start gap-3 rounded-md border border-slate-300 bg-gradient-to-b from-white to-slate-50 px-3 py-2.5 transition hover:border-emerald-300 hover:bg-emerald-50/45 hover:shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
      {icon ? <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-white text-slate-600 ring-1 ring-slate-300 group-hover:bg-emerald-50 group-hover:text-emerald-700">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
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
