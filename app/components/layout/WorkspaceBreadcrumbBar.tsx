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
  accentTone?: "green" | "blue" | "purple" | "amber";
}

/** Returns the badge tone for a given status label string. */
function statusBadgeTone(statusLabel: string, accentTone: "green" | "blue" | "purple" | "amber"): string {
  const lc = statusLabel.toLowerCase();
  if (lc === "working") return "border-green-200 bg-green-50 text-green-700";
  if (lc === "partially working") return "border-amber-200 bg-amber-50 text-amber-700";
  if (lc === "demo only") return "border-amber-200 bg-amber-50 text-amber-700";
  if (lc === "broken") return "border-red-200 bg-red-50 text-red-700";
  if (lc === "not implemented") return "border-slate-200 bg-slate-50 text-slate-600";
  // fall back to accent tone
  if (accentTone === "blue") return "border-blue-200 bg-blue-50 text-blue-700";
  if (accentTone === "purple") return "border-violet-200 bg-violet-50 text-violet-700";
  if (accentTone === "amber") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-green-200 bg-green-50 text-green-700";
}

/**
 * Renders a single-line breadcrumb with compact metadata and right-side actions.
 * Status labels (Working, Partially Working, Demo Only, Broken, Not Implemented)
 * render with semantic colours regardless of module accent tone.
 */
export default function WorkspaceBreadcrumbBar({
  items,
  statusLabel,
  metadata,
  primaryAction,
  overflowActions,
  accentTone = "green",
}: WorkspaceBreadcrumbBarProps) {
  const breadcrumbLinkTone = accentTone === "blue"
    ? "hover:text-blue-700"
    : accentTone === "purple"
      ? "hover:text-violet-700"
      : accentTone === "amber"
        ? "hover:text-amber-700"
        : "hover:text-green-700";

  return (
    <section className="rounded-md border border-slate-300 bg-gradient-to-b from-white to-slate-50 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] min-[1360px]:px-3 min-[1360px]:py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-slate-600">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <div key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
                {item.href && !isLast ? (
                  <Link href={item.href} className={`truncate hover:underline ${breadcrumbLinkTone}`}>
                    {item.label}
                  </Link>
                ) : (
                  <span className={`truncate ${isLast ? "font-semibold text-slate-900" : ""}`}>{item.label}</span>
                )}
                {!isLast ? (
                  <span className="text-slate-300" aria-hidden="true">/</span>
                ) : null}
              </div>
            );
          })}

          {statusLabel ? (
            <span className={`ml-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeTone(statusLabel, accentTone)}`}>
              {statusLabel}
            </span>
          ) : null}

          {metadata ? (
            <>
              <span className="mx-1 hidden sm:inline text-slate-300" aria-hidden="true">|</span>
              <span className="hidden sm:inline text-xs text-slate-500 truncate max-w-[240px]">{metadata}</span>
            </>
          ) : null}
        </div>

        {(primaryAction || overflowActions) ? (
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
            {primaryAction}
            {overflowActions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
