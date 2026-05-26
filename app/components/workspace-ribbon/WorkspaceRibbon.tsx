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
}

function tabAccentClass(accentTone: WorkspaceRibbonProps["accentTone"]): string {
  if (accentTone === "blue") return "text-blue-700 after:bg-blue-600";
  if (accentTone === "purple") return "text-violet-700 after:bg-violet-600";
  if (accentTone === "amber") return "text-amber-700 after:bg-amber-500";
  return "text-emerald-700 after:bg-emerald-600";
}

/**
 * Wraps grouped actions in a ribbon command surface.
 * Groups always wrap to additional rows on narrow widths.
 */
export default function WorkspaceRibbon({ children, tabs, accentTone = "green", className = "" }: WorkspaceRibbonProps) {
  const hasTabs = Boolean(tabs?.length);

  return (
    <div className={`workspace-ribbon-surface overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.07)] ${className}`}>
      {hasTabs ? (
        <div className="workspace-ribbon-tabs flex min-w-0 items-center gap-8 overflow-x-auto border-b border-slate-200 px-5 pt-3 text-sm font-semibold text-slate-700">
          {tabs?.map((tab, index) => {
            const active = tab.active ?? index === 0;
            const className = [
              "relative -mb-px inline-flex h-8 shrink-0 items-start after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-full",
              active ? tabAccentClass(accentTone) : "text-slate-700 after:bg-transparent hover:text-slate-950",
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
      <div className="workspace-ribbon-commands flex min-w-0 flex-wrap items-stretch gap-0 px-3 py-3 min-[1360px]:px-4">
        {children}
      </div>
    </div>
  );
}
