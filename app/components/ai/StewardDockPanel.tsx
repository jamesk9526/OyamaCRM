/**
 * StewardDockPanel — floating chroma-dark chat-head + slide-in right-side dock panel.
 * Renders a floating Steward button when closed; a fixed 420px right panel
 * containing AGENTStewardWorkspace in dock mode when open.
 * This is the unified docked agent surface — the full workspace lives at /steward-ai-workspace.
 */
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import AGENTStewardWorkspace from "@/app/components/ai/AGENTStewardWorkspace";
import StewardAvatarIcon from "@/app/components/ui/StewardAvatarIcon";
import { STEWARD_OPEN_EVENT, type StewardOpenPromptDetail } from "@/app/lib/steward-context";

interface StewardDockPanelProps {
  /** Active CRM module key passed from TopBar so the dock scopes correctly. */
  moduleKey?: string;
}

const STORAGE_KEY = "steward-dock-open";
const WIDTH_STORAGE_KEY = "steward-dock-width";
const DOCK_STATE_EVENT = "steward-dock-state";
const DOCK_WIDTH_PX = 420;
const DOCK_MIN_WIDTH_PX = 360;
const DOCK_MAX_WIDTH_PX = 780;
const TOPBAR_OFFSET_PX = 56;

/** StewardDockPanel renders the floating chat-head and the slide-in agent dock. */
export default function StewardDockPanel({ moduleKey }: StewardDockPanelProps) {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [dockWidth, setDockWidth] = useState<number>(DOCK_WIDTH_PX);
  // Track the visual viewport height so the panel shrinks above the iOS keyboard.
  const [viewportH, setViewportH] = useState<string>("100dvh");
  // Contextual prompt fired from StewardContextButton elsewhere in the UI.
  const [externalPrompt, setExternalPrompt] = useState<StewardOpenPromptDetail | null>(null);
  const dockWidthRef = useRef(DOCK_WIDTH_PX);

  useEffect(() => {
    dockWidthRef.current = dockWidth;
  }, [dockWidth]);

  const emitDockState = useCallback((nextOpen: boolean, widthOverride?: number) => {
    const pushLayout = nextOpen && window.innerWidth >= 1024;
    const panelWidth = pushLayout ? (widthOverride ?? dockWidthRef.current) : 0;
    window.dispatchEvent(new CustomEvent(DOCK_STATE_EVENT, {
      detail: { open: nextOpen, pushLayout, panelWidth },
    }));
  }, []);

  // Restore open state from localStorage on mount.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const restored = saved === "true";
    const savedWidth = Number.parseInt(localStorage.getItem(WIDTH_STORAGE_KEY) ?? "", 10);
    let initialWidth = DOCK_WIDTH_PX;
    if (Number.isFinite(savedWidth)) {
      initialWidth = Math.min(DOCK_MAX_WIDTH_PX, Math.max(DOCK_MIN_WIDTH_PX, savedWidth));
      dockWidthRef.current = initialWidth;
      setDockWidth(initialWidth);
    }
    setOpen(restored);
    emitDockState(restored, initialWidth);
    setHydrated(true);
    return () => emitDockState(false);
  }, [emitDockState]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(WIDTH_STORAGE_KEY, String(dockWidth));
    if (open) {
      emitDockState(true, dockWidth);
    }
  }, [dockWidth, hydrated, open, emitDockState]);

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
          className="steward-chat-head group fixed z-[9990] flex h-13 w-13 items-center justify-center rounded-full text-white shadow-[0_18px_40px_rgba(0,0,0,0.45)] transition-all duration-200 hover:scale-[1.04] hover:shadow-[0_22px_50px_rgba(34,211,238,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b] active:scale-95 touch-manipulation"
          aria-label="Open Steward AI assistant"
        >
          <span
            aria-hidden="true"
            className="steward-chat-head-pulse pointer-events-none absolute -inset-1 rounded-full bg-cyan-300/18 blur-md transition-opacity duration-200 group-hover:opacity-100"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-[#05070a]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-[1px] rounded-full border border-white/10 bg-[linear-gradient(160deg,#11151c_0%,#080a0f_100%)]"
          />
          <span className="relative z-10">
            <StewardAvatarIcon size={24} alt="Steward" className="ring-cyan-300/45 bg-slate-950" />
          </span>
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-cyan-300 ring-2 ring-[#05070a] shadow-[0_0_12px_rgba(34,211,238,0.9)]"
          />
          <span className="pointer-events-none absolute right-full mr-2 hidden whitespace-nowrap rounded-full border border-cyan-300/20 bg-[#0d1117]/95 px-2 py-0.5 text-[11px] font-semibold text-cyan-100 opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100 lg:block">
            Steward AI
          </span>
        </button>
      )}

      {/* ── Mobile backdrop — dims screen behind panel ────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-[9990] bg-black/55 backdrop-blur-sm sm:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* ── Slide-in right panel ──────────────────────────────────────────── */}
      <div
        className={`${open ? "steward-dock-shell shadow-2xl" : "shadow-none"} fixed right-0 z-[9991] flex flex-col w-full bg-[#09090b] border-l border-white/10 transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          top: `${TOPBAR_OFFSET_PX}px`,
          width: `min(100vw, ${dockWidth}px)`,
          height: `calc(${viewportH} - ${TOPBAR_OFFSET_PX}px)`,
        }}
        aria-hidden={!open}
      >
        {/* Desktop resize rail */}
        <div
          className="absolute left-0 top-0 hidden h-full w-2 -translate-x-1 cursor-col-resize bg-transparent lg:block"
          onMouseDown={(event) => {
            event.preventDefault();
            const startX = event.clientX;
            const startWidth = dockWidth;

            function onMouseMove(moveEvent: MouseEvent) {
              const next = startWidth - (moveEvent.clientX - startX);
              const bounded = Math.max(DOCK_MIN_WIDTH_PX, Math.min(DOCK_MAX_WIDTH_PX, next));
              setDockWidth(bounded);
            }

            function onMouseUp() {
              window.removeEventListener("mousemove", onMouseMove);
              window.removeEventListener("mouseup", onMouseUp);
            }

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
          }}
          title="Resize Steward panel"
          aria-label="Resize Steward panel"
        />
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
