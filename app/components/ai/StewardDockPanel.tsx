/**
 * StewardDockPanel renders the unified Steward + staff messages dock.
 *
 * The dock intentionally behaves like a compact DM window instead of a
 * full-height CRM side panel: a bottom-right launcher opens a tabbed
 * conversation surface for Steward AI and internal staff messages.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import MessengerPanel from "@/app/components/messenger/MessengerPanel";
import StewardChatPanel from "@/app/components/ai/StewardChatPanel";
import StewardAvatarIcon from "@/app/components/ui/StewardAvatarIcon";
import { STEWARD_OPEN_EVENT, type StewardOpenPromptDetail } from "@/app/lib/steward-context";

type DockTab = "steward" | "messages";
type StewardChatModuleKey =
  | "donor"
  | "compassion"
  | "events"
  | "watchdog"
  | "webmaster"
  | "oshareview"
  | "hrm"
  | "password";

interface StewardDockPanelProps {
  /** Active CRM module key passed from TopBar so Steward scopes correctly. */
  moduleKey?: string;
  /** Kept for older call sites; the new dock no longer sits behind Messenger. */
  behindOverlay?: boolean;
  /** TopBar message button command. When true, the dock opens to Messages. */
  messagesOpen?: boolean;
  /** Keeps TopBar unread and background-SSE behavior in sync with the dock tab. */
  onMessagesOpenChange?: (open: boolean) => void;
  /** Current unread count for the closed launcher badge. */
  messengerUnread?: number;
  /** Receives unread count changes from the embedded Messenger app. */
  onMessengerUnreadChange?: (count: number) => void;
  /** When false, the dock is opened only by external/top-bar controls. */
  showLauncher?: boolean;
}

const STORAGE_KEY = "steward-dock-open";
const TAB_STORAGE_KEY = "steward-dock-tab";
const PILL_COLLAPSED_STORAGE_KEY = "steward-dock-pill-collapsed";
const DOCK_STATE_EVENT = "steward-dock-state";

function normalizeStewardModule(moduleKey?: string): StewardChatModuleKey {
  const valid = new Set<StewardChatModuleKey>([
    "donor",
    "compassion",
    "events",
    "watchdog",
    "webmaster",
    "oshareview",
    "hrm",
    "password",
  ]);
  return moduleKey && valid.has(moduleKey as StewardChatModuleKey)
    ? (moduleKey as StewardChatModuleKey)
    : "donor";
}

/** StewardDockPanel combines Steward AI and real staff DMs in one docked chat box. */
export default function StewardDockPanel({
  moduleKey,
  messagesOpen = false,
  onMessagesOpenChange,
  messengerUnread = 0,
  onMessengerUnreadChange,
  showLauncher = true,
}: StewardDockPanelProps) {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<DockTab>("steward");
  const [externalPrompt, setExternalPrompt] = useState<StewardOpenPromptDetail | null>(null);
  const [scopePath, setScopePath] = useState("/");
  const [pillDraft, setPillDraft] = useState("");
  const [pillCollapsed, setPillCollapsed] = useState(false);

  const emitDockState = useCallback((nextOpen: boolean) => {
    window.dispatchEvent(new CustomEvent(DOCK_STATE_EVENT, {
      detail: { open: nextOpen, pushLayout: false, panelWidth: 0 },
    }));
  }, []);

  const openDock = useCallback((tab: DockTab) => {
    setActiveTab(tab);
    setOpen(true);
    localStorage.setItem(STORAGE_KEY, "true");
    localStorage.setItem(TAB_STORAGE_KEY, tab);
    emitDockState(true);
    onMessagesOpenChange?.(tab === "messages");
  }, [emitDockState, onMessagesOpenChange]);

  const closeDock = useCallback(() => {
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, "false");
    emitDockState(false);
    setExternalPrompt(null);
    onMessagesOpenChange?.(false);
  }, [emitDockState, onMessagesOpenChange]);

  const switchTab = useCallback((tab: DockTab) => {
    setActiveTab(tab);
    localStorage.setItem(TAB_STORAGE_KEY, tab);
    onMessagesOpenChange?.(tab === "messages" && open);
  }, [onMessagesOpenChange, open]);

  useEffect(() => {
    setScopePath(`${window.location.pathname}${window.location.search}`);
    const restoredOpen = localStorage.getItem(STORAGE_KEY) === "true";
    const restoredTab = localStorage.getItem(TAB_STORAGE_KEY) === "messages" ? "messages" : "steward";
    const restoredPillCollapsed = localStorage.getItem(PILL_COLLAPSED_STORAGE_KEY) === "true";
    setActiveTab(restoredTab);
    setOpen(restoredOpen);
    setPillCollapsed(restoredPillCollapsed);
    emitDockState(restoredOpen);
    onMessagesOpenChange?.(restoredOpen && restoredTab === "messages");
    setHydrated(true);
    return () => emitDockState(false);
  }, [emitDockState, onMessagesOpenChange]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(PILL_COLLAPSED_STORAGE_KEY, pillCollapsed ? "true" : "false");
  }, [hydrated, pillCollapsed]);

  useEffect(() => {
    if (!hydrated || !messagesOpen) return;
    openDock("messages");
  }, [hydrated, messagesOpen, openDock]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeDock();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDock, open]);

  // Listen for steward:open-with-prompt events fired by StewardContextButton.
  useEffect(() => {
    function handleOpenWithPrompt(e: Event) {
      const detail = (e as CustomEvent<StewardOpenPromptDetail>).detail;
      if (!detail?.prompt) return;
      setExternalPrompt(detail);
      openDock("steward");
    }
    window.addEventListener(STEWARD_OPEN_EVENT, handleOpenWithPrompt);
    return () => window.removeEventListener(STEWARD_OPEN_EVENT, handleOpenWithPrompt);
  }, [openDock]);

  if (!hydrated) return null;

  const stewardModule = normalizeStewardModule(externalPrompt?.moduleKey ?? moduleKey);
  const isDonorFloatingMode = normalizeStewardModule(moduleKey) === "donor";
  const unreadLabel = messengerUnread > 0 ? `${Math.min(messengerUnread, 99)} unread` : "No unread";

  function sendFromPill() {
    const prompt = pillDraft.trim();
    if (!prompt) {
      openDock("steward");
      return;
    }
    setExternalPrompt({ prompt, moduleKey: stewardModule, mode: "ask" });
    setPillDraft("");
    openDock("steward");
  }

  function collapsePill() {
    setPillCollapsed(true);
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, "false");
    emitDockState(false);
    onMessagesOpenChange?.(false);
  }

  function restorePill() {
    setPillCollapsed(false);
  }

  return (
    <>
      {showLauncher && !open && !isDonorFloatingMode ? (
        <button
          type="button"
          onClick={() => openDock("steward")}
          title="Open Steward and messages"
          style={{ bottom: "max(1rem, env(safe-area-inset-bottom))", right: "1rem" }}
          className="group fixed z-[9990] flex w-[min(22rem,calc(100vw-2rem))] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-[0_18px_44px_rgba(15,23,42,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(15,23,42,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          aria-label="Open Steward and messages"
        >
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50">
            <StewardAvatarIcon size={30} alt="Steward" className="ring-2 ring-white" />
            <span className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-900">Steward + Messages</span>
            <span className="block truncate text-xs text-slate-500">Docked DM box · {unreadLabel}</span>
          </span>
          {messengerUnread > 0 ? (
            <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[11px] font-bold text-white">
              {Math.min(messengerUnread, 99)}
            </span>
          ) : (
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
          )}
        </button>
      ) : null}

      {isDonorFloatingMode ? (
        <>
          {open ? (
            <>
              <div
                className="fixed inset-0 z-[9988] bg-slate-950/14"
                style={{ backdropFilter: "blur(1.2px)" }}
                onClick={() => closeDock()}
              />
              <section
                className="fixed left-1/2 top-[118px] z-[9991] w-[min(860px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[26px] border border-slate-200/95 bg-white shadow-[0_20px_52px_rgba(2,6,23,0.18),0_0_120px_rgba(2,6,23,0.08)]"
                aria-label="Steward dashboard overlay"
              >
                <header className="border-b border-slate-200/80 bg-white px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
                        <StewardAvatarIcon size={22} alt="Steward" className="ring-1 ring-white" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold text-slate-900">Steward AI</h2>
                        <p className="truncate text-xs text-slate-500">Your ministry intelligence partner</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => closeDock()}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                        title="Minimize"
                      >
                        <span className="text-sm leading-none">−</span>
                        Minimize
                      </button>
                      <button
                        type="button"
                        onClick={() => closeDock()}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                        title="Close"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {["Insights", "Ask Anything", "Recommendations", "Donor Profile"].map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold ${tab === "Insights" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </header>

                <div className="h-[min(62vh,560px)] bg-white">
                  {activeTab === "steward" ? (
                    <StewardChatPanel
                      open
                      onClose={closeDock}
                      moduleKey={stewardModule}
                      scopePath={scopePath}
                      displayMode="workspace"
                      composerPlacement="external-pill"
                      externalPrompt={externalPrompt}
                      onExternalPromptConsumed={() => setExternalPrompt(null)}
                    />
                  ) : (
                    <MessengerPanel
                      open
                      variant="dock"
                      onClose={closeDock}
                      onUnreadChange={onMessengerUnreadChange}
                    />
                  )}
                </div>
              </section>
            </>
          ) : null}

          {!pillCollapsed ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                sendFromPill();
              }}
              className="fixed bottom-[max(0.8rem,env(safe-area-inset-bottom))] left-1/2 z-[9992] flex w-[min(760px,calc(100vw-1rem))] -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-900/85 bg-white px-3 py-2 shadow-[0_14px_32px_rgba(2,52,39,0.26)]"
            >
              <button
                type="button"
                onClick={() => openDock("steward")}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white"
                title="Open Steward"
              >
                <StewardAvatarIcon size={18} alt="Steward" className="ring-1 ring-white/50" />
              </button>
              <input
                value={pillDraft}
                onChange={(event) => setPillDraft(event.target.value)}
                onFocus={() => openDock("steward")}
                placeholder="Ask Steward anything about your donors, gifts, or ministry..."
                className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                title="Send"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={collapsePill}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                title="Dismiss to side tab"
                aria-label="Dismiss Steward pill to side tab"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={restorePill}
              className="fixed right-0 top-1/2 z-[9992] -translate-y-1/2 rounded-l-xl border border-r-0 border-emerald-800/60 bg-emerald-900 px-2 py-3 text-emerald-100 shadow-[0_10px_30px_rgba(2,52,39,0.32)] hover:bg-emerald-800"
              title="Open Steward"
              aria-label="Open Steward"
            >
              <span className="flex items-center gap-1.5">
                <StewardAvatarIcon size={14} alt="Steward" className="ring-1 ring-white/25" />
                <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-semibold tracking-[0.12em]">STEWARD</span>
              </span>
            </button>
          )}
        </>
      ) : null}

      {open && !isDonorFloatingMode ? (
        <section
          className="fixed inset-x-2 bottom-2 top-[4.25rem] z-[9991] flex flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_26px_80px_rgba(15,23,42,0.24)] sm:inset-x-auto sm:left-auto sm:right-4 sm:top-auto sm:h-[min(720px,calc(100dvh-5rem))] sm:w-[min(760px,calc(100vw-2rem))]"
          aria-label="Steward and messages dock"
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <StewardAvatarIcon size={28} alt="Steward" className="ring-2 ring-emerald-100" />
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-slate-900">Steward DM Dock</h2>
                <p className="truncate text-[11px] text-slate-500">AI assistant and staff messages in one conversation box</p>
              </div>
            </div>
            <div className="flex rounded-full border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => switchTab("steward")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === "steward" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
              >
                Steward
              </button>
              <button
                type="button"
                onClick={() => switchTab("messages")}
                className={`relative rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === "messages" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
              >
                Messages
                {messengerUnread > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white">
                    {Math.min(messengerUnread, 99)}
                  </span>
                ) : null}
              </button>
            </div>
            <button
              type="button"
              onClick={closeDock}
              title="Minimize dock"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-hidden bg-white">
            {activeTab === "steward" ? (
              <StewardChatPanel
                open
                onClose={closeDock}
                moduleKey={stewardModule}
                scopePath={scopePath}
                displayMode="workspace"
                externalPrompt={externalPrompt}
                onExternalPromptConsumed={() => setExternalPrompt(null)}
              />
            ) : (
              <MessengerPanel
                open
                variant="dock"
                onClose={closeDock}
                onUnreadChange={onMessengerUnreadChange}
              />
            )}
          </div>
        </section>
      ) : null}
    </>
  );
}
