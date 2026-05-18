/**
 * StewardDockPanel — floating chat-head + slide-in right-side dock panel.
 * Renders a floating Steward button when closed; a fixed 420px right panel
 * containing AGENTStewardWorkspace in dock mode when open.
 * This is the unified docked agent surface — the full workspace lives at /steward-ai-workspace.
 */
"use client";

import { useState, useCallback, useEffect } from "react";
import AGENTStewardWorkspace from "@/app/components/ai/AGENTStewardWorkspace";
import StewardAvatarIcon from "@/app/components/ui/StewardAvatarIcon";
import { STEWARD_OPEN_EVENT, type StewardOpenPromptDetail } from "@/app/lib/steward-context";

interface StewardDockPanelProps {
  /** Active CRM module key passed from TopBar so the dock scopes correctly. */
  moduleKey?: string;
}

const STORAGE_KEY = "steward-dock-open";
const DOCK_STATE_EVENT = "steward-dock-state";
const DOCK_WIDTH_PX = 420;

/** StewardDockPanel renders the floating chat-head and the slide-in agent dock. */
export default function StewardDockPanel({ moduleKey }: StewardDockPanelProps) {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // Track the visual viewport height so the panel shrinks above the iOS keyboard.
  const [viewportH, setViewportH] = useState<string>("100dvh");
  // Contextual prompt fired from StewardContextButton elsewhere in the UI.
  const [externalPrompt, setExternalPrompt] = useState<StewardOpenPromptDetail | null>(null);

  const emitDockState = useCallback((nextOpen: boolean) => {
    const pushLayout = nextOpen && window.innerWidth >= 1024;
    window.dispatchEvent(new CustomEvent(DOCK_STATE_EVENT, {
      detail: { open: nextOpen, pushLayout, panelWidth: pushLayout ? DOCK_WIDTH_PX : 0 },
    }));
  }, []);

  // Restore open state from localStorage on mount.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const restored = saved === "true";
    setOpen(restored);
    emitDockState(restored);
    setHydrated(true);
    return () => emitDockState(false);
  }, [emitDockState]);

  // Track visual viewport so the panel stays above the iOS soft keyboard.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setViewportH(`${vv.height}px`);
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const open_ = useCallback(() => {
    setOpen(true);
    localStorage.setItem(STORAGE_KEY, "true");
    emitDockState(true);
  }, [emitDockState]);

  const close = useCallback(() => {
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, "false");
    emitDockState(false);
    // Clear external prompt on close so it doesn't replay
    setExternalPrompt(null);
  }, [emitDockState]);

  // Listen for steward:open-with-prompt events fired by StewardContextButton.
  useEffect(() => {
    function handleOpenWithPrompt(e: Event) {
      const detail = (e as CustomEvent<StewardOpenPromptDetail>).detail;
      if (!detail?.prompt) return;
      setExternalPrompt(detail);
      setOpen(true);
      localStorage.setItem(STORAGE_KEY, "true");
      emitDockState(true);
    }
    window.addEventListener(STEWARD_OPEN_EVENT, handleOpenWithPrompt);
    return () => window.removeEventListener(STEWARD_OPEN_EVENT, handleOpenWithPrompt);
  }, [emitDockState]);

  // Don't render anything until client hydration to avoid SSR mismatch.
  if (!hydrated) return null;

  const VALID_MODULES = new Set(["donor","compassion","events","watchdog","webmaster","hrm","all"]);
  const validModule = (moduleKey && VALID_MODULES.has(moduleKey) ? moduleKey : "donor") as
    "donor" | "compassion" | "events" | "watchdog" | "webmaster" | "hrm" | "all";

  return (
    <>
      {/* ── Floating chat-head — visible when panel is closed ─────────────── */}
      {!open && (
        <button
          type="button"
          onClick={open_}
          title="Open Steward AI"
          style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))", right: "1.5rem" }}
          className="group fixed z-[9990] flex h-13 w-13 items-center justify-center rounded-full text-white shadow-[0_16px_32px_rgba(5,46,22,0.35)] transition-all duration-200 hover:scale-[1.06] hover:shadow-[0_20px_40px_rgba(5,46,22,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/90 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-95 touch-manipulation"
          aria-label="Open Steward AI assistant"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-1 rounded-full bg-emerald-400/30 blur-md transition-opacity duration-200 group-hover:opacity-100"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(145deg,#34d399_0%,#10b981_50%,#059669_100%)]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-[2px] rounded-full bg-[radial-gradient(circle_at_30%_22%,rgba(255,255,255,0.32),rgba(255,255,255,0)_40%),linear-gradient(155deg,#064e3b_0%,#065f46_58%,#047857_100%)]"
          />
          <span className="relative z-10">
            <StewardAvatarIcon size={24} alt="Steward" className="ring-white/40 bg-emerald-100/85" />
          </span>
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-lime-300 ring-2 ring-emerald-900"
          />
          <span className="pointer-events-none absolute right-full mr-2 hidden whitespace-nowrap rounded-full border border-emerald-200/60 bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100 lg:block">
            Steward AI
          </span>
        </button>
      )}

      {/* ── Mobile backdrop — dims screen behind panel ────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-[9990] bg-black/30 sm:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* ── Slide-in right panel ──────────────────────────────────────────── */}
      <div
        className={`fixed top-0 right-0 z-[9991] flex flex-col w-full sm:w-[420px] bg-white border-l border-slate-200 shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ height: viewportH }}
        aria-hidden={!open}
      >
        {/*
          Mount AGENTStewardWorkspace only when open so it doesn't consume
          resources while hidden. It will re-hydrate from localStorage on open.
        */}
        {open && (
          <AGENTStewardWorkspace
            initialModule={(externalPrompt?.moduleKey ?? validModule)}
            dockMode
            onCloseDock={close}
            externalPrompt={externalPrompt ?? undefined}
            onExternalPromptConsumed={() => setExternalPrompt(null)}
          />
        )}
      </div>
    </>
  );
}
