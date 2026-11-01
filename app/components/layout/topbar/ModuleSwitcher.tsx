"use client";
import { useDialogFocus } from "@/app/components/ui/useDialogFocus";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { TopBarModuleKey } from "@/app/lib/navigation-boundaries";
import type { WorkspaceSettings } from "@/app/lib/workspace-settings";
import { resolveModuleSwitcherTone } from "./theme-tokens";
/** Workspace switcher icon set using inline SVG (no custom image assets). */
function WorkspaceSwitcherIcon({ moduleKey, className = "w-4 h-4" }: { moduleKey: TopBarModuleKey; className?: string }) {
  if (moduleKey === "letters") {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h10l4 4v14H6V3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 11h6M9 15h6M16 3v5h4" />
      </svg>
    );
  }
  if (moduleKey === "events") {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4.5" y="5.5" width="15" height="14" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 3.5v4M16 3.5v4M4.5 10.5h15" />
      </svg>
    );
  }
  if (moduleKey === "watchdog") {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5l7 2.8v5.6c0 4.2-3 7.7-7 8.8-4-1.1-7-4.6-7-8.8V6.3L12 3.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12.5l1.7 1.7 3.3-3.4" />
      </svg>
    );
  }
  if (moduleKey === "webmaster") {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 8.5h17M8.5 4.5v4" />
      </svg>
    );
  }
  if (moduleKey === "oshareview") {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 18.5h14" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 15.5v-4M12 15.5V8M16.5 15.5v-6" />
      </svg>
    );
  }

  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5l2.2 4.5 4.9.7-3.5 3.4.8 4.9L12 15.9 7.6 18l.8-4.9-3.5-3.4 4.9-.7L12 4.5z" />
    </svg>
  );
}

/**
 * ModuleSwitcher: lets users switch between all enabled OyamaCRM modules.
 */
export default function ModuleSwitcher({
  moduleKey,
  settings,
  scrolled = false,
}: {
  moduleKey: TopBarModuleKey;
  settings: WorkspaceSettings;
  scrolled?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, open, () => setOpen(false));

  const modules = useMemo(() => [
    { key: "compassion", label: "Compassion CRM", helper: "Client care", href: "/compassion", icon: <WorkspaceSwitcherIcon moduleKey="compassion" />, active: moduleKey === "compassion" },
    {
      key: "donor",
      label: "DonorCRM",
      helper: "Fundraising",
      href: "/",
      icon: <WorkspaceSwitcherIcon moduleKey="donor" />,
      active: moduleKey === "donor" && !pathname.startsWith("/reports"),
    },
    {
      key: "letters",
      label: "OyamaLetters",
      helper: "Document studio",
      href: "/oyama-letters",
      icon: <WorkspaceSwitcherIcon moduleKey="letters" />,
      active: moduleKey === "letters",
    },
    {
      key: "events",
      label: "Events",
      helper: "Operations",
      href: "/events",
      icon: <WorkspaceSwitcherIcon moduleKey="events" />,
      active: moduleKey === "events",
    },
  ].filter((module) => {
    if (module.key === "donor") return settings.donorEnabled;
    return true;
  }), [moduleKey, pathname, settings.donorEnabled]);

  const current = useMemo(() => modules.find((m) => m.active) ?? modules[0], [modules]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!current) return null;

  const switcherTone = resolveModuleSwitcherTone(current.key as TopBarModuleKey, scrolled);
  const isDonorWorkspace = moduleKey === "donor";

  function switchTo(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Switch workspace"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`oyama-reference-workspace-switcher group relative flex items-center overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-200 ease-out ${isDonorWorkspace ? "border-white/10 bg-white/[0.06] hover:border-white/20 hover:bg-white/[0.1]" : `hover:border-slate-400 ${switcherTone.button}`} ${scrolled ? "gap-1 px-1.5 py-0.5 xl:min-w-[150px] xl:gap-1.5 xl:px-2.5 xl:py-0.5" : "gap-1.5 px-2.5 py-1 xl:min-w-[182px] xl:gap-2 xl:px-3.5 xl:py-1"}`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${isDonorWorkspace ? "from-emerald-300/10 via-transparent to-violet-300/10" : switcherTone.glow} transition-opacity duration-200 ${open ? "opacity-90" : "opacity-40 group-hover:opacity-60"}`}
        />
        <span className={`relative flex items-center justify-center rounded-xl border transition-all duration-300 ${isDonorWorkspace ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200" : (current.key === "donor" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700")} ${scrolled ? "h-5 w-5 xl:h-5 xl:w-5" : "h-6 w-6 xl:h-6 xl:w-6"}`}>
          {current.icon}
        </span>
        <div className="relative hidden min-w-0 text-left leading-tight min-[1180px]:block lg:block">
          <p className={`max-h-3.5 overflow-hidden text-[8px] uppercase tracking-[0.16em] ${isDonorWorkspace ? "text-slate-600" : "text-slate-500"}`}>Workspace</p>
          <p className={`truncate font-semibold transition-[font-size,color] duration-300 ${scrolled ? "text-[10px]" : "text-[12px]"} ${isDonorWorkspace ? "text-white" : "text-slate-800"}`}>{current.label}</p>
        </div>
        <svg className={`relative h-3 w-3 transition-[transform,color] ${isDonorWorkspace ? "text-slate-300 group-hover:text-white" : "text-slate-500 group-hover:text-slate-700"} ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Switch workspace" tabIndex={-1} className={`fixed inset-x-2 bottom-2 z-50 mt-0 w-auto max-w-none overflow-hidden rounded-lg shadow-lg pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:absolute lg:inset-x-auto lg:left-0 lg:bottom-auto lg:top-full lg:mt-2 lg:w-[330px] lg:max-w-[calc(100vw-1rem)] lg:pb-0 ${isDonorWorkspace ? "border border-slate-200 bg-white text-slate-800" : "border border-slate-300 bg-white"}`}>
            <div className={`border-b px-4 pt-3 pb-2.5 ${isDonorWorkspace ? "border-slate-100 bg-slate-50" : "border-slate-200 bg-slate-50"}`}>
              <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${isDonorWorkspace ? "text-slate-600" : "text-slate-500"}`}>Switch Workspace</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className={`text-[11px] ${isDonorWorkspace ? "text-slate-600" : "text-slate-500"}`}>Move between modules without leaving your session.</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isDonorWorkspace ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100" : "bg-slate-100 text-slate-600"}`}>
                  {modules.length} active
                </span>
              </div>
            </div>
            <div className="max-h-[min(66vh,30rem)] space-y-1.5 overflow-y-auto p-2.5">
              {modules.map((m) => (
                <button
                  key={m.key}
                  onClick={() => switchTo(m.href)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${m.active ? switcherTone.activeItem : isDonorWorkspace ? "border-transparent bg-transparent hover:border-blue-100 hover:bg-blue-50" : "border-transparent bg-transparent hover:border-slate-200 hover:bg-slate-50"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${m.active ? switcherTone.activeIcon : isDonorWorkspace ? "border-blue-100 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}>
                      {m.icon}
                    </span>
                    <div className="min-w-0 flex-1 px-0.5">
                      <p className={`truncate text-[12px] font-semibold ${isDonorWorkspace ? "text-slate-800" : "text-slate-900"}`}>{m.label}</p>
                      <p className={`mt-0.5 truncate text-[10px] ${isDonorWorkspace ? "text-slate-600" : "text-slate-500"}`}>{m.helper}</p>
                    </div>
                    {m.active ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${switcherTone.activePill}`}>
                        Current
                      </span>
                    ) : (
                        <svg className={`h-3.5 w-3.5 ${isDonorWorkspace ? "text-slate-500" : "text-slate-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 6l6 6-6 6" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

