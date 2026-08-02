/** Compact Messenger-style launcher for Steward Copilot and staff messages. */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import StewardChatPanel from "@/app/components/ai/StewardChatPanel";
import StewardAvatarIcon from "@/app/components/ui/StewardAvatarIcon";
import { STEWARD_OPEN_EVENT, type StewardOpenPromptDetail } from "@/app/lib/steward-context";

type StewardChatModuleKey = "donor" | "compassion" | "events" | "watchdog" | "webmaster" | "oshareview" | "password";

interface StewardDockPanelProps {
  moduleKey?: string;
  behindOverlay?: boolean;
  showLauncher?: boolean;
}

const STORAGE_KEY = "steward-dock-open";
const DOCK_STATE_EVENT = "steward-dock-state";

function normalizeStewardModule(moduleKey?: string): StewardChatModuleKey {
  const valid = new Set<StewardChatModuleKey>(["donor", "compassion", "events", "watchdog", "webmaster", "oshareview", "password"]);
  return moduleKey && valid.has(moduleKey as StewardChatModuleKey) ? moduleKey as StewardChatModuleKey : "donor";
}

/** Keeps a small companion available in CRM and hands larger work to the embedded workspace. */
export default function StewardDockPanel({
  moduleKey,
  showLauncher = true,
}: StewardDockPanelProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [externalPrompt, setExternalPrompt] = useState<StewardOpenPromptDetail | null>(null);
  const [scopePath, setScopePath] = useState("/");

  const emitDockState = useCallback((nextOpen: boolean) => {
    window.dispatchEvent(new CustomEvent(DOCK_STATE_EVENT, { detail: { open: nextOpen, pushLayout: false, panelWidth: 0 } }));
  }, []);

  const openDock = useCallback(() => {
    setOpen(true);
    localStorage.setItem(STORAGE_KEY, "true");
    emitDockState(true);
  }, [emitDockState]);

  const closeDock = useCallback(() => {
    setOpen(false);
    setExternalPrompt(null);
    localStorage.setItem(STORAGE_KEY, "false");
    emitDockState(false);
  }, [emitDockState]);

  useEffect(() => {
    const restoredOpen = localStorage.getItem(STORAGE_KEY) === "true";
    setOpen(restoredOpen);
    emitDockState(restoredOpen);
    setHydrated(true);
    return () => emitDockState(false);
  }, [emitDockState]);

  useEffect(() => {
    setScopePath(`${window.location.pathname}${window.location.search}`);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeDock(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDock, open]);

  useEffect(() => {
    const handleOpenWithPrompt = (event: Event) => {
      const detail = (event as CustomEvent<StewardOpenPromptDetail>).detail;
      if (!detail?.prompt) return;
      setExternalPrompt(detail);
      openDock();
    };
    window.addEventListener(STEWARD_OPEN_EVENT, handleOpenWithPrompt);
    return () => window.removeEventListener(STEWARD_OPEN_EVENT, handleOpenWithPrompt);
  }, [openDock]);

  if (!hydrated) return null;
  const stewardModule = normalizeStewardModule(externalPrompt?.moduleKey ?? moduleKey);
  const workspaceHref = `/steward-ai-workspace?module=${encodeURIComponent(stewardModule)}&scope=${encodeURIComponent(scopePath)}`;

  return (
    <>
      {showLauncher && !open ? (
        <button
          type="button"
          onClick={openDock}
          title="Chat with Steward Copilot"
          aria-label="Open Steward Copilot chat"
          className="group fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[9990] flex h-13 w-13 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-[#0f6cbd] to-[#6246c7] shadow-[0_12px_30px_rgba(15,108,189,0.32)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(15,108,189,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f6cbd] focus-visible:ring-offset-2 sm:right-6"
        >
          <StewardAvatarIcon size={34} alt="Steward" className="ring-2 ring-white/80" />
          <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" aria-hidden="true" />
          <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 opacity-0 shadow-lg transition group-hover:opacity-100">Ask Steward</span>
        </button>
      ) : null}

      {open ? (
        <section className="fixed inset-x-2 bottom-2 top-[4.25rem] z-[9991] flex flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.24)] sm:inset-x-auto sm:left-auto sm:right-5 sm:top-auto sm:h-[min(590px,calc(100dvh-5rem))] sm:w-[min(390px,calc(100vw-2rem))]" aria-label="Steward Copilot">
          <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-gradient-to-r from-[#f6fbff] to-white px-3 py-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="relative"><StewardAvatarIcon size={30} alt="Steward" className="ring-2 ring-white shadow-sm" /><span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" /></span>
              <div className="min-w-0"><h2 className="truncate text-sm font-semibold text-slate-900">Steward Copilot</h2><p className="truncate text-[10px] text-slate-500">OyamaCRM intelligence · Ready</p></div>
            </div>
            <Link href={workspaceHref} title="Open larger Copilot workspace" aria-label="Open larger Copilot workspace" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-[#eaf4fd] hover:text-[#0f6cbd]"><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5v5m0-5-7 7M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" /></svg></Link>
            <button type="button" onClick={closeDock} title="Minimize" aria-label="Minimize chat" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" d="M6 12h12" /></svg></button>
          </header>

          <div className="min-h-0 flex-1 overflow-hidden bg-white">
            <StewardChatPanel open onClose={closeDock} moduleKey={stewardModule} scopePath={scopePath} displayMode="workspace" embeddedCompact externalPrompt={externalPrompt} onExternalPromptConsumed={() => setExternalPrompt(null)} />
          </div>
        </section>
      ) : null}
    </>
  );
}
