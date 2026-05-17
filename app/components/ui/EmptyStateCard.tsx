/** Reusable empty-state card with guided next steps and action hierarchy. */
import type { ReactNode } from "react";

interface EmptyStateCardProps {
  title: string;
  description: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export default function EmptyStateCard({
  title,
  description,
  icon,
  actions,
  className = "",
}: EmptyStateCardProps) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm ${className}`.trim()}>
      <div className="mx-auto flex w-full max-w-lg flex-col items-center">
        {icon ? (
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-700">
            {icon}
          </div>
        ) : null}
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 max-w-xl text-sm text-gray-600">{description}</p>
        {actions ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
