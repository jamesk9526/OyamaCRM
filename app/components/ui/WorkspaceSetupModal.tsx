/** Shared setup-style modal shell with module-aware accent theming for CRM modals. */
"use client";

import { type ReactNode, useMemo } from "react";
import { usePathname } from "next/navigation";
import { resolveTopBarModuleKey, type TopBarModuleKey } from "@/app/lib/navigation-boundaries";

interface AccentTheme {
  badgeBg: string;
  badgeText: string;
  iconBg: string;
  iconText: string;
  focusRing: string;
}

interface WorkspaceSetupModalProps {
  title: string;
  subtitle: string;
  checklist?: string[];
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
  appearance?: "light" | "dark";
  openInNewTabHref?: string;
  openInNewTabLabel?: string;
  icon?: ReactNode;
  rightPanel?: ReactNode;
  contentClassName?: string;
  closeOnBackdropClick?: boolean;
}

/** Returns module-aware accent treatment so modal chrome follows active workspace. */
function getAccentTheme(moduleKey: TopBarModuleKey): AccentTheme {
  if (moduleKey === "compassion") {
    return {
      badgeBg: "bg-blue-50",
      badgeText: "text-blue-700",
      iconBg: "bg-blue-100",
      iconText: "text-blue-700",
      focusRing: "ring-blue-500/20",
    };
  }
  if (moduleKey === "events") {
    return {
      badgeBg: "bg-amber-50",
      badgeText: "text-amber-700",
      iconBg: "bg-amber-100",
      iconText: "text-amber-700",
      focusRing: "ring-amber-500/20",
    };
  }
  if (moduleKey === "watchdog") {
    return {
      badgeBg: "bg-rose-50",
      badgeText: "text-rose-700",
      iconBg: "bg-rose-100",
      iconText: "text-rose-700",
      focusRing: "ring-rose-500/20",
    };
  }
  if (moduleKey === "webmaster") {
    return {
      badgeBg: "bg-indigo-50",
      badgeText: "text-indigo-700",
      iconBg: "bg-indigo-100",
      iconText: "text-indigo-700",
      focusRing: "ring-indigo-500/20",
    };
  }
  if (moduleKey === "hrm") {
    return {
      badgeBg: "bg-cyan-50",
      badgeText: "text-cyan-700",
      iconBg: "bg-cyan-100",
      iconText: "text-cyan-700",
      focusRing: "ring-cyan-500/20",
    };
  }
  if (moduleKey === "oshareview") {
    return {
      badgeBg: "bg-sky-50",
      badgeText: "text-sky-700",
      iconBg: "bg-sky-100",
      iconText: "text-sky-700",
      focusRing: "ring-sky-500/20",
    };
  }
  return {
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-700",
    focusRing: "ring-emerald-500/20",
  };
}

/** WorkspaceSetupModal wraps any modal content in the setup-style chrome shell. */
export default function WorkspaceSetupModal({
  title,
  subtitle,
  checklist = [],
  onClose,
  children,
  maxWidthClassName = "max-w-4xl",
  appearance = "light",
  openInNewTabHref,
  openInNewTabLabel = "Open full screen",
  icon,
  rightPanel,
  contentClassName,
  closeOnBackdropClick = false,
}: WorkspaceSetupModalProps) {
  const pathname = usePathname();
  const moduleKey = useMemo(() => resolveTopBarModuleKey(pathname || "/"), [pathname]);
  const theme = useMemo(() => getAccentTheme(moduleKey), [moduleKey]);
  const isDark = appearance === "dark";
  const showChecklist = checklist.length > 0;

  const shellClass = isDark
    ? "border-slate-800 bg-[#020617] text-slate-100 shadow-[0_30px_120px_rgba(2,6,23,0.85)]"
    : "border-slate-200 bg-white shadow-[0_36px_100px_rgba(15,23,42,0.24)]";

  const contentPaneClass = isDark ? "bg-[#020617]" : "bg-white";

  const closeBtnClass = isDark
    ? "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700";

  const openNewTabClass = isDark
    ? "border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800"
    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100";

  const leftRailClass = isDark
    ? "border-r border-slate-800 bg-[#050b16]"
    : "border-r border-slate-200 bg-slate-50";

  const rightRailClass = isDark
    ? "border-l border-slate-800 bg-[#050b16]"
    : "border-l border-slate-200 bg-slate-50";

  const headerSubtitleClass = isDark ? "text-slate-300" : "text-slate-500";

  const iconBadgeClass = isDark
    ? "bg-slate-800 text-slate-200"
    : `${theme.iconBg} ${theme.iconText}`;

  const defaultIcon = (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12M6 12h12" />
    </svg>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (!closeOnBackdropClick) return;
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`w-full ${maxWidthClassName} max-h-[calc(100dvh-2rem)] overflow-hidden rounded-3xl border ${shellClass} ${isDark ? "dark" : ""}`}>
        <div className={`flex items-start justify-between gap-4 border-b ${isDark ? "border-slate-800" : "border-slate-200"} px-5 py-5 sm:px-6`}>
          <div className="flex min-w-0 items-start gap-3">
            <div className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconBadgeClass} ring-4 ${isDark ? "ring-slate-800" : theme.focusRing}`}>
              {icon || defaultIcon}
            </div>
            <div className="min-w-0">
              <h2 className={`text-xl font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{title}</h2>
              <p className={`mt-1 text-sm ${headerSubtitleClass}`}>{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {openInNewTabHref && (
              <a
                href={openInNewTabHref}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${openNewTabClass}`}
                title={openInNewTabLabel}
                aria-label={openInNewTabLabel}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 8h8v8M16 8l-9 9" />
                </svg>
              </a>
            )}
            <button
              onClick={onClose}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${closeBtnClass}`}
              aria-label="Close modal"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className={`grid max-h-[calc(100dvh-8.75rem)] min-h-[420px] ${showChecklist || rightPanel ? "lg:grid-cols-[260px_minmax(0,1fr)_250px]" : "grid-cols-1"}`}>
          {showChecklist ? (
            <aside className={`hidden min-h-0 overflow-y-auto p-4 lg:block ${leftRailClass}`}>
              <div className="space-y-2">
                {checklist.map((line, index) => (
                  <div
                    key={line}
                    className={`rounded-xl border px-3 py-3 ${isDark ? "border-slate-700 bg-slate-900" : index === 0 ? `${theme.badgeBg} border-slate-200` : "border-slate-200 bg-white"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${isDark ? "bg-slate-700 text-slate-200" : index === 0 ? `${theme.badgeText} bg-white` : "bg-slate-100 text-slate-500"}`}>
                        {index + 1}
                      </span>
                      <p className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-800"}`}>{line}</p>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          ) : null}

          <div className={`min-h-0 overflow-y-auto ${contentPaneClass} ${contentClassName || ""}`}>
            {children}
          </div>

          {(showChecklist || rightPanel) ? (
            <aside className={`hidden min-h-0 overflow-y-auto p-4 lg:block ${rightRailClass}`}>
              {rightPanel || (
                <div className="space-y-3">
                  <div className={`rounded-xl border p-3 ${isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
                    <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Secure and Private</p>
                    <p className={`mt-2 text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>All updates in this modal follow workspace access controls and save to audit-friendly backend paths.</p>
                  </div>
                  <div className={`rounded-xl border p-3 ${isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
                    <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Tip</p>
                    <p className={`mt-2 text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>You can finish the essentials now and add more details after creating the record.</p>
                  </div>
                </div>
              )}
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
