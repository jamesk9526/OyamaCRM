/** Floating Steward launcher that always hands staff into the full Copilot workspace. */
"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import StewardAvatarIcon from "@/app/components/ui/StewardAvatarIcon";
import { STEWARD_OPEN_EVENT, type StewardOpenPromptDetail } from "@/app/lib/steward-context";

type StewardModuleKey = "donor" | "events" | "watchdog" | "webmaster" | "all";

interface StewardDockPanelProps { moduleKey?: string; behindOverlay?: boolean; showLauncher?: boolean; }

function normalizeStewardModule(moduleKey?: string): StewardModuleKey {
  const valid = new Set<StewardModuleKey>(["donor", "events", "watchdog", "webmaster", "all"]);
  return moduleKey && valid.has(moduleKey as StewardModuleKey) ? moduleKey as StewardModuleKey : "donor";
}

/** Builds a workspace URL while retaining the page context that prompted the request. */
function stewardWorkspaceHref(moduleKey: StewardModuleKey, scopePath: string, detail?: StewardOpenPromptDetail | null) {
  const params = new URLSearchParams({ module: moduleKey, scope: scopePath });
  if (detail?.prompt?.trim()) params.set("prompt", detail.prompt.trim());
  if (detail?.mode) params.set("mode", detail.mode);
  return `/steward-ai-workspace?${params.toString()}`;
}

/** Keeps the chat head small and opens the dedicated, full-featured Steward workspace on click. */
export default function StewardDockPanel({ moduleKey, showLauncher = true }: StewardDockPanelProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [scopePath, setScopePath] = useState("/");

  useEffect(() => {
    setHydrated(true);
    setScopePath(`${window.location.pathname}${window.location.search}`);
  }, [pathname]);

  const openWorkspace = useCallback((detail?: StewardOpenPromptDetail | null) => {
    const resolvedModule = normalizeStewardModule(detail?.moduleKey ?? moduleKey);
    const currentScope = `${window.location.pathname}${window.location.search}`;
    router.push(stewardWorkspaceHref(resolvedModule, currentScope || scopePath, detail));
  }, [moduleKey, router, scopePath]);

  useEffect(() => {
    const handleOpenWithPrompt = (event: Event) => {
      const detail = (event as CustomEvent<StewardOpenPromptDetail>).detail;
      if (detail?.prompt) openWorkspace(detail);
    };
    window.addEventListener(STEWARD_OPEN_EVENT, handleOpenWithPrompt);
    return () => window.removeEventListener(STEWARD_OPEN_EVENT, handleOpenWithPrompt);
  }, [openWorkspace]);

  if (!hydrated || !showLauncher) return null;
  return <button type="button" onClick={() => openWorkspace()} title="Open Steward workspace" aria-label="Open Steward workspace" className="group fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[9990] flex h-13 w-13 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-[#0f6cbd] to-[#6246c7] shadow-[0_12px_30px_rgba(15,108,189,0.32)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(15,108,189,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f6cbd] focus-visible:ring-offset-2 sm:right-6">
    <StewardAvatarIcon size={34} alt="Steward" className="ring-2 ring-white/80" />
    <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" aria-hidden="true" />
    <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 opacity-0 shadow-lg transition group-hover:opacity-100">Open Steward</span>
  </button>;
}
