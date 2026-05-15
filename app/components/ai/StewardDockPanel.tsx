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

interface StewardDockPanelProps {
  /** Active CRM module key passed from TopBar so the dock scopes correctly. */
  moduleKey?: string;
}

const STORAGE_KEY = "steward-dock-open";

/** StewardDockPanel renders the floating chat-head and the slide-in agent dock. */
export default function StewardDockPanel({ moduleKey }: StewardDockPanelProps) {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // Track the visual viewport height so the panel shrinks above the iOS keyboard.
  const [viewportH, setViewportH] = useState<string>("100dvh");

  // Restore open state from localStorage on mount.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    setOpen(saved === "true");
    setHydrated(true);
  }, []);

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
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, "false");
  }, []);

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
          className="fixed z-[9990] flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl ring-2 ring-emerald-500/30 hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all touch-manipulation"
          aria-label="Open Steward AI assistant"
        >
          <StewardAvatarIcon size={22} alt="Steward" />
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
            initialModule={validModule}
            dockMode
            onCloseDock={close}
          />
        )}
      </div>
    </>
  );
}
