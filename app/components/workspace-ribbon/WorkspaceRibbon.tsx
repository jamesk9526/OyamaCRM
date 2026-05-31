/** Wrapping grouped ribbon toolbar for project-library-first workspaces. */
import Link from "next/link";
import type { ReactNode } from "react";

export interface WorkspaceRibbonTab {
  label: string;
  href?: string;
  active?: boolean;
}

interface WorkspaceRibbonProps {
  children: ReactNode;
  tabs?: WorkspaceRibbonTab[];
  accentTone?: "green" | "blue" | "purple" | "amber";
  className?: string;
  sticky?: boolean;
}

function tabAccentClass(accentTone: WorkspaceRibbonProps["accentTone"]): string {
  if (accentTone === "blue") return "border-blue-600 text-blue-800";
  if (accentTone === "purple") return "border-violet-600 text-violet-800";
  if (accentTone === "amber") return "border-amber-500 text-amber-800";
  return "border-emerald-600 text-emerald-800";
}

/**
 * Wraps grouped actions in a ribbon command surface.
 * Groups always wrap to additional rows on narrow widths.
 */
export default function WorkspaceRibbon({ children, tabs, accentTone = "green", className = "", sticky = true }: WorkspaceRibbonProps) {
  const hasTabs = Boolean(tabs?.length);
  const stickyClass = sticky ? "sticky top-0 z-30" : "";

  return (
    <div className={`workspace-ribbon-surface ${stickyClass} overflow-hidden rounded-md border border-slate-300 bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfd_100%)] shadow-[0_4px_14px_rgba(15,23,42,0.05)] ${className}`}>
      {hasTabs ? (
        <div className="workspace-ribbon-tabs flex min-w-0 items-end gap-5 overflow-x-auto border-b border-slate-200/90 px-3 text-[12px] font-semibold text-slate-700 min-[1360px]:px-4">
          {tabs?.map((tab, index) => {
            const active = tab.active ?? index === 0;
            const className = [
              "relative -mb-px inline-flex h-9 shrink-0 items-end border-b-2 px-0.5",
              active ? tabAccentClass(accentTone) : "border-transparent text-slate-700 hover:text-slate-950",
            ].join(" ");

            if (tab.href) {
              return (
                <Link key={`${tab.label}-${tab.href}`} href={tab.href} className={className}>
                  {tab.label}
                </Link>
              );
            }

            return (
              <span key={tab.label} className={className}>
                {tab.label}
              </span>
            );
          })}
        </div>
      ) : null}
      <div className="workspace-ribbon-commands overflow-x-auto px-2 py-1.5 min-[1360px]:px-2.5">
        <div className="flex min-w-fit flex-wrap items-stretch gap-0.5">
        {children}
        </div>
      </div>
    </div>
  );
}
