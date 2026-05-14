/** Shared setup-style modal shell with module-aware accent theming for CRM modals. */
"use client";

import { type ReactNode, useMemo } from "react";
import { usePathname } from "next/navigation";
import { resolveTopBarModuleKey, type TopBarModuleKey } from "@/app/lib/navigation-boundaries";

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
}: WorkspaceSetupModalProps) {
  const pathname = usePathname();
  const moduleKey = useMemo(() => resolveTopBarModuleKey(pathname || "/"), [pathname]);
  const theme = useMemo(() => getAccentTheme(moduleKey), [moduleKey]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`w-full ${maxWidthClassName} bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden`}>
        <div className="grid lg:grid-cols-[260px_1fr]">
          <aside className={`relative bg-gradient-to-b ${theme.sidebarGradient} text-white p-5`}>
            <div className="absolute -right-10 -top-8 w-28 h-28 rounded-full bg-white/15 blur-md animate-pulse" />
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-white/80">CRM Workspace Modal</p>
            <h2 className="mt-2 text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-white/85 leading-relaxed">{subtitle}</p>
            {checklist.length > 0 && (
              <div className="mt-4 space-y-2 text-xs text-white/90">
                {checklist.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}
          </aside>

          <div className="relative">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
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
