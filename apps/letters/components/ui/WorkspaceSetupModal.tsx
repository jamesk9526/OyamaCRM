/** Shared setup-style modal shell with module-aware accent theming for CRM modals. */
"use client";

import { type ReactNode, useMemo } from "react";
import { usePathname } from "next/navigation";
import { resolveTopBarModuleKey, type TopBarModuleKey } from "@/lib/navigation-boundaries";

interface AccentTheme {
  sidebarGradient: string;
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
}

/** Returns module-aware accent treatment so modal chrome follows active workspace. */
function getAccentTheme(moduleKey: TopBarModuleKey): AccentTheme {
  if (moduleKey === "compassion") {
    return { sidebarGradient: "from-blue-600 to-sky-600" };
  }
  if (moduleKey === "events") {
    return { sidebarGradient: "from-amber-600 to-orange-600" };
  }
  if (moduleKey === "watchdog") {
    return { sidebarGradient: "from-red-600 to-rose-600" };
  }
  if (moduleKey === "webmaster") {
    return { sidebarGradient: "from-indigo-600 to-violet-600" };
  }
  if (moduleKey === "hrm") {
    return { sidebarGradient: "from-teal-600 to-cyan-600" };
  }
  if (moduleKey === "oshareview") {
    return { sidebarGradient: "from-cyan-600 to-sky-600" };
  }
  return { sidebarGradient: "from-green-600 to-emerald-600" };
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
}: WorkspaceSetupModalProps) {
  const pathname = usePathname();
  const moduleKey = useMemo(() => resolveTopBarModuleKey(pathname || "/"), [pathname]);
  const theme = useMemo(() => getAccentTheme(moduleKey), [moduleKey]);
  const isDark = appearance === "dark";

  const shellClass = isDark
    ? "border-slate-800 bg-[#020617] text-slate-100 shadow-[0_30px_120px_rgba(2,6,23,0.85)]"
    : "border-gray-200 bg-white shadow-2xl";

  const contentPaneClass = isDark
    ? "bg-[#020617]"
    : "bg-white";

  const closeBtnClass = isDark
    ? "text-slate-400 hover:text-slate-100"
    : "text-gray-400 hover:text-gray-600";

  const openNewTabClass = isDark
    ? "border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800"
    : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100";

  const sidebarClass = isDark
    ? "border-r border-slate-800 bg-[#050b16] text-slate-100"
    : `bg-gradient-to-b ${theme.sidebarGradient} text-white`;

  const sidebarKickerClass = isDark
    ? "text-slate-400"
    : "text-white/80";

  const sidebarSubtitleClass = isDark
    ? "text-slate-300"
    : "text-white/85";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
      <div className={`w-full ${maxWidthClassName} max-h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl border ${shellClass} ${isDark ? "dark" : ""}`}>
        <div className="grid max-h-[calc(100dvh-2rem)] lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className={`relative overflow-y-auto p-5 ${sidebarClass}`}>
            {!isDark && <div className="absolute -right-10 -top-8 w-28 h-28 rounded-full bg-white/15 blur-md animate-pulse" />}
            <p className={`text-[11px] uppercase tracking-[0.16em] font-semibold ${sidebarKickerClass}`}>CRM Workspace Modal</p>
            <h2 className="mt-2 text-xl font-semibold">{title}</h2>
            <p className={`mt-2 text-sm leading-relaxed ${sidebarSubtitleClass}`}>{subtitle}</p>
            {checklist.length > 0 && (
              <div className={`mt-4 space-y-2 text-xs ${isDark ? "text-slate-300" : "text-white/90"}`}>
                {checklist.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}
          </aside>

          <div className={`relative min-h-0 overflow-hidden ${contentPaneClass}`}>
            {openInNewTabHref && (
              <a
                href={openInNewTabHref}
                target="_blank"
                rel="noopener noreferrer"
                className={`absolute right-14 top-4 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${openNewTabClass}`}
              >
                {openInNewTabLabel}
              </a>
            )}
            <button
              onClick={onClose}
              className={`absolute right-4 top-4 transition-colors ${closeBtnClass}`}
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
