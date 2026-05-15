/** Compact breadcrumb/action row used as the canonical workspace header. */
import Link from "next/link";
import type { ReactNode } from "react";

export interface WorkspaceBreadcrumbItem {
  label: string;
  href?: string;
}

interface WorkspaceBreadcrumbBarProps {
  items: WorkspaceBreadcrumbItem[];
  statusLabel?: string;
  metadata?: string;
  primaryAction?: ReactNode;
  overflowActions?: ReactNode;
  accentTone?: "green" | "blue" | "amber";
}

/**
 * Renders a single-line breadcrumb with compact metadata and right-side actions.
 * This replaces bulky page title cards for tool-heavy CRM workspaces.
 */
export default function WorkspaceBreadcrumbBar({
  items,
  statusLabel,
  metadata,
  primaryAction,
  overflowActions,
  accentTone = "green",
}: WorkspaceBreadcrumbBarProps) {
  const statusToneClass = accentTone === "blue"
    ? "border-blue-200 bg-blue-50 text-blue-700"
    : accentTone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-green-200 bg-green-50 text-green-700";

  return (
    <section className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-gray-600">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <div key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
                {item.href && !isLast ? (
                  <Link href={item.href} className="truncate hover:text-green-700 hover:underline">
                    {item.label}
                  </Link>
                ) : (
                  <span className={`truncate ${isLast ? "font-semibold text-gray-900" : ""}`}>{item.label}</span>
                )}
                {!isLast ? (
                  <span className="text-gray-400" aria-hidden="true">/</span>
                ) : null}
              </div>
            );
          })}

          {statusLabel ? (
            <span className={`ml-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusToneClass}`}>
              {statusLabel}
            </span>
          ) : null}

          {metadata ? (
            <>
              <span className="mx-1 text-gray-300" aria-hidden="true">|</span>
              <span className="text-xs text-gray-500">{metadata}</span>
            </>
          ) : null}
        </div>

        {(primaryAction || overflowActions) ? (
          <div className="flex shrink-0 items-center gap-2">
            {primaryAction}
            {overflowActions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
